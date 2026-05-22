import { pool } from "../config/db";
import { MasterAdminClient, MasterAdminListFilters } from "../types/masterAdmin.types";

const normalizeFlow = (flow?: string) =>
  ["pre_wedding", "post_wedding"].includes(String(flow || "")) ? String(flow) : "all";

const normalizePhase = (phase?: string) =>
  ["pre_production", "event", "post_production"].includes(String(phase || "")) ? String(phase) : "all";

const numberValue = (value: unknown) => Number(value || 0);

const buildClientWhere = (filters: MasterAdminListFilters = {}, startIndex = 1) => {
  const where: string[] = [];
  const values: unknown[] = [];
  let index = startIndex;

  const flowType = normalizeFlow(filters.flowType);
  if (flowType !== "all") {
    where.push(`COALESCE(e.flow_type, '') = $${index++}`);
    values.push(flowType);
  }

  const phase = normalizePhase(filters.phase);
  if (phase !== "all") {
    where.push(`COALESCE(e.current_phase, 'not_started') = $${index++}`);
    values.push(phase);
  }

  if (filters.status && filters.status !== "all") {
    where.push(`LOWER(COALESCE(e.status, '')) = LOWER($${index++})`);
    values.push(filters.status);
  }

  if (filters.fromDate) {
    where.push(`COALESCE(ed.preferred_date, e.event_date)::date >= $${index++}::date`);
    values.push(filters.fromDate);
  }

  if (filters.toDate) {
    where.push(`COALESCE(ed.preferred_date, e.event_date)::date <= $${index++}::date`);
    values.push(filters.toDate);
  }

  if (filters.search) {
    where.push(`(
      e.external_id::text ILIKE $${index}
      OR COALESCE(e.lead_serial_number, '') ILIKE $${index}
      OR COALESCE(e.lead_name, '') ILIKE $${index}
      OR COALESCE(e.email, '') ILIKE $${index}
      OR COALESCE(e.phone, '') ILIKE $${index}
    )`);
    values.push(`%${filters.search}%`);
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
};

const mapClient = (row: any): MasterAdminClient => ({
  id: String(row.id ?? ""),
  serialNumber: row.serialNumber || String(row.id ?? ""),
  name: row.name || "Unknown Client",
  email: row.email || "-",
  phone: row.phone || "-",
  location: row.location || "-",
  eventType: row.eventType || "-",
  eventDate: row.eventDate || null,
  flowType: row.flowType || "Not selected",
  currentPhase: row.currentPhase || "not_started",
  phaseStatus: row.phaseStatus || "not_started",
  phaseOwner: row.phaseOwner || "-",
  preProductionStep: row.preProductionStep || "-",
  assignmentStatus: row.assignmentStatus || "Unassigned",
  assignedTeamSummary: row.assignedTeamSummary || "Unassigned",
  invoiceId: row.invoiceId || "-",
  invoiceTotal: numberValue(row.invoiceTotal),
  invoicePaid: numberValue(row.invoicePaid),
  invoiceBalance: numberValue(row.invoiceBalance),
  status: row.status || "new",
  createdAt: row.createdAt || null,
});

const clientSelect = `
  SELECT
    e.external_id::text AS "id",
    e.lead_serial_number AS "serialNumber",
    e.lead_name AS "name",
    e.email,
    e.phone,
    e.location,
    e.event_type AS "eventType",
    COALESCE(ed.preferred_date, e.event_date) AS "eventDate",
    COALESCE(e.flow_type, '') AS "flowType",
    COALESCE(e.current_phase, 'not_started') AS "currentPhase",
    COALESCE(e.phase_status, 'not_started') AS "phaseStatus",
    COALESCE(e.phase_owner, '') AS "phaseOwner",
    COALESCE(e.pre_production_step, '') AS "preProductionStep",
    e.invoice_id AS "invoiceId",
    COALESCE(e.invoice_total, 0) AS "invoiceTotal",
    COALESCE(e.invoice_paid, 0) AS "invoicePaid",
    COALESCE(e.invoice_balance, 0) AS "invoiceBalance",
    e.status,
    e.created_at AS "createdAt",
    CASE WHEN at.external_lead_id IS NULL THEN 'Unassigned' ELSE 'Assigned' END AS "assignmentStatus",
    COALESCE(
      NULLIF(CONCAT_WS(
        ', ',
        CASE WHEN at.photographer IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), at.photographer) END,
        CASE WHEN at.videographer IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', v.first_name, v.last_name)), ''), at.videographer) END,
        CASE WHEN at.drone IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.first_name, d.last_name)), ''), at.drone) END,
        CASE WHEN at.save_the_date IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', std.first_name, std.last_name)), ''), at.save_the_date) END,
        CASE WHEN at.save_the_video IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', stv.first_name, stv.last_name)), ''), at.save_the_video) END,
        CASE WHEN at.retouch IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', rt.first_name, rt.last_name)), ''), at.retouch) END
      ), ''),
      'Unassigned'
    ) AS "assignedTeamSummary"
  FROM external_leads e
  LEFT JOIN event_details ed
    ON ed.external_lead_id = e.external_id::text
    OR ed.external_lead_id = e.lead_serial_number
  LEFT JOIN assign_teams at
    ON at.external_lead_id = e.external_id::text
    OR at.external_lead_id = e.lead_serial_number
  LEFT JOIN employees p ON p.employee_id = at.photographer
  LEFT JOIN employees v ON v.employee_id = at.videographer
  LEFT JOIN employees d ON d.employee_id = at.drone
  LEFT JOIN employees std ON std.employee_id = at.save_the_date
  LEFT JOIN employees stv ON stv.employee_id = at.save_the_video
  LEFT JOIN employees rt ON rt.employee_id = at.retouch
`;

export const getMasterAdminClients = async (filters: MasterAdminListFilters = {}) => {
  const where = buildClientWhere(filters);
  const result = await pool.query(
    `${clientSelect}
     ${where.clause}
     ORDER BY e.created_at DESC`,
    where.values
  );
  return result.rows.map(mapClient);
};

export const getMasterAdminClient = async (clientId: string) => {
  const result = await pool.query(
    `${clientSelect}
     WHERE e.external_id::text = $1 OR e.lead_serial_number = $1
     ORDER BY e.created_at DESC
     LIMIT 1`,
    [clientId]
  );
  return result.rows[0] ? mapClient(result.rows[0]) : null;
};

export const getMasterAdminDashboard = async () => {
  const clients = await getMasterAdminClients();
  const preWedding = clients.filter(c => c.flowType === "pre_wedding");
  const postWedding = clients.filter(c => c.flowType === "post_wedding");
  const activeClients = clients.filter(c => !["completed", "cancelled"].includes(c.status.toLowerCase()));
  const completedClients = clients.filter(c =>
    c.status.toLowerCase() === "completed" || ["event", "post_production"].includes(c.currentPhase)
  );

  const [workResult, employeeResult, attendanceResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS count FROM lead_employee`).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query(`SELECT COUNT(*) AS count FROM employees`).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Present') AS present,
        COUNT(*) FILTER (WHERE status = 'Absent') AS absent
      FROM employees_attendance
      WHERE date = CURRENT_DATE
    `).catch(() => ({ rows: [{ total: 0, present: 0, absent: 0 }] })),
  ]);

  const summarize = (items: MasterAdminClient[]) => ({
    clients: items.length,
    activeClients: items.filter(c => !["completed", "cancelled"].includes(c.status.toLowerCase())).length,
    completedClients: items.filter(c => c.status.toLowerCase() === "completed").length,
    invoiceTotal: items.reduce((sum, c) => sum + c.invoiceTotal, 0),
    invoicePaid: items.reduce((sum, c) => sum + c.invoicePaid, 0),
    invoiceBalance: items.reduce((sum, c) => sum + c.invoiceBalance, 0),
  });

  return {
    combined: {
      totalClients: clients.length,
      activeClients: activeClients.length,
      completedClients: completedClients.length,
      pendingFollowUps: clients.filter(c => ["contacted", "pending"].includes(c.status.toLowerCase())).length,
      assignedEmployees: numberValue(employeeResult.rows[0]?.count),
      openWorkItems: numberValue(workResult.rows[0]?.count),
      invoiceTotal: clients.reduce((sum, c) => sum + c.invoiceTotal, 0),
      invoicePaid: clients.reduce((sum, c) => sum + c.invoicePaid, 0),
      invoiceBalance: clients.reduce((sum, c) => sum + c.invoiceBalance, 0),
    },
    breakdown: {
      preWedding: summarize(preWedding),
      postWedding: summarize(postWedding),
    },
    recentClients: clients.slice(0, 8),
    attendanceSummary: {
      total: numberValue(attendanceResult.rows[0]?.total),
      present: numberValue(attendanceResult.rows[0]?.present),
      absent: numberValue(attendanceResult.rows[0]?.absent),
    },
  };
};

