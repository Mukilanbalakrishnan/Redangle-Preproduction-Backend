import {
getEmployeesQuery,
getEmployeeQuery,
createEmployeeQuery,
updateEmployeeQuery,
deleteEmployeeQuery
} from "../queries/employee.query"

import { CreateEmployeeDTO } from "../types/employee.types"
import bcrypt from "bcryptjs"
import { pool } from "../config/db"

export const getEmployeesService = async()=>{

return await getEmployeesQuery()

}

export const getEmployeeService = async(id:string)=>{

return await getEmployeeQuery(id)

}

export const createEmployeeService = async(data: CreateEmployeeDTO)=>{

  // 1. Create the employee record (no password stored here)
  const employee = await createEmployeeQuery(data)

  // 2. Hash the password and create a user entry for login
  if (data.password) {
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(data.password, saltRounds)

    const fullName = `${data.first_name}${data.last_name ? ' ' + data.last_name : ''}`
    // Map display role name to login role slug
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
    }
    const userRole = roleMap[data.role] || data.role.toLowerCase()

    // Check if a user with this email already exists
    const existing = await pool.query(
      `SELECT id, roles FROM users WHERE email = $1`,
      [data.email.toLowerCase().trim()]
    )

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, roles, is_active, created_at)
         VALUES ($1, $2, $3, $4, ARRAY[$4::text], true, NOW())`,
        [fullName, data.email.toLowerCase().trim(), passwordHash, userRole]
      )
    } else {
      // User exists — append the new role if not already present
      await pool.query(
        `UPDATE users SET roles = array_append(roles, $2) WHERE id = $1 AND NOT ($2 = ANY(COALESCE(roles, '{}')))`,
        [existing.rows[0].id, userRole]
      )
    }
  }

  return employee

}

export const updateEmployeeService = async(id:string,data:any)=>{

return await updateEmployeeQuery(id,data)

}

export const deleteEmployeeService = async(id:string)=>{

return await deleteEmployeeQuery(id)

}
