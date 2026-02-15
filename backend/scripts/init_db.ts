import { sql } from '../db';

export const createDatabaseTables = async () => {
	try {
		// =========================
		// WAITLIST
		// =========================
		await sql`
            CREATE TABLE IF NOT EXISTS waitlist (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
		console.log('Waitlist table created successfully');
		// =========================
		// ORGANIZATION
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS organization (
              id              uuid primary key DEFAULT gen_random_uuid(),
              name            text not null,
              domain          text,
              city            text,
              country         text,
              created_at      timestamptz not null default now()
            )`;
		console.log('Organization table created successfully');
		// =========================
		// USER (INTERVIEWERS / RECRUITERS)
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS user_account (
              id                uuid primary key,
              email             text unique not null,
              full_name         text,
              organization_id   uuid references organization(id),
              role              text check (role in ('recruiter','interviewer','admin')),
              date_of_birth     date,
              gender            text check (gender in ('male','female','non_binary','prefer_not_to_say','other')),
              created_at        timestamptz not null default now(),
              last_logged_in_at timestamptz
            )`;
		console.log('User table created successfully');
		// =========================
		// CANDIDATE
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS candidate (
              id          uuid primary key DEFAULT gen_random_uuid(),
              email       text not null,
              name        text,
              cv_analysis jsonb,
              created_at  timestamptz not null default now()
            )`;
		console.log('Candidate table created successfully');
		// =========================
		// POSITION
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS position (
              id               uuid primary key DEFAULT gen_random_uuid(),
              organization_id  uuid references organization(id),
              title            text not null,
              requirements     jsonb,
              rounds           jsonb DEFAULT '[]'::jsonb,
              status           text check (status in ('open','closed')),
              created_at       timestamptz not null default now()
            )`;
		/*
      requirements schema
      ...
    */
		/*
      rounds schema
      [
        { "title": "Phone Screen", "type": "cultural_fit", "duration_minutes": 30 },
        { "title": "System Design", "type": "system_design", "duration_minutes": 60 }
      ]
    */
		console.log('Position table created successfully');
		// =========================
		// APPLICATION (tracks job applications with resumes)
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS application (
              id               uuid primary key DEFAULT gen_random_uuid(),
              position_id      uuid references position(id) NOT NULL,
              email            text not null,
              name             text,
              resume_s3_url    text,
              cv_analysis      jsonb,
              status           text check (status in ('pending','reviewed','shortlisted','rejected')) DEFAULT 'pending',
              created_at       timestamptz not null default now(),
              updated_at       timestamptz not null default now(),
              UNIQUE(email, position_id)
            )`;
		console.log('Application table created successfully');
		// =========================
		// INTERVIEW
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS interview (
              id                uuid primary key DEFAULT gen_random_uuid(),
              position_id       uuid references position(id),
              candidate_id      uuid references candidate(id),
              scheduled_start   timestamptz not null,
              scheduled_end     timestamptz,
              status            text check (
                                  status in ('scheduled','in_progress','completed','cancelled','no_show','expired')
                                ) DEFAULT 'scheduled',
              evidence_state    text check (
                                  evidence_state in ('complete','partial','deleted')
                                ) default 'complete',
              livekit_room_id   text,
              -- Round Information
              round_title       text,
              round_type        text,
              -- New fields for lifecycle management
              first_join_at     timestamptz,
              last_activity_at  timestamptz,
              actual_end_at     timestamptz,
              ended_reason      text check (
                                  ended_reason in ('normal','timeout','cancelled','no_show','interviewer_ended','technical_issue')
                                ),
              -- Waiting room support
              waiting_room_enabled boolean DEFAULT true,
              candidate_admitted boolean DEFAULT false,
              candidate_waiting_since timestamptz,
              -- Duration tracking
              total_duration_ms integer,
              -- Configuration (can be set per-interview, defaults set in code)
              max_duration_minutes integer DEFAULT 120,
              -- Audio storage (session-less)
              audio_folder_path text,
              last_chunk_index  integer DEFAULT 0,
              report_s3_url     text,
              created_at        timestamptz not null default now()
            )`;

		// Ensure column exists for existing tables
		await sql`ALTER TABLE interview ADD COLUMN IF NOT EXISTS report_s3_url text`;

		console.log('Interview table created successfully');

		// =========================
		// INTERVIEW PARTICIPANTS (M:N)
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS interview_participant (
              interview_id  uuid references interview(id),
              user_id       uuid references user_account(id),
              role          text check (role in ('interviewer','observer')),
              joined_at     timestamptz,
              left_at       timestamptz,
              primary key (interview_id, user_id)
            )`;
		console.log('Interview Participant table created successfully');
		// =========================
		// MEDIA CHUNKS (AUDIO SOURCE OF TRUTH)
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS media_chunk (
              id              uuid primary key DEFAULT gen_random_uuid(),
              interview_id    uuid references interview(id),
              participant_identity text,
              s3_uri          text not null,
              chunk_index     integer,
              start_offset_ms integer not null,
              end_offset_ms   integer not null,
              duration_ms     integer,
              speaker_type    text check (
                                speaker_type in ('candidate','interviewer','unknown')
                              ),
              transcription_status text check (
                                transcription_status in ('pending','processing','completed','failed')
                              ) DEFAULT 'pending',
              created_at      timestamptz not null default now(),
              deleted_at      timestamptz,
              deleted_by      uuid references user_account(id)
            )`;
		console.log('Media Chunk table created successfully');
		// =========================
		// TRANSCRIPT SEGMENTS
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS transcript_segment (
              id                uuid primary key DEFAULT gen_random_uuid(),
              media_chunk_id    uuid references media_chunk(id),
              speaker_label     text,
              text              text,
              confidence_score  numeric(4,3),
              created_at        timestamptz not null default now(),
              deleted_at        timestamptz
            )`;
		console.log('Transcript Segment table created successfully');
		// =========================
		// SIGNAL QUALITY
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS interview_signal_quality (
              interview_id          uuid primary key references interview(id),
              speaking_time_ratio   numeric(5,2),
              audio_clarity_score   numeric(4,2),
              transcript_confidence numeric(4,2),
              quality_level         text check (
                                      quality_level in ('good','degraded','insufficient')
                                    ),
              evaluated_at          timestamptz not null,
              invalidated_at        timestamptz
            )`;
		console.log('Signal Quality table created successfully');
		// =========================
		// INTERVIEW REPORT
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS interview_report (
              id                 uuid primary key DEFAULT gen_random_uuid(),
              interview_id       uuid references interview(id),
              alignment_summary  text,
              strengths          jsonb,
              risks              jsonb,
              confidence_level   text check (
                                   confidence_level in ('high','medium','low')
                                 ),
              created_at         timestamptz not null default now(),
              invalidated_at     timestamptz,
              invalidation_reason text
            )`;
		console.log('Interview Report table created successfully');
		// =========================
		// PRICING PLAN
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS pricing_plan (
              id                   uuid primary key DEFAULT gen_random_uuid(),
              scope                text check (scope in ('individual','organization')),
              interviews_per_pack  integer not null,
              price_cents          integer not null,
              created_at           timestamptz not null default now()
            )`;
		console.log('Pricing Plan table created successfully');
		// =========================
		// ENTITLEMENT / USAGE
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS entitlement (
              id                   uuid primary key DEFAULT gen_random_uuid(),
              owner_type           text check (owner_type in ('user','organization')),
              owner_id             uuid not null,
              position_id          uuid references position(id),
              interviews_allowed   integer not null,
              interviews_used      integer not null default 0,
              expires_at           timestamptz,
              created_at           timestamptz not null default now()
            )`;
		console.log('Entitlement table created successfully');
		// =========================
		// DATA DELETION AUDIT LOG
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS data_deletion_event (
              id            uuid primary key DEFAULT gen_random_uuid(),
              interview_id  uuid references interview(id),
              actor_id      uuid references user_account(id),
              data_type     text check (
                              data_type in ('audio','transcript','report','all')
                            ),
              reason        text,
              created_at    timestamptz not null default now()
            )`;
		console.log('Data Deletion Audit Log table created successfully');
		console.log('Database tables created successfully');
		// =========================
		// FEATURE FLAGS
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS feature_flags (
              feature         text primary key,
              is_enabled      boolean not null default false
            )`;
		console.log('Feature Flags table created successfully');
	} catch (error) {
		console.error('Error creating database tables:', error);
	} finally {
		process.exit(0);
	}
};

createDatabaseTables();
