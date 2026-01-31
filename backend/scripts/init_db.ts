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
              created_at      timestamptz not null default now()
            )`;
		console.log('Organization table created successfully');
		// =========================
		// USER (INTERVIEWERS / RECRUITERS)
		// =========================
		await sql`CREATE TABLE IF NOT EXISTS user_account (
              id                uuid primary key,
              email             text unique not null,
              name              text,
              organization_id   uuid references organization(id),
              role              text check (role in ('recruiter','interviewer','admin')),
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
              status           text check (status in ('open','closed')),
              created_at       timestamptz not null default now()
            )`;
		/*
      requirements schema
      {
        "skills": [
          { "name": "system_design", "level": "senior" },
          { "name": "postgres", "level": "intermediate" },
          { "name": "distributed_systems", "level": "basic" }
        ],
        "interview_types": ["technical", "system_design"],
        "evaluation_weights": {
          "communication": 0.3,
          "problem_solving": 0.4,
          "depth": 0.3
        }
      }

    */
		console.log('Position table created successfully');
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
                                  status in ('scheduled','in_progress','completed','cancelled')
                                ),
              evidence_state    text check (
                                  evidence_state in ('complete','partial','deleted')
                                ) default 'complete',
              livekit_room_id   text,
              created_at        timestamptz not null default now()
            )`;
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
              s3_uri          text not null,
              start_offset_ms integer not null,
              end_offset_ms   integer not null,
              speaker_type    text check (
                                speaker_type in ('candidate','interviewer','unknown')
                              ),
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
	} catch (error) {
		console.error('Error creating database tables:', error);
	} finally {
		process.exit(0);
	}
};

createDatabaseTables();
