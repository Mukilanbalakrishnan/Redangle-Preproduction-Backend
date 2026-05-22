import { pool } from "../config/db";
import { ensureEventUploadColumnsQuery } from "./eventDetails.query";
import { ensureAssignTeamColumnsQuery } from "./assignTeam.query";

export const ensureEventRuntimeSessionsQuery = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_runtime_sessions (
      id SERIAL PRIMARY KEY,
      external_lead_id TEXT NOT NULL,
      work_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'not_started',
      started_at TIMESTAMP,
      paused_at TIMESTAMP,
      ended_at TIMESTAMP,
      accumulated_seconds INTEGER NOT NULL DEFAULT 0,
      started_by VARCHAR(100),
      ended_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (external_lead_id, work_date)
    )
  `);
  await pool.query(`
    ALTER TABLE event_runtime_sessions
    ADD COLUMN IF NOT EXISTS phase VARCHAR(32) NOT NULL DEFAULT 'event'
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'event_runtime_sessions_external_lead_id_work_date_key'
      ) THEN
        ALTER TABLE event_runtime_sessions
        DROP CONSTRAINT event_runtime_sessions_external_lead_id_work_date_key;
      END IF;
    END$$;
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS event_runtime_sessions_lead_phase_date_uniq
      ON event_runtime_sessions (external_lead_id, phase, work_date)
  `);

  // Retro-tag rows that were inserted before the phase column existed.
  // Any session for a lead currently in pre_production was clearly pre-production work.
  await pool.query(`
    UPDATE event_runtime_sessions s
    SET phase = 'pre_production'
    FROM external_leads el
    WHERE s.phase = 'event'
      AND COALESCE(el.current_phase, '') = 'pre_production'
      AND (el.external_id::text = s.external_lead_id
           OR el.lead_serial_number = s.external_lead_id)
  `);

  // For leads that already moved to the event phase, sessions whose work_date is
  // earlier than event_started_at belong to the pre-production shoot, not the event.
  await pool.query(`
    UPDATE event_runtime_sessions s
    SET phase = 'pre_production'
    FROM external_leads el
    LEFT JOIN event_details ed
      ON ed.external_lead_id = el.external_id::text
      OR ed.external_lead_id = el.lead_serial_number
    WHERE s.phase = 'event'
      AND COALESCE(el.current_phase, '') = 'event'
      AND ed.event_started_at IS NOT NULL
      AND s.work_date < ed.event_started_at::date
      AND (el.external_id::text = s.external_lead_id
           OR el.lead_serial_number = s.external_lead_id)
  `);
};

const resolvePhaseForLead = async (leadId: string): Promise<string> => {
  try {
    const res = await pool.query(
      `SELECT current_phase FROM external_leads
       WHERE external_id::text = $1 OR lead_serial_number = $1
       LIMIT 1`,
      [leadId]
    );
    const phase = String(res.rows[0]?.current_phase || "").trim().toLowerCase();
    return phase || "event";
  } catch {
    return "event";
  }
};

const normalizeWorkDate = (workDate?: string | null) => {
  if (!workDate) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(workDate);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const sessionSelect = `
  id,
  external_lead_id,
  phase,
  TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date,
  status,
  started_at,
  paused_at,
  ended_at,
  accumulated_seconds,
  CASE
    WHEN status = 'started' AND started_at IS NOT NULL
      THEN accumulated_seconds + FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)))::int
    ELSE accumulated_seconds
  END AS elapsed_seconds,
  started_by,
  ended_by,
  created_at,
  updated_at