export const getMasterAdminEmployees = async (filters: MasterAdminListFilters = {}) => {
  const where = buildClientWhere(filters, 1);
  const result = await pool.query(
    `WITH client_scope AS (
      SELECT e.external_id::text, e.lead_serial_number, e.flow_type
      FROM external_leads e
      LEFT JOIN event_details ed
        ON ed.external_lead_id = e.external_id::text
        OR ed.external_lead_id = e.lead_serial_number
      ${where.clause}
    ),
    assignments AS (
      SELECT assignment.employee_id, cs.flow_type, assignment.task_name
      FROM client_scope cs
      JOIN assign_teams at
        ON at.external_lead_id = cs.external_id
        OR at.external_lead_id = cs.lead_serial_number
      CROSS JOIN LATERAL (
        VALUES
          (at.photographer, 'Photographer'),
          (at.videographer, 'Videographer'),
          (at.drone, 'Drone'),
          (at.save_the_date, 'Save the Date'),
          (at.save_the_video, 'Save the Video'),
          (at.retouch, 'Retouch'),
          (at.editor, 'Editor'),
          (at.assistant, 'Assistant')
      ) AS assignment(employee_id, task_name)
      WHERE assignment.employee_id IS NOT NULL AND assignment.employee_id <> ''
    )
    SELECT
      COALESCE(e.employee_id, a.employee_id) AS "employeeId",
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', e.first_name, e.last_name)), ''), a.employee_id) AS "name",
      COALESCE(e.role, MAX(a.task_name)) AS "role",
      COUNT(*) AS "currentTasks",
      COUNT(DISTINCT a.flow_type) AS "flowCount",
      STRING_AGG(DISTINCT COALESCE(a.flow_type, 'unknown'), ', ') AS "flowInvolvement",
      ea.status AS "attendanceToday",
      MAX(a.task_name) AS "lastActivity"
    FROM assignments a
    LEFT JOIN employees e ON e.employee_id = a.employee_id
    LEFT JOIN employees_attendance ea
      ON ea.employee_id = CAST(REPLACE(COALESCE(e.employee_id, '0'), 'EMP-', '') AS INTEGER)
      AND ea.date = CURRENT_DATE
    GROUP BY e.employee_id, a.employee_id, e.first_name, e.last_name, e.role, ea.status
    ORDER BY "name" ASC`,
    where.values
  );
  return result.rows;
};

