const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: 'tns7142006', host: 'localhost', port: 6000, database: 'Redangle' });

client.connect().then(async () => {
    // Check what task_names would be returned for assigned employees
    const r = await client.query(`
    SELECT
      at.external_lead_id,
      at.photographer, at.videographer, at.drone,
      at.save_the_date, at.save_the_video, at.retouch,
      el.lead_name
    FROM assign_teams at
    LEFT JOIN external_leads el ON el.external_id = at.external_lead_id
    WHERE at.save_the_date IS NOT NULL OR at.save_the_video IS NOT NULL OR at.retouch IS NOT NULL
    LIMIT 10
  `);
    console.log('=== Phase 2 assignments ===');
    r.rows.forEach(row => console.log(JSON.stringify(row)));

    if (r.rows.length === 0) {
        console.log('No Phase 2 (save_the_date/retouch) assignments found yet.');

        // Show all assignments
        const r2 = await client.query(`
      SELECT external_lead_id, photographer, videographer, drone, save_the_date, save_the_video, retouch
      FROM assign_teams LIMIT 5
    `);
        console.log('=== All assign_teams ===');
        r2.rows.forEach(row => console.log(JSON.stringify(row)));
    }

    await client.end();
}).catch(console.error);
