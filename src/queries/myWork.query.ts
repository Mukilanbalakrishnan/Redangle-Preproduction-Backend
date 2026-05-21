import { pool } from "../config/db"
import { MyWorkItem } from "../types/myWork.types"

export const getMyWorkQuery = async (
  employeeId: number
): Promise<MyWorkItem[]> => {

  const query = `
  SELECT
    at.external_lead_id AS lead_id,
    ed.client_name AS name,
    ed.event_type AS type,
    ed.preferred_date AS deadline,

    CASE
        WHEN at.photographer = e.employee_id THEN 'Photography'
        WHEN at.videographer = e.employee_id THEN 'Videography'
        WHEN at.assistant = e.employee_id THEN 'Assistant'
        WHEN at.editor = e.employee_id THEN 'Editing'
    END AS task_name,

    'Medium' AS priority

FROM users u

JOIN employees e
ON e.email = u.email

JOIN assign_teams at
ON (
    at.photographer = e.employee_id
    OR at.videographer = e.employee_id
    OR at.assistant = e.employee_id
    OR at.editor = e.employee_id
)

LEFT JOIN event_details ed
ON ed.external_lead_id = at.external_lead_id

WHERE u.id = $1
  `

  const result = await pool.query<MyWorkItem>(query, [employeeId])

  return result.rows
}