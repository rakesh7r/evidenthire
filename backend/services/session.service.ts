import { sql } from '../db';

// Types for session management
export interface InterviewSession {
	id: string;
	interview_id: string;
	session_number: number;
	status: 'active' | 'ended' | 'processing' | 'completed' | 'failed';
	started_at: Date;
	ended_at?: Date;
	s3_session_path?: string;
	total_duration_ms?: number;
	participant_count: number;
	transcript_status: 'pending' | 'processing' | 'completed' | 'failed';
	transcript_s3_uri?: string;
	metadata?: any;
}

export interface SessionParticipant {
	id: string;
	session_id: string;
	participant_identity: string;
	email?: string;
	role: 'candidate' | 'interviewer' | 'observer';
	track_id?: string;
	joined_at: Date;
	left_at?: Date;
	track_offset_ms: number;
	s3_audio_prefix?: string;
	s3_metadata_uri?: string;
	chunks_processed: number;
}

export interface MediaChunkRecord {
	id: string;
	interview_id: string;
	session_id: string;
	participant_id: string;
	s3_uri: string;
	chunk_index: number;
	start_offset_ms: number;
	end_offset_ms: number;
	duration_ms: number;
	speaker_type: 'candidate' | 'interviewer' | 'unknown';
	transcription_status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Get or create an active session for an interview
 * This replaces the in-memory session cache with database persistence
 */
export const getOrCreateSession = async (
	interviewId: string,
	s3Bucket: string
): Promise<{ session: InterviewSession; isNew: boolean }> => {
	// First, try to find an active session
	const activeSessions = await sql`
        SELECT * FROM interview_session 
        WHERE interview_id = ${interviewId} 
        AND status = 'active'
        ORDER BY session_number DESC
        LIMIT 1
    `;

	if (activeSessions[0]) {
		console.log(`Found active session ${activeSessions[0].session_number} for interview ${interviewId}`);
		return { session: activeSessions[0] as InterviewSession, isNew: false };
	}

	// No active session, create a new one
	// Get the next session number
	const maxSession = await sql`
        SELECT COALESCE(MAX(session_number), 0) as max_num 
        FROM interview_session 
        WHERE interview_id = ${interviewId}
    `;
	const nextSessionNumber = (maxSession[0]?.max_num || 0) + 1;

	const s3SessionPath = `${interviewId}/sessions/session${nextSessionNumber}`;

	const newSession = await sql`
        INSERT INTO interview_session (
            interview_id, 
            session_number, 
            status, 
            s3_session_path,
            started_at
        )
        VALUES (
            ${interviewId}, 
            ${nextSessionNumber}, 
            'active', 
            ${s3SessionPath},
            NOW()
        )
        RETURNING *
    `;

	console.log(`Created new session ${nextSessionNumber} for interview ${interviewId}`);
	return { session: newSession[0] as InterviewSession, isNew: true };
};

/**
 * Get session by ID
 */
export const getSessionById = async (sessionId: string): Promise<InterviewSession | null> => {
	const sessions = await sql`
        SELECT * FROM interview_session WHERE id = ${sessionId}
    `;
	return (sessions[0] as InterviewSession) || null;
};

/**
 * Get session by interview ID and session number
 */
export const getSessionByNumber = async (
	interviewId: string,
	sessionNumber: number
): Promise<InterviewSession | null> => {
	const sessions = await sql`
        SELECT * FROM interview_session 
        WHERE interview_id = ${interviewId} 
        AND session_number = ${sessionNumber}
    `;
	return (sessions[0] as InterviewSession) || null;
};

/**
 * Get the active session for an interview
 */
export const getActiveSession = async (interviewId: string): Promise<InterviewSession | null> => {
	const sessions = await sql`
        SELECT * FROM interview_session 
        WHERE interview_id = ${interviewId} 
        AND status = 'active'
        ORDER BY session_number DESC
        LIMIT 1
    `;
	return (sessions[0] as InterviewSession) || null;
};

/**
 * Get the latest session for an interview (active or ended)
 */
export const getLatestSession = async (interviewId: string): Promise<InterviewSession | null> => {
	const sessions = await sql`
        SELECT * FROM interview_session 
        WHERE interview_id = ${interviewId} 
        ORDER BY session_number DESC
        LIMIT 1
    `;
	return (sessions[0] as InterviewSession) || null;
};

/**
 * End a session
 */
export const endSession = async (sessionId: string, totalDurationMs?: number): Promise<InterviewSession | null> => {
	const updated = await sql`
        UPDATE interview_session 
        SET 
            status = 'ended',
            ended_at = NOW(),
            total_duration_ms = ${totalDurationMs || null},
            updated_at = NOW()
        WHERE id = ${sessionId}
        RETURNING *
    `;
	console.log(`Session ${sessionId} ended`);
	return (updated[0] as InterviewSession) || null;
};

/**
 * Update session status
 */
export const updateSessionStatus = async (
	sessionId: string,
	status: InterviewSession['status']
): Promise<InterviewSession | null> => {
	const updated = await sql`
        UPDATE interview_session 
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${sessionId}
        RETURNING *
    `;
	return (updated[0] as InterviewSession) || null;
};

/**
 * Update session transcript status
 */
export const updateSessionTranscriptStatus = async (
	sessionId: string,
	transcriptStatus: InterviewSession['transcript_status'],
	transcriptS3Uri?: string
): Promise<InterviewSession | null> => {
	const updated = await sql`
        UPDATE interview_session 
        SET 
            transcript_status = ${transcriptStatus},
            transcript_s3_uri = ${transcriptS3Uri || null},
            updated_at = NOW()
        WHERE id = ${sessionId}
        RETURNING *
    `;
	return (updated[0] as InterviewSession) || null;
};

/**
 * Add or update a participant in a session
 */
export const upsertSessionParticipant = async (
	sessionId: string,
	participantIdentity: string,
	data: {
		email?: string;
		role?: 'candidate' | 'interviewer' | 'observer';
		trackId?: string;
		trackOffsetMs?: number;
		s3AudioPrefix?: string;
		s3MetadataUri?: string;
	}
): Promise<SessionParticipant> => {
	// Convert undefined to null for SQL compatibility
	const email = data.email ?? null;
	const role = data.role ?? 'interviewer';
	const trackId = data.trackId ?? null;
	const trackOffsetMs = data.trackOffsetMs ?? 0;
	const s3AudioPrefix = data.s3AudioPrefix ?? null;
	const s3MetadataUri = data.s3MetadataUri ?? null;

	const result = await sql`
        INSERT INTO session_participant (
            session_id,
            participant_identity,
            email,
            role,
            track_id,
            track_offset_ms,
            s3_audio_prefix,
            s3_metadata_uri
        )
        VALUES (
            ${sessionId},
            ${participantIdentity},
            ${email},
            ${role},
            ${trackId},
            ${trackOffsetMs},
            ${s3AudioPrefix},
            ${s3MetadataUri}
        )
        ON CONFLICT (session_id, participant_identity)
        DO UPDATE SET
            track_id = COALESCE(EXCLUDED.track_id, session_participant.track_id),
            track_offset_ms = COALESCE(EXCLUDED.track_offset_ms, session_participant.track_offset_ms),
            s3_audio_prefix = COALESCE(EXCLUDED.s3_audio_prefix, session_participant.s3_audio_prefix),
            s3_metadata_uri = COALESCE(EXCLUDED.s3_metadata_uri, session_participant.s3_metadata_uri)
        RETURNING *
    `;

	// Update participant count in session
	await sql`
        UPDATE interview_session 
        SET participant_count = (
            SELECT COUNT(*) FROM session_participant WHERE session_id = ${sessionId}
        ),
        updated_at = NOW()
        WHERE id = ${sessionId}
    `;

	return result[0] as SessionParticipant;
};

/**
 * Get participant by session and identity
 */
export const getSessionParticipant = async (
	sessionId: string,
	participantIdentity: string
): Promise<SessionParticipant | null> => {
	const result = await sql`
        SELECT * FROM session_participant 
        WHERE session_id = ${sessionId} 
        AND participant_identity = ${participantIdentity}
    `;
	return (result[0] as SessionParticipant) || null;
};

/**
 * Mark participant as left
 */
export const markParticipantLeft = async (
	sessionId: string,
	participantIdentity: string
): Promise<SessionParticipant | null> => {
	const result = await sql`
        UPDATE session_participant 
        SET left_at = NOW()
        WHERE session_id = ${sessionId} 
        AND participant_identity = ${participantIdentity}
        RETURNING *
    `;
	return (result[0] as SessionParticipant) || null;
};

/**
 * Record a media chunk in the database
 */
export const recordMediaChunk = async (
	interviewId: string,
	sessionId: string,
	participantId: string,
	data: {
		s3Uri: string;
		chunkIndex: number;
		startOffsetMs: number;
		endOffsetMs: number;
		durationMs: number;
		speakerType: 'candidate' | 'interviewer' | 'unknown';
	}
): Promise<MediaChunkRecord> => {
	const result = await sql`
        INSERT INTO media_chunk (
            interview_id,
            session_id,
            participant_id,
            s3_uri,
            chunk_index,
            start_offset_ms,
            end_offset_ms,
            duration_ms,
            speaker_type,
            transcription_status
        )
        VALUES (
            ${interviewId},
            ${sessionId},
            ${participantId},
            ${data.s3Uri},
            ${data.chunkIndex},
            ${data.startOffsetMs},
            ${data.endOffsetMs},
            ${data.durationMs},
            ${data.speakerType},
            'pending'
        )
        RETURNING *
    `;

	// Increment chunks_processed counter for participant
	await sql`
        UPDATE session_participant 
        SET chunks_processed = chunks_processed + 1
        WHERE id = ${participantId}
    `;

	return result[0] as MediaChunkRecord;
};

/**
 * Update media chunk transcription status
 */
export const updateChunkTranscriptionStatus = async (
	chunkId: string,
	status: MediaChunkRecord['transcription_status']
): Promise<MediaChunkRecord | null> => {
	const result = await sql`
        UPDATE media_chunk 
        SET transcription_status = ${status}
        WHERE id = ${chunkId}
        RETURNING *
    `;
	return (result[0] as MediaChunkRecord) || null;
};

/**
 * Get all sessions for an interview
 */
export const getInterviewSessions = async (interviewId: string): Promise<InterviewSession[]> => {
	const sessions = await sql`
        SELECT * FROM interview_session 
        WHERE interview_id = ${interviewId}
        ORDER BY session_number ASC
    `;
	return sessions as unknown as InterviewSession[];
};

/**
 * Get all participants in a session
 */
export const getSessionParticipants = async (sessionId: string): Promise<SessionParticipant[]> => {
	const participants = await sql`
        SELECT * FROM session_participant 
        WHERE session_id = ${sessionId}
        ORDER BY joined_at ASC
    `;
	return participants as unknown as SessionParticipant[];
};

/**
 * Get all media chunks for a session
 */
export const getSessionMediaChunks = async (sessionId: string): Promise<MediaChunkRecord[]> => {
	const chunks = await sql`
        SELECT * FROM media_chunk 
        WHERE session_id = ${sessionId}
        ORDER BY start_offset_ms ASC
    `;
	return chunks as unknown as MediaChunkRecord[];
};
