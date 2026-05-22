import { pool } from "../config/db";
import { CreateNotificationDTO, Notification } from "../types/notification.types";

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

export const createNotificationQuery = async (
  data: CreateNotificationDTO
): Promise<Notification> => {
  const query = `
    INSERT INTO notifications (
      type, title, detail, lead_id, from_role, from_name, target_roles, issue_type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  const values = [
    data.type,
    data.title,
    data.detail || null,
    data.lead_id || null,
    data.from_role || null,
    data.from_name || null,
    data.target_roles,
    data.type, // Set issue_type to same as type for compatibility
  ];

  const result = await pool.query<Notification>(query, values);
  return result.rows[0];
};

export const getNotificationsByRoleQuery = async (
  role: string
): Promise<Notification[]> => {
  const roles = expandNotificationRoles([role]);
  const query = `
    SELECT * FROM notifications 
    WHERE target_roles && $1
    ORDER BY created_at DESC
  `;
  const result = await pool.query<Notification>(query, [roles]);
  return result.rows;
};

export const markNotificationReadQuery = async (
  id: number
): Promise<Notification> => {
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
  role: string
): Promise<void> => {
  const roles = expandNotificationRoles([role]);
  const query = `
    UPDATE notifications
    SET is_read = true
    WHERE target_roles && $1 AND is_read = false
  `;
  await pool.query(query, [roles]);
};

// Multi-role variants
export const getNotificationsByRolesQuery = async (
  roles: string[]
): Promise<Notification[]> => {
  const expandedRoles = expandNotificationRoles(roles);
  const query = `
    SELECT * FROM notifications
    WHERE target_roles && $1
    ORDER BY created_at DESC
  `;
  const result = await pool.query<Notification>(query, [expandedRoles]);
  return result.rows;
};

export const markAllNotificationsReadByRolesQuery = async (
  roles: string[]
): Promise<void> => {
  const expandedRoles = expandNotificationRoles(roles);
  const query = `
    UPDATE notifications
    SET is_read = true
    WHERE target_roles && $1 AND is_read = false
  `;
  await pool.query(query, [expandedRoles]);
};