export const getMasterAdminWorkTracker = async (filters: MasterAdminListFilters = {}, clientId?: string) => {
  const where = buildClientWhere(filters, 1);
  const clientClause = clientId
    ? `${where.clause ? `${where.clause} AND` : "WHERE"} (e.external_id::text = $${where.values.length + 1} OR e.lead_serial_number = $${where.values.length + 1})`
    : where.clause;
  const values = clientId ? [...where.values, clientId] : where.values;

  const result = await pool.query(
    `SELECT
      le.lead_employee_id AS "id",
      e.external_id::text AS "clientId",
      e.lead_serial_number AS "serialNumber",
      e.lead_name AS "client",
      COALESCE(e.flow_type, '') AS "flowType",
      COALESCE(e.current_phase, 'not_started') AS "currentPhase",
      le.task_name AS "task",
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', emp.first_name, emp.last_name)), ''), le.employee_id) AS "employee",
      emp.role,
      le.priority AS "priority",
      COALESCE(le.status, le.priority, 'Pending') AS "status",
      le.created_at AS "startDate",
      le.deadline AS "deadline"
    FROM external_leads e
    LEFT JOIN event_details ed
      ON ed.external_lead_id = e.external_id::text
      OR ed.external_lead_id = e.lead_serial_number
    JOIN lead_employee le
      ON le.lead_id::text = e.external_id::text
      OR le.lead_id::text = e.lead_serial_number
    LEFT JOIN employees emp ON emp.employee_id = le.employee_id
    ${clientClause}
    ORDER BY le.created_at DESC`,
    values
  ).catch(() => ({ rows: [] }));

  return result.rows;
};

export const getMasterAdminInvoices = async (filters: MasterAdminListFilters = {}, clientId?: string) => {
  const clients = clientId
    ? (await getMasterAdminClient(clientId) ? [await getMasterAdminClient(clientId)] : [])
    : await getMasterAdminClients(filters);

  return clients.filter(Boolean).map(client => ({
    invoiceId: client!.invoiceId,
    clientId: client!.id,
    serialNumber: client!.serialNumber,
    client: client!.name,
    flowType: client!.flowType,
    eventType: client!.eventType,
    total: client!.invoiceTotal,
    paid: client!.invoicePaid,
    balance: client!.invoiceBalance,
    status: client!.invoiceBalance <= 0 && client!.invoiceTotal > 0 ? "Paid" : client!.invoicePaid > 0 ? "Partial" : "Pending",
    dueDate: client!.eventDate,
  }));
};

