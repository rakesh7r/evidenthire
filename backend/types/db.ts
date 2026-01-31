export type UserRole = 'recruiter' | 'interviewer' | 'admin';
export type PositionStatus = 'open' | 'closed';
export type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type EvidenceState = 'complete' | 'partial' | 'deleted';
export type ParticipantRole = 'interviewer' | 'observer';
export type SpeakerType = 'candidate' | 'interviewer' | 'unknown';
export type SignalQualityLevel = 'good' | 'degraded' | 'insufficient';
export type ReportConfidenceLevel = 'high' | 'medium' | 'low';
export type PlanScope = 'individual' | 'organization';
export type OwnerType = 'user' | 'organization';
export type DeletionDataType = 'audio' | 'transcript' | 'report' | 'all';

export type SkillLevel = 'basic' | 'intermediate' | 'senior';

export interface SkillRequirement {
	name: string;
	level: SkillLevel;
}

export interface EvaluationWeights {
	communication: number;
	problem_solving: number;
	depth: number;
}

export interface RequirementsSchema {
	skills: SkillRequirement[];
	interview_types: string[];
	evaluation_weights: EvaluationWeights;
}

export interface Waitlist {
	id: string; // UUID
	email: string;
	created_at: string; // ISO Date string
}

export interface Organization {
	id: string; // UUID
	name: string;
	domain?: string | null;
	created_at: string; // ISO Date string
}

export interface UserAccount {
	id: string; // UUID
	email: string;
	name?: string | null;
	organization_id?: string | null; // UUID
	role: UserRole;
	created_at: string; // ISO Date string
	last_logged_in_at?: string | null; // ISO Date string
}

export interface Candidate {
	id: string; // UUID
	email: string;
	name?: string | null;
	created_at: string; // ISO Date string
}

export interface Position {
	id: string; // UUID
	organization_id?: string | null; // UUID
	title: string;
	requirements?: RequirementsSchema | null; // JSONB
	status: PositionStatus;
	created_at: string; // ISO Date string
}

export interface Interview {
	id: string; // UUID
	position_id?: string | null; // UUID
	candidate_id?: string | null; // UUID
	scheduled_start: string; // ISO Date string
	scheduled_end?: string | null; // ISO Date string
	status: InterviewStatus;
	evidence_state: EvidenceState;
	livekit_room_id?: string | null;
	created_at: string; // ISO Date string
}

export interface InterviewParticipant {
	interview_id: string; // UUID
	user_id: string; // UUID
	role: ParticipantRole;
	joined_at?: string | null; // ISO Date string
	left_at?: string | null; // ISO Date string
}

export interface MediaChunk {
	id: string; // UUID
	interview_id?: string | null; // UUID
	s3_uri: string;
	start_offset_ms: number;
	end_offset_ms: number;
	speaker_type: SpeakerType;
	created_at: string; // ISO Date string
	deleted_at?: string | null; // ISO Date string
	deleted_by?: string | null; // UUID
}

export interface TranscriptSegment {
	id: string; // UUID
	media_chunk_id?: string | null; // UUID
	speaker_label?: string | null;
	text?: string | null;
	confidence_score?: number | null; // numeric(4,3)
	created_at: string; // ISO Date string
	deleted_at?: string | null; // ISO Date string
}

export interface InterviewSignalQuality {
	interview_id: string; // UUID
	speaking_time_ratio?: number | null; // numeric(5,2)
	audio_clarity_score?: number | null; // numeric(4,2)
	transcript_confidence?: number | null; // numeric(4,2)
	quality_level?: SignalQualityLevel | null;
	evaluated_at: string; // ISO Date string
	invalidated_at?: string | null; // ISO Date string
}

export interface InterviewReport {
	id: string; // UUID
	interview_id?: string | null; // UUID
	alignment_summary?: string | null;
	strengths?: any | null; // JSONB
	risks?: any | null; // JSONB
	confidence_level?: ReportConfidenceLevel | null;
	created_at: string; // ISO Date string
	invalidated_at?: string | null; // ISO Date string
	invalidation_reason?: string | null;
}

export interface PricingPlan {
	id: string; // UUID
	scope?: PlanScope | null;
	interviews_per_pack: number;
	price_cents: number;
	created_at: string; // ISO Date string
}

export interface Entitlement {
	id: string; // UUID
	owner_type?: OwnerType | null;
	owner_id: string; // UUID
	position_id?: string | null; // UUID
	interviews_allowed: number;
	interviews_used: number;
	expires_at?: string | null; // ISO Date string
	created_at: string; // ISO Date string
}

export interface DataDeletionEvent {
	id: string; // UUID
	interview_id?: string | null; // UUID
	actor_id?: string | null; // UUID
	data_type?: DeletionDataType | null;
	reason?: string | null;
	created_at: string; // ISO Date string
}
