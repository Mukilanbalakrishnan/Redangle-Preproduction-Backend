import { Request, Response } from "express"
import { pool } from "../config/db"

export const acceptAssignment = async (req: Request, res: Response) => {

  try {

    const { lead_id, email } = req.body

    // get employee_code from employees table
    const emp = await pool.query(
      `SELECT employee_id FROM employees WHERE email = $1`,
      [email]
    )

    if (emp.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      })
    }

    const employeeCode = emp.rows[0].employee_id

    await pool.query(
      `
      UPDATE assign_teams
      SET accepted = true
      WHERE external_lead_id = $1
      AND $2 = ANY(ARRAY[photographer, videographer, assistant, editor])
      `,
      [lead_id, employeeCode]
    )

    res.json({ success: true })

  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      message: "Failed to accept assignment"
    })
  }

}