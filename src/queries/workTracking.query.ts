import { pool } from "../config/db"

export type WorkTrackingPhase = "pre_production" | "event" | "post_production" | "all";

const PHASES = new Set(["pre_production", "event", "post_production"]);

const ensureWorkTrackingColumns = async () => {
  await pool.query(`
    ALTER TABLE event_details
    ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS drive_link TEXT,
    ADD COLUMN IF NOT EXISTS video_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS drone_photo_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS drone_video_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS save_the_date_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS save_the_date_submission_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS save_the_video_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS save_the_video_submission_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS retouch_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS retouch_submission_status VARCHAR(50)
  `);

  await pool.query(`
    ALTER TABLE external_leads
    ADD COLUMN IF NOT EXISTS flow_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS current_phase VARCHAR(30) DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS phase_status VARCHAR(20) DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS phase_owner VARCHAR(30),
    ADD COLUMN IF NOT EXISTS pre_production_step VARCHAR(20) DEFAULT 'shoot'
  `);

  await pool.query(`
    ALTER TABLE assign_teams
    ADD COLUMN IF NOT EXISTS drone VARCHAR(100),
    ADD COLUMN IF NOT EXISTS save_the_date VARCHAR(100),
    ADD COLUMN IF NOT EXISTS save_the_video VARCHAR(100),
    ADD COLUMN IF NOT EXISTS retouch VARCHAR(100)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assigned_projects (
      id SERIAL PRIMARY KEY,
      project_id VARCHAR(100) NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      project_type VARCHAR(100),
      employee_id VARCHAR(100) NOT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      upload_link TEXT,
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

export const normalizeWorkTrackingPhase = (phase?: string): WorkTrackingPhase => {
  if (!phase || phase === "all") return "all";
  return PHASES.has(phase) ? phase as WorkTrackingPhase : "all";
};

export const getWorkTrackingQuery = async (phase: WorkTrackingPhase = "all") => {
  await ensureWorkTrackingColumns();

  const scopedPhase = normalizeWorkTrackingPhase(phase);
  let params: string[] = [];
  let phaseWhere = "";

  if (scopedPhase === "event") {
    phaseWhere = `
WHERE
  COALESCE(el.current_phase, '') IN ('event', 'post_production')
  OR COALESCE(e.event_status, 'not_started') <> 'not_started'
  OR COALESCE(e.drone_photo_drive_link, '') <> ''
  OR COALESCE(e.drone_video_drive_link, '') <> ''
  OR EXISTS (
    SELECT 1
    FROM lead_tracking_stages event_lts
    WHERE event_lts.external_lead_id::text IN (
      e.external_lead_id,
      el.external_id::text,
      el.lead_serial_number::text
    )
    AND event_lts.stage_name IN ('event_started', 'shoot_completed', 'drone_upload')
  )`;
  } else if (scopedPhase === "pre_production") {
    phaseWhere = `WHERE COALESCE(el.current_phase, '') IN ('pre_production', 'event', 'post_production', 'not_started', '')`;
  } else if (scopedPhase === "post_production") {
    phaseWhere = `WHERE COALESCE(el.current_phase, '') = 'post_production'`;
  }

  const query = `
  SELECT
    e.id,
    e.external_lead_id,
    e.client_name,
    e.event_type,
    e.preferred_date AS event_date,
    COALESCE(el.flow_type, '') AS flow_type,
    COALESCE(el.current_phase, '') AS current_phase,
    COALESCE(el.phase_status, '') AS phase_status,
    COALESCE(el.phase_owner, '') AS phase_owner,
    COALESCE(el.pre_production_step, 'shoot') AS pre_production_step,
    COALESCE(e.event_status, 'not_started') AS event_status,
    COALESCE(e.media_status, '') AS media_status,
    e.drive_link,
    e.video_drive_link,
    e.drone_photo_drive_link,
    e.drone_video_drive_link,
    e.save_the_date_drive_link,
    e.save_the_date_submission_status,
    e.save_the_video_drive_link,
    e.save_the_video_submission_status,
    e.retouch_drive_link,
    e.retouch_submission_status,

    ARRAY_AGG(DISTINCT lcs.stage_name)
    FILTER (WHERE lcs.stage_name IS NOT NULL) AS completed_stages,

    JSONB_AGG(team_member)
    FILTER (WHERE team_member IS NOT NULL) AS assigned_team,

    JSONB_AGG(DISTINCT project_item)
    FILTER (WHERE project_item IS NOT NULL) AS project_statuses

FROM event_details e

LEFT JOIN external_leads el
ON e.external_lead_id = el.external_id::text
   OR e.external_lead_id = el.lead_serial_number::text

LEFT JOIN lead_tracking_stages lcs
ON lcs.external_lead_id::text IN (
  e.external_lead_id,
  el.external_id::text,
  el.lead_serial_number::text
)

LEFT JOIN assign_teams at
ON at.external_lead_id IN (
  e.external_lead_id,
  el.external_id::text,
  el.lead_serial_number::text
)

LEFT JOIN employees p
ON p.employee_id = at.photographer

LEFT JOIN employees v
ON v.employee_id = at.videographer

LEFT JOIN employees d
ON d.employee_id = at.drone

LEFT JOIN employees std
ON std.employee_id = at.save_the_date

LEFT JOIN employees stv
ON stv.employee_id = at.save_the_video

LEFT JOIN employees rt
ON rt.employee_id = at.retouch

LEFT JOIN assigned_projects ap
ON ap.project_id IN (
  'CRM-' || e.external_lead_id,
  'CRM-' || el.external_id::text,
  'CRM-' || el.lead_serial_number::text
)

LEFT JOIN employees ape
ON ape.employee_id = ap.employee_id

CROSS JOIN LATERAL (
VALUES
(
CASE WHEN p.employee_id IS NOT NULL THEN
jsonb_build_object(
'name', p.first_name || ' ' || p.last_name,
'role','Photographer',
'employee_id', p.employee_id
)
END
),
(
CASE WHEN v.employee_id IS NOT NULL THEN
jsonb_build_object(
'name', v.first_name || ' ' || v.last_name,
'role','Videographer',
'employee_id', v.employee_id
)
END
),
(
CASE WHEN d.employee_id IS NOT NULL THEN
jsonb_build_object(
'name', d.first_name || ' ' || d.last_name,
'role','Drone',
'employee_id', d.employee_id
)
END
),
(
CASE WHEN at.assistant IS NOT NULL THEN
jsonb_build_object(
'name', at.assistant,
'role','Assistant'
)
END
),
(
CASE WHEN std.employee_id IS NOT NULL THEN
jsonb_build_object(
'name', std.first_name || ' ' || std.last_name,
'role','Save the Date Post',
'employee_id', std.employee_id
)
END
),
(
CASE WHEN stv.employee_id IS NOT NULL THEN
jsonb_build_object(
'name', stv.first_name || ' ' || stv.last_name,
'role','Save the Date Video',
'employee_id', stv.employee_id
)
END
),
(
CASE WHEN rt.employee_id IS NOT NULL THEN
jsonb_build_object(
'name', rt.first_name || ' ' || rt.last_name,
'role','Retouch',
'employee_id', rt.employee_id
)
END
)
) AS team(team_member)

CROSS JOIN LATERAL (
VALUES
(
CASE WHEN ap.id IS NOT NULL THEN
jsonb_build_object(
'project_type', ap.project_type,
'employee_id', ap.employee_id,
'employee_name', COALESCE(NULLIF(TRIM(ape.first_name || ' ' || COALESCE(ape.last_name, '')), ''), ap.employee_id),
'status', ap.status,
'upload_link', ap.upload_link,
'admin_notes', ap.admin_notes
)
END
)
) AS project(project_item)

${phaseWhere}

GROUP BY
e.id,
e.external_lead_id,
e.client_name,
e.event_type,
e.preferred_date,
el.flow_type,
el.current_phase,
el.phase_status,
el.phase_owner,
el.pre_production_step,
e.event_status,
e.media_status,
e.drive_link,
e.video_drive_link,
e.drone_photo_drive_link,
e.drone_video_drive_link,
e.save_the_date_drive_link,
e.save_the_date_submission_status,
e.save_the_video_drive_link,
e.save_the_video_submission_status,
e.retouch_drive_link,
e.retouch_submission_status

ORDER BY e.created_at DESC;
  `

  const result = await pool.query(query, params)

  return result.rows
}

export const updateWorkTrackingQuery = async (id: number, data: any) => {
  const query = `
    UPDATE event_details
    SET client_name = $1, event_type = $2, preferred_date = $3
    WHERE id = $4
    RETURNING *;
  `;
  const result = await pool.query(query, [data.client_name, data.event_type, data.event_date, id]);
  return result.rows[0];
};

export const deleteWorkTrackingQuery = async (id: number) => {
  const query = `DELETE FROM event_details WHERE id = $1`;
  await pool.query(query, [id]);
};