`;

export const startEventQuery = async (leadId: string, startedBy: string, workDate?: string) => {
  await ensureEventUploadColumnsQuery();
  await ensureEventRuntimeSessionsQuery();
  const normalizedDate = normalizeWorkDate(workDate);
  const phase = await resolvePhaseForLead(leadId);

  await pool.query(
    `UPDATE event_details
     SET event_status = 'started',
         event_started_at = COALESCE(event_started_at, NOW()),
         event_paused_at = NULL,
         event_started_by = $2,
         updated_at = NOW()
     WHERE external_lead_id = $1
     RETURNING *`,
    [leadId, startedBy]
  );

  const result = await pool.query(
    `
    INSERT INTO event_runtime_sessions (external_lead_id, work_date, phase, status, started_at, started_by)
    VALUES ($1, $2::date, $4, 'started', NOW(), $3)
    ON CONFLICT (external_lead_id, phase, work_date)
    DO UPDATE SET
      status = 'started',
      started_at = CASE
        WHEN event_runtime_sessions.status = 'started' THEN event_runtime_sessions.started_at
        ELSE NOW()
      END,
      paused_at = NULL,
      ended_at = NULL,
      started_by = $3,
      updated_at = NOW()
    RETURNING ${sessionSelect}
    `,
    [leadId, normalizedDate, startedBy, phase]
  );
  return result.rows[0];
};

export const pauseEventQuery = async (leadId: string, workDate?: string) => {
  await ensureEventUploadColumnsQuery();
  await ensureEventRuntimeSessionsQuery();
  const normalizedDate = normalizeWorkDate(workDate);
  const phase = await resolvePhaseForLead(leadId);

  await pool.query(
    `UPDATE event_details
     SET event_status = 'paused', event_paused_at = NOW(), updated_at = NOW()
     WHERE external_lead_id = $1
     RETURNING *`,
    [leadId]
  );

  const result = await pool.query(
    `
    UPDATE event_runtime_sessions
    SET status = 'paused',
        accumulated_seconds = accumulated_seconds + CASE
          WHEN status = 'started' AND started_at IS NOT NULL
            THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)))::int)
          ELSE 0
        END,
        paused_at = NOW(),
        started_at = NULL,
        updated_at = NOW()
    WHERE external_lead_id = $1
      AND phase = $3
      AND work_date = $2::date
      AND status <> 'ended'
    RETURNING ${sessionSelect}
    `,
    [leadId, normalizedDate, phase]
  );
  return result.rows[0];
};

export const endEventSessionQuery = async (leadId: string, workDate?: string, endedBy?: string) => {
  await ensureEventUploadColumnsQuery();
  await ensureEventRuntimeSessionsQuery();
  const normalizedDate = normalizeWorkDate(workDate);
  const phase = await resolvePhaseForLead(leadId);

  const result = await pool.query(
    `
    UPDATE event_runtime_sessions
    SET status = 'ended',
        accumulated_seconds = accumulated_seconds + CASE
          WHEN status = 'started' AND started_at IS NOT NULL
            THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)))::int)
          ELSE 0
        END,
        ended_at = NOW(),
        ended_by = $3,
        started_at = NULL,
        paused_at = NULL,
        updated_at = NOW()
    WHERE external_lead_id = $1
      AND phase = $4
      AND work_date = $2::date
      AND status <> 'ended'
    RETURNING ${sessionSelect}
    `,
    [leadId, normalizedDate, endedBy || null, phase]
  );
  return result.rows[0];
};

export const endEventQuery = async (leadId: string, endedBy?: string, workDate?: string, completeEvent = true) => {
  await ensureEventUploadColumnsQuery();
  await ensureEventRuntimeSessionsQuery();

  const session = await endEventSessionQuery(leadId, workDate, endedBy);

  if (!completeEvent) {
    await pool.query(
      `UPDATE event_details
       SET event_status = 'paused', event_paused_at = NOW(), updated_at = NOW()
       WHERE external_lead_id = $1`,
      [leadId]
    );
    return session;
  }

  const eventResult = await pool.query(
    `UPDATE event_details
     SET event_status = 'ended', event_ended_at = NOW(), updated_at = NOW()
     WHERE external_lead_id = $1
     RETURNING *`,
    [leadId]
  );
  return session || eventResult.rows[0];
};

export const getEventStatusQuery = async (leadId: string) => {
  await ensureEventUploadColumnsQuery();
  await ensureEventRuntimeSessionsQuery();

  const eventResult = await pool.query(
    `SELECT external_lead_id, event_status, event_started_at, event_paused_at, event_ended_at, event_started_by
     FROM event_details
     WHERE external_lead_id = $1`,
    [leadId]
  );
  const event = eventResult.rows[0];
  if (!event) return null;

  const phase = await resolvePhaseForLead(leadId);
  const sessionsResult = await pool.query(
    `SELECT ${sessionSelect}
     FROM event_runtime_sessions
     WHERE external_lead_id = $1
       AND phase = $2
     ORDER BY work_date ASC`,
    [leadId, phase]
  );

  const currentSession = sessionsResult.rows.find((session) => session.status === "started" || session.status === "paused")
    || sessionsResult.rows[sessionsResult.rows.length - 1]
    || null;
  const totalSeconds = sessionsResult.rows.reduce((sum, session) => sum + Number(session.elapsed_seconds || 0), 0);

  return {
    ...event,
    sessions: sessionsResult.rows,
    current_session: currentSession,
    total_elapsed_seconds: totalSeconds,
  };
};

const hasValue = (value: unknown) =>
  typeof value === "string" ? value.trim().length > 0 : Boolean(value);

export const getEventDataProgressQuery = async (leadId: string) => {
  await ensureEventUploadColumnsQuery();
  await ensureAssignTeamColumnsQuery();

  const result = await pool.query(
    `
    SELECT
      COALESCE(el.external_id::text, ed.external_lead_id, at.external_lead_id, $1) AS lead_id,
      COALESCE(el.lead_serial_number, ed.external_lead_id, at.external_lead_id, $1) AS lead_code,
      COALESCE(ed.client_name, el.lead_name, $1) AS client_name,
      COALESCE(ed.media_status, 'Pending') AS media_status,
      el.current_phase,
      el.phase_status,
      el.phase_owner,
      CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END AS photographer,
      CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END AS videographer,
      CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END AS drone,
      ed.drive_link,
      ed.video_drive_link,
      ed.drone_photo_drive_link,
      ed.drone_video_drive_link,
      ed.updated_at
    FROM (
      SELECT $1::text AS lookup_id
    ) lookup
    LEFT JOIN external_leads el
      ON el.external_id::text = lookup.lookup_id
      OR el.lead_serial_number = lookup.lookup_id
    LEFT JOIN assign_teams at
      ON at.external_lead_id = lookup.lookup_id
      OR at.external_lead_id = el.external_id::text
      OR at.external_lead_id = el.lead_serial_number
    LEFT JOIN event_details ed
      ON ed.external_lead_id = lookup.lookup_id
      OR ed.external_lead_id = el.external_id::text
      OR ed.external_lead_id = el.lead_serial_number
      OR ed.external_lead_id = at.external_lead_id
    LIMIT 1
    `,
    [leadId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const uploads = [
    {
      key: "photographer",
      label: "Photographer",
      employee_id: row.photographer || null,
      required: hasValue(row.photographer),
      uploaded: hasValue(row.drive_link),
      upload_link: row.drive_link || null,
    },
    {
      key: "videographer",
      label: "Videographer",
      employee_id: row.videographer || null,
      required: hasValue(row.videographer),
      uploaded: hasValue(row.video_drive_link),
      upload_link: row.video_drive_link || null,
    },
    {
      key: "drone",
      label: "Drone",
      employee_id: row.drone || null,
      required: hasValue(row.drone),
      uploaded: hasValue(row.drone_photo_drive_link) || hasValue(row.drone_video_drive_link),
      upload_link: row.drone_photo_drive_link || row.drone_video_drive_link || null,
    },
  ].filter((item) => item.required);

  const uploadedCount = uploads.filter((item) => item.uploaded).length;
  const requiredCount = uploads.length;
  const allUploaded = requiredCount > 0 && uploadedCount === requiredCount;
  const mediaStatus = row.media_status || "Pending";
  const dataManagerApproved = ["Verified", "crm_verified", "harddisk_closed"].includes(mediaStatus);

  const workflowStatus = !allUploaded
    ? "waiting_for_uploads"
    : mediaStatus === "Reupload_Requested"
      ? "reupload_requested"
      : dataManagerApproved
        ? "data_manager_approved"
        : "waiting_for_data_manager";

  return {
    lead_id: row.lead_id,
    lead_code: row.lead_code,
    client_name: row.client_name,
    media_status: mediaStatus,
    current_phase: row.current_phase,
    phase_status: row.phase_status,
    phase_owner: row.phase_owner,
    required_count: requiredCount,
    uploaded_count: uploadedCount,
    all_uploaded: allUploaded,
    data_manager_approved: dataManagerApproved,
    workflow_status: workflowStatus,
    next_owner: dataManagerApproved ? "crm" : allUploaded ? "data-manager" : "field-team",
    next_path: dataManagerApproved
      ? "CRM -> Raw Data / QC Verification"
      : allUploaded
        ? "Data Manager -> Incoming Data Verification"
        : "Field Team -> Upload Raw Data",
    uploads,
  };
};
