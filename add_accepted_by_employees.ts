import { pool } from "./src/config/db";

async function migrate() {
    console.log("Adding accepted_by_employees to assign_teams...");
    try {
        await pool.query(`ALTER TABLE assign_teams ADD COLUMN IF NOT EXISTS accepted_by_employees JSONB DEFAULT '[]'::jsonb`);
        console.log("Migration successful.");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        pool.end();
    }
}

migrate();