export const getMasterAdminAttendance = async (filters: MasterAdminListFilters = {}, clientId?: string) => {
  const employees = clientId
    ? await getMasterAdminClientEmployees(clientId)
    : await getMasterAdminEmployees(filters);
  const ids = employees.map((employee: any) => String(employee.employeeId || "").replace("EMP-", "")).filter(Boolean);

  if (ids.length === 0) return [];

  const result = await pool.query(
    `SELECT
      ea.attendance_id AS "id",
      COALESCE(e.employee_id, 'EMP-' || ea.employee_id::text) AS "employeeId",
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', e.first_name, e.last_name)), ''), 'Employee ' || ea.employee_id::text) AS "employee",
      e.role,
      ea.date,
      ea.check_in AS "checkIn",
      ea.check_out AS "checkOut",
      ea.status
    FROM employees_attendance ea
    LEFT JOIN employees e ON ea.employee_id = CAST(REPLACE(e.employee_id, 'EMP-', '') AS INTEGER)
    WHERE ea.employee_id = ANY($1::int[])
    ORDER BY ea.date DESC, "employee" ASC`,
    [ids.map(Number).filter(n => !Number.isNaN(n))]
  ).catch(() => ({ rows: [] }));

  return result.rows;
};

export const getMasterAdminClientEmployees = async (clientId: string) => {
  const result = await pool.query(
    `WITH matched AS (
      SELECT at.*
      FROM assign_teams at
      LEFT JOIN external_leads e
        ON at.external_lead_id = e.external_id::text
        OR at.external_lead_id = e.lead_serial_number
      WHERE at.external_lead_id = $1
        OR e.external_id::text = $1
        OR e.lead_serial_number = $1
      LIMIT 1
    )
    SELECT
      assignment.group_name AS "group",
      assignment.task_name AS "task",
      COALESCE(emp.employee_id, assignment.employee_id) AS "employeeId",
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', emp.first_name, emp.last_name)), ''), assignment.employee_id) AS "name",
      COALESCE(emp.role, assignment.task_name) AS "role"
    FROM matched m
    CROSS JOIN LATERAL (
      VALUES
        ('Shoot team', 'Photographer', m.photographer),
        ('Shoot team', 'Videographer', m.videographer),
        ('Shoot team', 'Drone', m.drone),
        ('Editing team', 'Save the Date', m.save_the_date),
        ('Editing team', 'Save the Video', m.save_the_video),
        ('Editing team', 'Retouch', m.retouch),
        ('Editing team', 'Editor', m.editor),
        ('Shoot team', 'Assistant', m.assistant)
    ) AS assignment(group_name, task_name, employee_id)
    LEFT JOIN employees emp ON emp.employee_id = assignment.employee_id
    WHERE assignment.employee_id IS NOT NULL AND assignment.employee_id <> ''
    ORDER BY assignment.group_name, assignment.task_name`,
    [clientId]
  ).catch(() => ({ rows: [] }));

  return result.rows;
};

export const getMasterAdminReports = async (filters: MasterAdminListFilters = {}) => {
  const [dashboard, workTracker, employees] = await Promise.all([
    getMasterAdminDashboard(),
    getMasterAdminWorkTracker(filters),
    getMasterAdminEmployees(filters),
  ]);

  return {
    conversion: dashboard.breakdown,
    assignmentLoad: employees,
    workCompletion: {
      total: workTracker.length,
      completed: workTracker.filter((item: any) => String(item.status).toLowerCase().includes("complete")).length,
      pending: workTracker.filter((item: any) => !String(item.status).toLowerCase().includes("complete")).length,
    },
    invoiceCollection: dashboard.combined,
    attendance: dashboard.attendanceSummary,
  };
};

export const getMasterAdminClientReport = async (clientId: string) => {
  const [client, employees, workTracker, invoices, attendance] = await Promise.all([
    getMasterAdminClient(clientId),
    getMasterAdminClientEmployees(clientId),
    getMasterAdminWorkTracker({}, clientId),
    getMasterAdminInvoices({}, clientId),
    getMasterAdminAttendance({}, clientId),
  ]);

  return {
    client,
    assignmentSummary: employees,
    workProgress: {
      total: workTracker.length,
      completed: workTracker.filter((item: any) => String(item.status).toLowerCase().includes("complete")).length,
      pending: workTracker.filter((item: any) => !String(item.status).toLowerCase().includes("complete")).length,
    },
    invoiceSummary: invoices[0] || null,
    attendanceSummary: attendance,
    blockers: workTracker.filter((item: any) => ["pending", "blocked", "rework"].some(status => String(item.status).toLowerCase().includes(status))),
  };
};
