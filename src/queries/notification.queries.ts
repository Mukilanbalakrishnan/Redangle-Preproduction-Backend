import { pool } from "../config/db";
import { CreateNotificationDTO, Notification } from "../types/notification.types";

export interface NotificationFilters {
  type?: string;
  source_stage?: string;
  from_role?: string;
  roles?: string[];
  employee_id?: string;
}

const notificationRoleAliases: Record<string, string[]> = {
  "pre-production-crm": ["pre-production-crm", "crm"],
  "post-production-crm": ["post-production-crm", "event-crm", "crm"],
  "event-crm": ["post-production-crm", "event-crm", "crm"],
  "data_manager": ["data_manager", "data-manager", "data-management"],
  "data-manager": ["data_manager", "data-manager", "data-management"],
  "data-management": ["data_manager", "data-manager", "data-management"],
  "event_coordinator": ["event_coordinator", "event-coordinator"],
  "event-coordinator": ["event_coordinator", "event-coordinator"],
  "operational_manager": ["operational_manager", "operational-manager"],
  "operational-manager": ["operational_manager", "operational-manager"],
};

const expandNotificationRoles = (roles: string[]) => {
  const expanded = roles.flatMap(role => {
    const normalized = String(role || "").trim();
    return notificationRoleAliases[normalized] || [normalized];
  });
  return Array.from(new Set(expanded.filter(Boolean)));
};

const shouldUseGlobalAdminScope = (roles: string[]) => roles.includes("admin");

const normalizeEmployeeTargets = (employeeId?: string | null) => {
  const raw = String(employeeId || "").trim();
  if (!raw) return [];
  const numeric = raw.replace(/\D/g, "");
  const unpaddedNumeric = numeric ? String(Number(numeric)) : "";
  return Array.from(new Set([
    raw,
    raw.toUpperCase(),
    numeric,
    unpaddedNumeric,
    numeric ? `EMP-${numeric}` : "",
    unpaddedNumeric ? `EMP-${unpaddedNumeric}` : "",
  ].filter(Boolean)));
};

