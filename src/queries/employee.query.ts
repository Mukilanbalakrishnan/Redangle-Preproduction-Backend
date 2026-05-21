import { pool } from "../config/db"
import bcrypt from "bcryptjs"
import { CreateEmployeeDTO } from "../types/employee.types"

const roleMap: Record<string, string> = {
  'Photographer': 'photographer',
  'Videographer': 'videographer',
  'Save the Date Post': 'employee-1',
  'Save the Date Video': 'employee-2',
  'Retouch Photo': 'employee-4',
  'Data Manager': 'data-manager',
  'CRM': 'crm',
  'Pre-production CRM': 'pre-production-crm',
  'Post-production CRM': 'post-production-crm',
  'Event CRM': 'post-production-crm',
  'Event Coordinator': 'event-coordinator',
  'Drone': 'drone',
  'Operational Manager': 'operational-manager',
  'Traditional Video Editor': 'traditional-video-editor',
  'Retouch Editor': 'retouch-editor',
  'Album Designer': 'album-designer',
  'Candid Video Editor': 'candid-video-editor',
}

const normalizeRoleForUser = (role: unknown) => {
  const label = String(role || '').trim()
  return roleMap[label] || label.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
}

const normalizeRolesForUser = (roles: unknown, fallbackRole: unknown) => {
  const rawRoles = Array.isArray(roles) && roles.length > 0 ? roles : [fallbackRole].filter(Boolean)
  return Array.from(new Set(rawRoles.map(normalizeRoleForUser).filter(Boolean)))
}

export const getEmployeesQuery = async () => {

  const result = await pool.query(`
    SELECT *
    FROM employees
    ORDER BY created_at DESC
  `)

  return result.rows
}

export const getEmployeeQuery = async (id: string) => {

  const result = await pool.query(`
    SELECT *
    FROM employees
    WHERE employee_id = $1
  `, [id])

  return result.rows[0]
}

export const createEmployeeQuery = async (data: CreateEmployeeDTO) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Insert into employees table
    const result = await client.query(
      `
INSERT INTO employees(
employee_id,
first_name,
last_name,
email,
contact_number,
dob,
address,
work_location,
role,
roles,
experience,
date_of_join,
description,
created_by,
profile_image,
identity_document
)

VALUES(
$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
)

RETURNING *
`,
      [
        data.employee_id,
        data.first_name,
        data.last_name,
        data.email,
        data.contact_number,
        data.dob,
        data.address,
        data.work_location,
        data.role,
        data.roles || '{}',
        data.experience,
        data.date_of_join,
        data.description,
        data.created_by,
        data.profile_image,
        data.identity_document
      ]
    )

    // Also insert into users table so the employee can login
    if (data.password && data.email) {
      const requestedRoles = data.roles && data.roles.length > 0 ? data.roles : [data.role]
      const parsedRoles = normalizeRolesForUser(requestedRoles, data.role)
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ')
      const passwordHash = await bcrypt.hash(data.password, 10)

      // Check if user already exists — if so, append role instead of inserting
      const existingUser = await client.query(
        `SELECT id FROM users WHERE LOWER(email) = $1`,
        [data.email.toLowerCase().trim()]
      )

      if (existingUser.rows.length === 0) {
        await client.query(
          `INSERT INTO users (name, email, password_hash, role, roles) VALUES ($1, $2, $3, $4, $5)`,
          [name, data.email.toLowerCase().trim(), passwordHash, parsedRoles[0] || 'employee-1', parsedRoles]
        )
      } else {
        // Append the new role if not already present
        for (const userRole of parsedRoles) {
          if (!userRole) continue;
          await client.query(
            `UPDATE users SET roles = array_append(roles, $2) WHERE id = $1 AND NOT ($2 = ANY(COALESCE(roles, '{}')))`,
            [existingUser.rows[0].id, userRole]
          )
        }
      }
    }

    await client.query('COMMIT')
    return result.rows[0]

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

}

export const updateEmployeeQuery = async (id: string, data: any) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const existingEmployee = await client.query(
      `SELECT email FROM employees WHERE employee_id = $1 LIMIT 1`,
      [id]
    )
    const previousEmail = existingEmployee.rows[0]?.email
    const displayRoles = Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : [data.role].filter(Boolean)
    const userRoles = normalizeRolesForUser(displayRoles, data.role)
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()

    const result = await client.query(
      `
UPDATE employees
SET
first_name=$1,
last_name=$2,
email=$3,
contact_number=$4,
role=$5,
roles=$6
WHERE employee_id=$7
RETURNING *
`,
      [
        data.first_name,
        data.last_name,
        data.email,
        data.contact_number,
        data.role,
        data.roles || '{}',
        id
      ]
    )

    if (data.email && userRoles.length > 0) {
      await client.query(
        `
UPDATE users
SET
name=$1,
email=$2,
role=$3,
roles=$4
WHERE LOWER(email) = LOWER($5) OR LOWER(email) = LOWER($2)
`,
        [
          name,
          data.email.toLowerCase().trim(),
          userRoles[0],
          userRoles,
          previousEmail || data.email
        ]
      )
    }

    await client.query('COMMIT')
    return result.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

}

export const deleteEmployeeQuery = async (id: string) => {

  await pool.query(`
DELETE FROM employees
WHERE employee_id=$1
`, [id])

}
