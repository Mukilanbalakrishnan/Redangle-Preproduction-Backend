import { pool } from "./src/config/db";

async function fixByEmail() {
  try {
    // Fix boopathi whose role is stored as 'employee-1' but should be 'event-coordinator'
    // We use the employees table (which has the correct display role) to find the right email
    const result = await pool.query(`
      UPDATE users u
      SET role = 'event-coordinator'
      FROM employees e
      WHERE LOWER(u.email) = LOWER(e.email)
        AND LOWER(e.role) = 'event coordinator'
        AND u.role != 'event-coordinator'
      RETURNING u.email, u.role
    `);
    console.log(`Updated ${result.rowCount} user(s):`, result.rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

fixByEmail();
