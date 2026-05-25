import { pool } from './src/config/db';

async function run() {
  try {
    const leadRes = await pool.query(
      `SELECT external_id, lead_serial_number, status, current_phase, flow_type 
       FROM external_leads 
       WHERE external_id = 'LD-NOFLOW-006' OR lead_serial_number = 'LD-NOFLOW-006'`
    );
    console.log("LEAD DETAILS:", leadRes.rows);

    const teamRes = await pool.query(
      `SELECT id, external_lead_id, photographer, videographer, drone, additional_staff, event_additional_staff, secondary_photographer, secondary_videographer, secondary_drone 
       FROM assign_teams 
       WHERE external_lead_id = 'LD-NOFLOW-006'`
    );
    console.log("TEAM DETAILS:", teamRes.rows);
  } catch (err) {
    console.error("DB Query error:", err);
  } finally {
    await pool.end();
  }
}

run();
