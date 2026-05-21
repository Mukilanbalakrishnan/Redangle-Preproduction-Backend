const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: 'tns7142006', host: 'localhost', port: 6000, database: 'Redangle' });

client.connect().then(async () => {
    // Check what's in assign_teams
    const r1 = await client.query('SELECT external_lead_id, photographer, videographer, save_the_date, save_the_video, retouch, drone FROM assign_teams LIMIT 5');
    console.log('=== assign_teams ===');
    r1.rows.forEach(r => console.log(JSON.stringify(r)));

    // Check employees table
    const r2 = await client.query('SELECT employee_id, first_name, last_name, email, role FROM employees LIMIT 10');
    console.log('=== employees ===');
    r2.rows.forEach(r => console.log(JSON.stringify(r)));

    // Check users with multi-role
    const r3 = await client.query("SELECT id, name, email, role, roles FROM users WHERE role LIKE 'employee%' OR array_length(roles,1) > 1 LIMIT 10");
    console.log('=== users multi-role ===');
    r3.rows.forEach(r => console.log(JSON.stringify(r)));

    // Check event_details table schema
    const r4 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'event_details' ORDER BY ordinal_position");
    console.log('=== event_details columns ===');
    r4.rows.forEach(r => console.log(r.column_name));

    await client.end();
}).catch(console.error);
