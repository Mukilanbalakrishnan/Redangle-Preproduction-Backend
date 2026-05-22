import { pool } from "../config/db";

const normalizeWorkDate = (workDate?: string | null) => {
  if (!workDate) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(workDate);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

export const ensureWorkRuntimeSessionsQuery = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_work_runtime_sessions (
      id SERIAL PRIMARY KEY,
      assigned_project_id INTEGER NOT NULL,
      project_id VARCHAR(100) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      project_type VARCHAR(100),
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
      UNIQUE (assigned_project_id, work_date)
    )
  `);
};

const sessionSelect = `
  wrs.id,
  wrs.assigned_project_id,
  wrs.project_id,
  wrs.employee_id,
  wrs.project_type,
  TO_CHAR(wrs.work_date, 'YYYY-MM-DD') AS work_date,
  wrs.status,
  wrs.started_at,
  wrs.paused_at,
  wrs.ended_at,
  wrs.accumulated_seconds,
  CASE
    WHEN wrs.status = 'started' AND wrs.started_at IS NOT NULL
      THEN wrs.accumulated_seconds + FLOOR(EXTRACT(EPOCH FROM (NOW() - wrs.started_at)))::int
    ELSE wrs.accumulated_seconds
  END AS elapsed_seconds,
  wrs.started_by,
  wrs.ended_by,
  wrs.created_at,
  wrs.updated_at
`;

const getAssignment = async (assignmentId: number) => {
  const result = await pool.query(
    `SELECT id, project_id, project_name, project_type, employee_id, status
     FROM assigned_projects
     WHERE id = $1`,
    [assignmentId]
  );
  return result.rows[0] || null;
};

export const getWorkRuntimeStatusQuery = async (assignmentId: number) => {
  await ensureWorkRuntimeSessionsQuery();
  const assignment = await getAssignment(assignmentId);
  if (!assignment) return null;

  const sessionsResult = await pool.query(
    `SELECT ${sessionSelect}
     FROM employee_work_runtime_sessions wrs
     WHERE wrs.assigned_project_id = $1
     ORDER BY wrs.work_date ASC`,
    [assignmentId]
  );

  const sessions = sessionsResult.rows;
  const currentSession = sessions.find((session) => session.status === "started" || session.status === "paused")
    || sessions[sessions.length - 1]
    || null;
  const totalSeconds = sessions.reduce((sum, session) => sum + Number(session.elapsed_seconds || 0), 0);

  return {
    assignment,
    work_status: currentSession?.status || "not_started",
    sessions,
    current_session: currentSession,
    total_elapsed_seconds: totalSeconds,
  };
};

export const startWorkRuntimeQuery = async (assignmentId: number, startedBy: string, workDate?: string) => {
  await ensureWorkRuntimeSessionsQuery();
  const assignment = await getAssignment(assignmentId);
  if (!assignment) return null;

  const normalizedDate = normalizeWorkDate(workDate);
  const result = await pool.query(
    `
    INSERT INTO employee_work_runtime_sessions (
      assigned_project_id,
      project_id,
      employee_id,
      project_type,
      work_date,
      status,
      started_at,
      started_by
    )
    VALUES ($1, $2, $3, $4, $5::date, 'started', NOW(), $6)
    ON CONFLICT (assigned_project_id, work_date)
    DO UPDATE SET
      status = 'started',
      started_at = CASE
        WHEN employee_work_runtime_sessions.status = 'started' THEN employee_work_runtime_sessions.started_at
        ELSE NOW()
      END,
      paused_at = NULL,
      ended_at = NULL,
      started_by = $6,
      updated_at = NOW()
    RETURNING
      id,
      assigned_project_id,
      project_id,
      employee_id,
      project_type,
      TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date,
      status,
      started_at,
      paused_at,
      ended_at,
      accumulated_seconds,
      accumulated_seconds AS elapsed_seconds,
      started_by,
      ended_by,
      created_at,
      updated_at
    `,
    [assignment.id, assignment.project_id, assignment.employee_id, assignment.project_type, normalizedDate, startedBy]
  );
  return result.rows[0];
};

export const pauseWorkRuntimeQuery = async (assignmentId: number, workDate?: string) => {
  await ensureWorkRuntimeSessionsQuery();
  const normalizedDate = normalizeWorkDate(workDate);

  const result = await pool.query(
    `
    UPDATE employee_work_runtime_sessions wrs
    SET status = 'paused',
        accumulated_seconds = accumulated_seconds + CASE
          WHEN status = 'started' AND started_at IS NOT NULL
            THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)))::int)
          ELSE 0
        END,
        paused_at = NOW(),
        started_at = NULL,
        updated_at = NOW()
    WHERE wrs.assigned_project_id = $1
      AND wrs.work_date = $2::date
      AND wrs.status <> 'ended'
    RETURNING ${sessionSelect}
    `,
    [assignmentId, normalizedDate]
  );
  return result.rows[0] || null;
};

export const endWorkRuntimeQuery = async (assignmentId: number, endedBy?: string, workDate?: string) => {
  await ensureWorkRuntimeSessionsQuery();
  const normalizedDate = normalizeWorkDate(workDate);

  const result = await pool.query(
    `
    UPDATE employee_work_runtime_sessions wrs
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
    WHERE wrs.assigned_project_id = $1
      AND wrs.work_date = $2::date
      AND wrs.status <> 'ended'
    RETURNING ${sessionSelect}
    `,
    [assignmentId, normalizedDate, endedBy || null]
  );
  return result.rows[0] || null;
};

export const getProjectWorkRuntimeSummaryQuery = async (projectId: string) => {
  await ensureWorkRuntimeSessionsQuery();

  const result = await pool.query(
    `
    SELECT
      wrs.assigned_project_id,
      wrs.project_id,
      ap.project_name,
      wrs.employee_id,
      COALESCE(NULLIF(TRIM(e.first_name || ' ' || COALESCE(e.last_name, '')), ''), wrs.employee_id) AS employee_name,
      wrs.project_type,
      TO_CHAR(wrs.work_date, 'YYYY-MM-DD') AS work_date,
      wrs.status,
      SUM(
        CASE
          WHEN wrs.status = 'started' AND wrs.started_at IS NOT NULL
            THEN wrs.accumulated_seconds + FLOOR(EXTRACT(EPOCH FROM (NOW() - wrs.started_at)))::int
          ELSE wrs.accumulated_seconds
        END
      )::int AS elapsed_seconds
    FROM employee_work_runtime_sessions wrs
    LEFT JOIN assigned_projects ap ON ap.id = wrs.assigned_project_id
    LEFT JOIN employees e ON e.employee_id = wrs.employee_id
    WHERE wrs.project_id = $1
    GROUP BY
      wrs.assigned_project_id,
      wrs.project_id,
      ap.project_name,
      wrs.employee_id,
      e.first_name,
      e.last_name,
      wrs.project_type,
      wrs.work_date,
      wrs.status
    ORDER BY wrs.work_date ASC, wrs.project_type ASC
    `,
    [projectId]
  );

  return result.rows;
};
