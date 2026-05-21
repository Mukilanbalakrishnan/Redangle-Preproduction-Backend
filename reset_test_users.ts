import { pool } from "./src/config/db";
import bcrypt from "bcryptjs";

async function resetUsers() {
  try {
    const hash = await bcrypt.hash("Admin@123", 10);
    
    // Update opm@gmail.com
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE LOWER(email) = 'opm@gmail.com'`,
      [hash]
    );
    console.log("Updated opm@gmail.com password to Admin@123");

    // Update event@gmail.com
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE LOWER(email) = 'event@gmail.com'`,
      [hash]
    );
    console.log("Updated event@gmail.com password to Admin@123");

    // Let's verify their roles
    const opmUser = await pool.query("SELECT email, role, roles FROM users WHERE LOWER(email) = 'opm@gmail.com'");
    console.log("OPM User:", opmUser.rows[0]);

    const eventUser = await pool.query("SELECT email, role, roles FROM users WHERE LOWER(email) = 'event@gmail.com'");
    console.log("Event User:", eventUser.rows[0]);

  } catch (error) {
    console.error("Error resetting passwords:", error);
  } finally {
    await pool.end();
  }
}

resetUsers();
