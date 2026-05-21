import { pool } from "../config/db";

export const getUserRolesQuery = async (userId: number) => {
  const result = await pool.query(
    `SELECT id, name, email, role, roles FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

export const addRoleToUserQuery = async (userId: number, newRole: string) => {
  const result = await pool.query(
    `UPDATE users
     SET roles = array_append(roles, $2)
     WHERE id = $1 AND NOT ($2 = ANY(COALESCE(roles, '{}')))
     RETURNING id, name, email, role, roles`,
    [userId, newRole]
  );
  return result.rows[0] || null;
};

export const removeRoleFromUserQuery = async (userId: number, roleToRemove: string) => {
  const result = await pool.query(
    `UPDATE users
     SET roles = array_remove(roles, $2),
         role = CASE WHEN role = $2 THEN (SELECT unnest(array_remove(roles, $2)) LIMIT 1) ELSE role END
     WHERE id = $1
     RETURNING id, name, email, role, roles`,
    [userId, roleToRemove]
  );
  return result.rows[0] || null;
};

export const setUserRolesQuery = async (userId: number, roles: string[]) => {
  const primaryRole = roles[0] || null;
  const result = await pool.query(
    `UPDATE users
     SET roles = $2, role = $3
     WHERE id = $1
     RETURNING id, name, email, role, roles`,
    [userId, roles, primaryRole]
  );
  return result.rows[0] || null;
};