export const ensureNotificationTableQuery = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      detail TEXT,
      lead_id INTEGER,
      from_role VARCHAR(100),
      from_name VARCHAR(255),
      target_roles TEXT[] DEFAULT '{}'::text[],
      issue_type VARCHAR(100),
      target_employee_id VARCHAR(50),
      source_stage VARCHAR(30),
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS notification_id INTEGER,
      ADD COLUMN IF NOT EXISTS issue_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS from_role VARCHAR(100),
      ADD COLUMN IF NOT EXISTS from_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS target_employee_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS source_stage VARCHAR(30),
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS idx_notifications_target_roles ON notifications USING GIN (target_roles);
    CREATE INDEX IF NOT EXISTS idx_notifications_target_employee ON notifications(target_employee_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_source_stage ON notifications(source_stage);
  `);
};

export const createNotificationQuery = async (
  data: CreateNotificationDTO
): Promise<Notification> => {
  await ensureNotificationTableQuery();
  const query = `
    INSERT INTO notifications (
      type, title, detail, lead_id, from_role, from_name, target_roles, issue_type, target_employee_id, source_stage
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;
  const values = [
    data.type,
    data.title,
    data.detail || null,
    data.lead_id || null,
    data.from_role || null,
    data.from_name || null,
    data.target_roles || [],
    data.type,
    data.target_employee_id || null,
    data.source_stage || null,
  ];

  const result = await pool.query<Notification>(query, values);
  return result.rows[0];
};

export const getNotificationsByRoleQuery = async (
  role: string,
  employee_id?: string
): Promise<Notification[]> => {
  await ensureNotificationTableQuery();
  const expandedRoles = expandNotificationRoles([role]);
  const employeeTargets = normalizeEmployeeTargets(employee_id);
  const scopeClause = shouldUseGlobalAdminScope(expandedRoles)
    ? "($1::text[] IS NOT NULL OR $2::text[] IS NOT NULL)"
    : "target_roles && $1 OR ($2::text[] <> '{}'::text[] AND target_employee_id = ANY($2::text[]))";

  const query = `
    SELECT * FROM notifications 
    WHERE ${scopeClause}
    ORDER BY created_at DESC
  `;
  const result = await pool.query<Notification>(query, [expandedRoles, employeeTargets]);
  return result.rows;
};

export const markNotificationReadQuery = async (
  id: number
): Promise<Notification> => {
  await ensureNotificationTableQuery();
  const query = `
    UPDATE notifications 
    SET is_read = true 
    WHERE id = $1 
    RETURNING *;
  `;
  const result = await pool.query<Notification>(query, [id]);
  return result.rows[0];
};

export const markAllNotificationsReadQuery = async (
  role: string,
  employee_id?: string
): Promise<void> => {
  await ensureNotificationTableQuery();
  const expandedRoles = expandNotificationRoles([role]);
  const employeeTargets = normalizeEmployeeTargets(employee_id);
  const scopeClause = shouldUseGlobalAdminScope(expandedRoles)
    ? "($1::text[] IS NOT NULL OR $2::text[] IS NOT NULL)"
    : "target_roles && $1 OR ($2::text[] <> '{}'::text[] AND target_employee_id = ANY($2::text[]))";

  const query = `
    UPDATE notifications
    SET is_read = true
    WHERE (${scopeClause}) AND is_read = false
  `;
  await pool.query(query, [expandedRoles, employeeTargets]);
};

// Multi-role variants
export const getNotificationsByRolesQuery = async (
  roles: string[],
  employee_id?: string
): Promise<Notification[]> => {
  await ensureNotificationTableQuery();
  const expandedRoles = expandNotificationRoles(roles);
  const employeeTargets = normalizeEmployeeTargets(employee_id);
  const scopeClause = shouldUseGlobalAdminScope(expandedRoles)
    ? "($1::text[] IS NOT NULL OR $2::text[] IS NOT NULL)"
    : "target_roles && $1 OR ($2::text[] <> '{}'::text[] AND target_employee_id = ANY($2::text[]))";

  const query = `
    SELECT * FROM notifications
    WHERE ${scopeClause}
    ORDER BY created_at DESC
  `;
  const result = await pool.query<Notification>(query, [expandedRoles, employeeTargets]);
  return result.rows;
};

export const markAllNotificationsReadByRolesQuery = async (
  roles: string[],
  employee_id?: string
): Promise<void> => {
  await ensureNotificationTableQuery();
  const expandedRoles = expandNotificationRoles(roles);
  const employeeTargets = normalizeEmployeeTargets(employee_id);
  const scopeClause = shouldUseGlobalAdminScope(expandedRoles)
    ? "($1::text[] IS NOT NULL OR $2::text[] IS NOT NULL)"
    : "target_roles && $1 OR ($2::text[] <> '{}'::text[] AND target_employee_id = ANY($2::text[]))";

  const query = `
    UPDATE notifications
    SET is_read = true
    WHERE (${scopeClause}) AND is_read = false
  `;
  await pool.query(query, [expandedRoles, employeeTargets]);
};

export const getNotificationsFilteredQuery = async (
  filters: NotificationFilters
): Promise<Notification[]> => {
  await ensureNotificationTableQuery();
  const values: any[] = [];
  const clauses: string[] = [];

  if (filters.roles?.length) {
    const expandedRoles = expandNotificationRoles(filters.roles);
    if (!shouldUseGlobalAdminScope(expandedRoles)) {
      values.push(expandedRoles);
      clauses.push(`target_roles && $${values.length}`);
    }
  }

  const employeeTargets = normalizeEmployeeTargets(filters.employee_id);
  if (employeeTargets.length) {
    values.push(employeeTargets);
    clauses.push(`target_employee_id = ANY($${values.length}::text[])`);
  }

  const scopeClause = clauses.length ? `(${clauses.join(" OR ")})` : "TRUE";
  const filterClauses = [scopeClause];

  if (filters.type) {
    values.push(filters.type);
    filterClauses.push(`type = $${values.length}`);
  }

  if (filters.source_stage) {
    values.push(filters.source_stage);
    filterClauses.push(`source_stage = $${values.length}`);
  }

  if (filters.from_role) {
    values.push(filters.from_role);
    filterClauses.push(`from_role = $${values.length}`);
  }

  const result = await pool.query<Notification>(
    `SELECT * FROM notifications WHERE ${filterClauses.join(" AND ")} ORDER BY created_at DESC`,
    values
  );
  return result.rows;
};

export const clearNotificationsQuery = async (filters: {
  roles?: string[];
  employee_id?: string;
}): Promise<number> => {
  await ensureNotificationTableQuery();
  const values: any[] = [];
  const clauses: string[] = [];
  const expandedRoles = filters.roles?.length ? expandNotificationRoles(filters.roles) : [];

  if (expandedRoles.length && !shouldUseGlobalAdminScope(expandedRoles)) {
    values.push(expandedRoles);
    clauses.push(`target_roles && $${values.length}`);
  }

  const employeeTargets = normalizeEmployeeTargets(filters.employee_id);
  if (employeeTargets.length) {
    values.push(employeeTargets);
    clauses.push(`target_employee_id = ANY($${values.length}::text[])`);
  }

  const scopeClause = shouldUseGlobalAdminScope(expandedRoles)
    ? "TRUE"
    : clauses.length
      ? `(${clauses.join(" OR ")})`
      : "FALSE";

  const result = await pool.query(`DELETE FROM notifications WHERE ${scopeClause}`, values);
  return result.rowCount || 0;
};
