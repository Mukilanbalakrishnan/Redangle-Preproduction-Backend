const { Client } = require('pg');
const c = new Client({ user: 'postgres', password: 'tns7142006', port: 6000, database: 'Redangle' });
async function run() {
    await c.connect();
    const l = await c.query('SELECT id, current_phase, phase_status, flow_type, phase_owner FROM external_leads WHERE id = 4343');
    console.log('LEAD:', l.rows[0]);
    const a = await c.query("SELECT * FROM approvals WHERE external_lead_id = 4343");
    console.log('APPROVALS:', a.rows);
    await c.end();
}
run().catch(console.error);
