import { pool } from "../config/db";
import { ClockInDTO, ClockOutDTO, AttendanceRecord } from "../types/attendance.types";

export const createTablesQuery = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      login_time TIME,
      logout_time TIME,
      status VARCHAR(20) DEFAULT 'Present',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(employee_id, date)
    );
  `);
};

export const clockInQuery = async (data: ClockInDTO): Promise<AttendanceRecord> => {
  // Insert a new record for today, or update login_time if somehow it exists (e.g. absent record turned present)
  // We use ON CONFLICT to handle multiple clock-ins on the same day gracefully
  const result = await pool.query(
    `
    INSERT INTO attendance (employee_id, date, login_time, status)
    VALUES ($1, CURRENT_DATE, CURRENT_TIME, 'Present')
    ON CONFLICT (employee_id, date) 
    DO UPDATE SET login_time = EXCLUDED.login_time, status = 'Present', updated_at = NOW()
    WHERE attendance.login_time IS NULL
    RETURNING *;
    `,
    [data.employee_id]
  );
  return result.rows[0];
};

export const clockOutQuery = async (data: ClockOutDTO): Promise<AttendanceRecord> => {
  // Update the existing record for today
  const result = await pool.query(
    `
    UPDATE attendance
    SET logout_time = CURRENT_TIME, updated_at = NOW()
    WHERE employee_id = $1 AND date = CURRENT_DATE
    RETURNING *;
    `,
    [data.employee_id]
  );
  return result.rows[0];
};

export const getAttendanceQuery = async (employee_id: string): Promise<AttendanceRecord[]> => {
  const result = await pool.query(
    `
    SELECT * FROM attendance
    WHERE employee_id = $1
    ORDER BY date DESC
    `,
    [employee_id]
  );
  return result.rows;
};
