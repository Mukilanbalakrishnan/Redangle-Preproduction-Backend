import { pool } from "./src/config/db";

async function checkRoles() {
  try {
    const result = await pool.query(`SELECT email, name, role FROM users ORDER BY created_at DESC LIMIT 15`);
    console.log("Recent users and their roles:");
    result.rows.forEach(r => console.log(`  email: ${r.email}, role: "${r.role}"`));
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

checkRoles();
