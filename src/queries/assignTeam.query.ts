import { pool } from "../config/db";
import {
  AssignTeamDTO,
  AssignTeam
} from "../types/assignTeam.types";

const toNullableText = (value?: string | null) => {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNullableDate = (value?: string | null) => {
  const normalized = toNullableText(value);
  return normalized;
};

const toNullableTime = (value?: string | null) => {
  const normalized = toNullableText(value);
  return normalized;
};

export const ensureAssignTeamColumnsQuery = async () => {
  await pool.query(`
    ALTER TABLE assign_teams
    ADD COLUMN IF NOT EXISTS secondary_photographer JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS secondary_videographer JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS drone VARCHAR(100),
    ADD COLUMN IF NOT EXISTS secondary_drone JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS event_photographer VARCHAR(100),
    ADD COLUMN IF NOT EXISTS event_videographer VARCHAR(100),
    ADD COLUMN IF NOT EXISTS event_drone VARCHAR(100),
    ADD COLUMN IF NOT EXISTS event_secondary_photographer JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS event_secondary_videographer JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS event_secondary_drone JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS event_additional_staff JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS event_assignment_date DATE,
    ADD COLUMN IF NOT EXISTS event_assignment_time TIME,
    ADD COLUMN IF NOT EXISTS event_assignment_location TEXT,
    ADD COLUMN IF NOT EXISTS save_the_date VARCHAR(100),
    ADD COLUMN IF NOT EXISTS save_the_video VARCHAR(100),
    ADD COLUMN IF NOT EXISTS retouch VARCHAR(100),
    ADD COLUMN IF NOT EXISTS additional_staff JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS event_date DATE,
    ADD COLUMN IF NOT EXISTS event_time TIME,
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS accepted_by_employees JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS accepted_assignments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS shoot_locations JSONB DEFAULT '[]'::jsonb
  `);
};

export const upsertAssignTeamQuery = async (
  data: AssignTeamDTO
): Promise<AssignTeam> => {
  await ensureAssignTeamColumnsQuery();
  const assignmentPhase = String(data.assignment_phase || "").toLowerCase();

  if (assignmentPhase === "event") {
    const values = [
      String(data.external_lead_id).trim(),
      toNullableText(data.photographer),
      toNullableText(data.videographer),
      toNullableText(data.drone),
      JSON.stringify(data.secondary_photographer || []),
      JSON.stringify(data.secondary_videographer || []),
      JSON.stringify(data.secondary_drone || []),
      JSON.stringify(data.additional_staff || []),
      toNullableDate(data.event_date),
      toNullableTime(data.event_time),
      toNullableText(data.location),
      JSON.stringify(data.shoot_locations || [])
    ];

    const updated = await pool.query<AssignTeam>(
      `UPDATE assign_teams
       SET event_photographer = $2,
           event_videographer = $3,
           event_drone = $4,
           event_secondary_photographer = $5::jsonb,
           event_secondary_videographer = $6::jsonb,
           event_secondary_drone = $7::jsonb,
           event_additional_staff = $8::jsonb,
           event_assignment_date = $9,
           event_assignment_time = $10,
           event_assignment_location = $11,
           shoot_locations = CASE WHEN $12::jsonb IS NOT NULL THEN $12::jsonb ELSE shoot_locations END,
           updated_at = NOW()
       WHERE external_lead_id = $1
       RETURNING *`,
      values
    );

    if (updated.rows[0]) return updated.rows[0];

    const inserted = await pool.query<AssignTeam>(
      `INSERT INTO assign_teams (
         external_lead_id,
         event_photographer,
         event_videographer,
         event_drone,
         event_secondary_photographer,
         event_secondary_videographer,
         event_secondary_drone,
         event_additional_staff,
         event_assignment_date,
         event_assignment_time,
         event_assignment_location,
         shoot_locations
       )
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,$12::jsonb)
       RETURNING *`,
      values
    );

    return inserted.rows[0];
  }

  const query = `
  INSERT INTO assign_teams (
    external_lead_id,
    photographer,
    videographer,
    drone,
    save_the_date,
    save_the_video,
    retouch,
    assistant,
    editor,
    secondary_photographer,
    secondary_videographer,
    secondary_drone,
    additional_staff,
    event_date,
    event_time,
    location,
    shoot_locations
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17::jsonb)

  ON CONFLICT (external_lead_id)
  DO UPDATE SET
    photographer = EXCLUDED.photographer,
    videographer = EXCLUDED.videographer,
    drone = EXCLUDED.drone,
    save_the_date = EXCLUDED.save_the_date,
    save_the_video = EXCLUDED.save_the_video,
    retouch = EXCLUDED.retouch,
    assistant = EXCLUDED.assistant,
    editor = EXCLUDED.editor,
    secondary_photographer = EXCLUDED.secondary_photographer,
    secondary_videographer = EXCLUDED.secondary_videographer,
    secondary_drone = EXCLUDED.secondary_drone,
    additional_staff = EXCLUDED.additional_staff,
    event_date = EXCLUDED.event_date,
    event_time = EXCLUDED.event_time,
    location = EXCLUDED.location,
    shoot_locations = EXCLUDED.shoot_locations,
    updated_at = NOW()

  RETURNING *;
  `;

  const values = [
    String(data.external_lead_id).trim(),
    toNullableText(data.photographer),
    toNullableText(data.videographer),
    toNullableText(data.drone),
    toNullableText(data.save_the_date),
    toNullableText(data.save_the_video),
    toNullableText(data.retouch),
    toNullableText(data.assistant),
    toNullableText(data.editor),
    JSON.stringify(data.secondary_photographer || []),
    JSON.stringify(data.secondary_videographer || []),
    JSON.stringify(data.secondary_drone || []),
    JSON.stringify(data.additional_staff || []),
    toNullableDate(data.event_date),
    toNullableTime(data.event_time),
    toNullableText(data.location),
    JSON.stringify(data.shoot_locations || [])
  ];

  const result = await pool.query<AssignTeam>(query, values);

  return result.rows[0];
};


export const getAssignTeamQuery = async (
  external_lead_id: string,
  assignment_phase?: string
) => {
  await ensureAssignTeamColumnsQuery();

  const result = await pool.query(
    `
    SELECT *
    FROM assign_teams
    WHERE external_lead_id = $1
    LIMIT 1
    `,
    [external_lead_id]
  );

  const row = result.rows[0];
  if (!row || String(assignment_phase || "").toLowerCase() !== "event") return row;

  return {
    ...row,
    photographer: row.event_photographer || "",
    videographer: row.event_videographer || "",
    drone: row.event_drone || "",
    secondary_photographer: row.event_secondary_photographer || [],
    secondary_videographer: row.event_secondary_videographer || [],
    secondary_drone: row.event_secondary_drone || [],
    additional_staff: row.event_additional_staff || [],
    event_date: row.event_assignment_date || null,
    event_time: row.event_assignment_time || null,
    location: row.event_assignment_location || null,
  };
};

const normalizeTaskKey = (taskName?: string | null) =>
  String(taskName || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Accept one concrete assignment/stage for an employee.
export const acceptAssignmentQuery = async (
  external_lead_id: string,
  employee_id: number,
  task_name?: string | null
) => {
  await ensureAssignTeamColumnsQuery();
  const taskKey = normalizeTaskKey(task_name);
  const assignmentKey = taskKey ? `${employee_id}:${taskKey}` : "";

  if (!assignmentKey) {
    throw new Error("taskName is required to accept a specific assignment");
  }

  const result = await pool.query(
    `UPDATE assign_teams at
     SET
       accepted_assignments = COALESCE(at.accepted_assignments, '[]'::jsonb) || $2::jsonb,
       accepted_by_employees = CASE
         WHEN COALESCE(at.accepted_by_employees, '[]'::jsonb) @> $3::jsonb
         THEN COALESCE(at.accepted_by_employees, '[]'::jsonb)
         ELSE COALESCE(at.accepted_by_employees, '[]'::jsonb) || $3::jsonb
       END,
       updated_at = NOW()
     FROM (
       SELECT at2.id
       FROM assign_teams at2
       LEFT JOIN external_leads el
         ON at2.external_lead_id = el.external_id::text
         OR at2.external_lead_id = el.lead_serial_number
       WHERE at2.external_lead_id = $1
         OR el.external_id::text = $1
         OR el.lead_serial_number = $1
       LIMIT 1
     ) match
     WHERE at.id = match.id
     AND NOT (COALESCE(at.accepted_assignments, '[]'::jsonb) @> $2::jsonb)
     RETURNING at.*`,
    [external_lead_id, JSON.stringify([assignmentKey]), JSON.stringify([employee_id])]
  );
  if (result.rows[0]) return result.rows[0];
  // Idempotent: if already accepted, return the current row instead of null
  const existing = await pool.query(
    `SELECT at.*
     FROM assign_teams at
     LEFT JOIN external_leads el
       ON at.external_lead_id = el.external_id::text
       OR at.external_lead_id = el.lead_serial_number
     WHERE at.external_lead_id = $1
       OR el.external_id::text = $1
       OR el.lead_serial_number = $1
     LIMIT 1`,
    [external_lead_id]
  );
  return existing.rows[0];
};

// Get assignment status for a specific lead
export const getAssignmentStatusQuery = async (
  external_lead_id: string
) => {
  await ensureAssignTeamColumnsQuery();
  const result = await pool.query(
    `SELECT at.accepted, at.accepted_by_employees, at.accepted_assignments
     FROM assign_teams at
     LEFT JOIN external_leads el
       ON at.external_lead_id = el.external_id::text
       OR at.external_lead_id = el.lead_serial_number
     WHERE at.external_lead_id = $1
       OR el.external_id::text = $1
       OR el.lead_serial_number = $1
     LIMIT 1`,
    [external_lead_id]
  );
  return result.rows[0];
};

// Update file_path resource for a specific lead
export const updateResourcesQuery = async (
  external_lead_id: string,
  file_path: string
) => {
  await ensureAssignTeamColumnsQuery();
  const result = await pool.query(
    `UPDATE assign_teams
     SET file_path = $2, updated_at = NOW()
     WHERE external_lead_id = $1
     RETURNING *`,
    [external_lead_id, file_path]
  );
  return result.rows[0];
};
