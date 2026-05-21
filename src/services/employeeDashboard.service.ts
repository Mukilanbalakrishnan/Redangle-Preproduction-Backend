import { pool } from "../config/db"

export const getEmployeeDashboardService = async (employeeId: string) => {

  const result = await pool.query(
    `
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
    ON at.photographer = e.employee_id
       OR at.videographer = e.employee_id
       OR at.assistant = e.employee_id
       OR at.editor = e.employee_id

    LEFT JOIN event_details ed
    ON ed.external_lead_id = at.external_lead_id

    WHERE u.id = $1

    ORDER BY ed.preferred_date DESC
    LIMIT 5
    `,
    [employeeId]
  )

  const rows = result.rows

  return {
    stats: {
      assigned: rows.length,
      pending: rows.length,
      submitted: 0,
      approved: 0
    },
    recentProjects: rows
  }
}