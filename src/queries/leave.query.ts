import { pool } from "../config/db";
import { CreateLeaveRequestDTO, UpdateLeaveStatusDTO, LeaveRecord } from "../types/leave.types";

const normalizeEmployeeIdTargets = (id: string | number): string[] => {
  const raw = String(id || "").trim();
  const numeric = raw.replace(/\D/g, "");
  const unpaddedNumeric = numeric ? String(Number(numeric)) : "";

  if (!raw || !numeric || Number.isNaN(Number(unpaddedNumeric)) || Number(unpaddedNumeric) <= 0) {
    throw new Error(`Invalid employee ID: ${id}`);
  }

  return Array.from(new Set([
    raw,
    raw.toUpperCase(),
    numeric,
    unpaddedNumeric,
    `EMP-${numeric}`,
    `EMP-${unpaddedNumeric}`,
  ].filter(Boolean)));
};

const employeeJoinSql = `
  LEFT JOIN employees e
    ON e.employee_id = l.employee_id
    OR e.employee_id = ('EMP-' || regexp_replace(l.employee_id::text, '\\D', '', 'g'))
    OR regexp_replace(e.employee_id::text, '\\D', '', 'g') = regexp_replace(l.employee_id::text, '\\D', '', 'g')
`;

const canonicalEmployeeId = async (id: string | number) => {
  const targets = normalizeEmployeeIdTargets(id);
  const result = await pool.query(
    `SELECT employee_id FROM employees
     WHERE employee_id = ANY($1::text[])
        OR regexp_replace(employee_id::text, '\\D', '', 'g') = regexp_replace($2::text, '\\D', '', 'g')
     LIMIT 1`,
    [targets, String(id)]
  );
  return result.rows[0]?.employee_id || targets.find(value => value.startsWith("EMP-")) || String(id);
};

export const createLeaveTablesQuery = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_leave_requests (
      leave_request_id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL,
      leave_type VARCHAR(50) NOT NULL,
      from_date DATE NOT NULL,
      to_date DATE NOT NULL,
      no_of_days INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'Pending',
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Ensure employee_id is VARCHAR
  await pool.query(`
    ALTER TABLE employee_leave_requests ALTER COLUMN employee_id TYPE VARCHAR(50) USING employee_id::VARCHAR;
  `).catch(() => {});

  // Fix legacy records: convert bare integer employee_ids to EMP-XXX format
  await pool.query(`
    UPDATE employee_leave_requests
    SET employee_id = 'EMP-' || employee_id::text
    WHERE employee_id::text !~ '^EMP-'
      AND employee_id::text ~ '^[0-9]+$';
  `);
};

export const createLeaveRequestQuery = async (data: CreateLeaveRequestDTO): Promise<LeaveRecord> => {
  const employeeId = await canonicalEmployeeId(data.employee_id);
  const result = await pool.query(
    `
    INSERT INTO employee_leave_requests (employee_id, leave_type, from_date, to_date, no_of_days, reason, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
    RETURNING *;
    `,
    [employeeId, data.leave_type, data.from_date, data.to_date, data.no_of_days, data.reason]
  );
  return result.rows[0];
};

export const getLeaveRequestsByEmployeeQuery = async (employee_id: string): Promise<LeaveRecord[]> => {
  const targets = normalizeEmployeeIdTargets(employee_id);
  const result = await pool.query(
    `
    SELECT l.*, e.first_name || ' ' || COALESCE(e.last_name, '') as employee_name, e.role
    FROM employee_leave_requests l
    ${employeeJoinSql}
    WHERE l.employee_id = ANY($1::text[])
       OR regexp_replace(l.employee_id::text, '\\D', '', 'g') = regexp_replace($2::text, '\\D', '', 'g')
    ORDER BY l.created_at DESC
    `,
    [targets, employee_id]
  );
  return result.rows;
};

export const getAllLeaveRequestsQuery = async (viewer_role?: string): Promise<LeaveRecord[]> => {
  // Admin sees all leave requests
  if (!viewer_role || viewer_role === 'admin') {
    const result = await pool.query(`
      SELECT l.*, e.first_name || ' ' || COALESCE(e.last_name, '') as employee_name, e.role
      FROM employee_leave_requests l
      ${employeeJoinSql}
      ORDER BY l.created_at DESC
    `);
    return result.rows;
  }

  // CRM sees: regular employees + media (photographer/videographer/drone)
  // Does NOT see: admin, other crm, event-coordinator, data-manager, operational-manager
  if (viewer_role === 'crm') {
    const result = await pool.query(`
      SELECT l.*, e.first_name || ' ' || COALESCE(e.last_name, '') as employee_name, e.role
      FROM employee_leave_requests l
      ${employeeJoinSql}
      WHERE e.role NOT IN ('admin', 'crm', 'event-coordinator', 'data-manager', 'operational-manager')
      ORDER BY l.created_at DESC
    `);
    return result.rows;
  }

  // Event Coordinator sees: regular employees + media
  // Does NOT see: admin, crm, other event-coordinator, data-manager, operational-manager
  if (viewer_role === 'event-coordinator') {
    const result = await pool.query(`
      SELECT l.*, e.first_name || ' ' || COALESCE(e.last_name, '') as employee_name, e.role
      FROM employee_leave_requests l
      ${employeeJoinSql}
      WHERE e.role NOT IN ('admin', 'crm', 'event-coordinator', 'data-manager', 'operational-manager')
      ORDER BY l.created_at DESC
    `);
    return result.rows;
  }

  // Data Manager sees: regular employees only (not media since media is managed by CRM/Event)
  // Does NOT see: admin, crm, event-coordinator, data-manager, operational-manager, photographer, videographer, drone
  if (viewer_role === 'data-manager') {
    const result = await pool.query(`
      SELECT l.*, e.first_name || ' ' || COALESCE(e.last_name, '') as employee_name, e.role
      FROM employee_leave_requests l
      ${employeeJoinSql}
      WHERE e.role NOT IN ('admin', 'crm', 'event-coordinator', 'data-manager', 'operational-manager', 'photographer', 'videographer', 'drone')
      ORDER BY l.created_at DESC
    `);
    return result.rows;
  }

  // Operational Manager sees: post-production employees only
  if (viewer_role === 'operational-manager') {
    const result = await pool.query(`
      SELECT l.*, e.first_name || ' ' || COALESCE(e.last_name, '') as employee_name, e.role
      FROM employee_leave_requests l
      ${employeeJoinSql}
      WHERE e.role IN ('traditional-video-editor', 'retouch-editor', 'album-designer')
      ORDER BY l.created_at DESC
    `);
    return result.rows;
  }

  // Media roles and regular employees shouldn't fetch global leaves
  return [];
};

export const updateLeaveStatusQuery = async (id: number, data: UpdateLeaveStatusDTO): Promise<LeaveRecord> => {
  const result = await pool.query(
    `
    UPDATE employee_leave_requests
    SET status = $1, updated_at = NOW()
    WHERE leave_request_id = $2
    RETURNING *;
    `,
    [data.status, id]
  );
  return result.rows[0];
};
