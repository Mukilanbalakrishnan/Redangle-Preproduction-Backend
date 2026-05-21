const { Client } = require('pg');
const c = new Client({ user: 'postgres', password: 'tns7142006', host: 'localhost', port: 6000, database: 'Redangle' });
c.connect().then(async () => {
    // Simulate what the backend query now does with CONCAT_WS
    const empCode = 'EMP-22'; // Tifa's employee code
    const result = await c.query(`
        SELECT
            at.id AS lead_employee_id,
            el.external_id AS lead_id,
            CONCAT('EXT-', el.external_id) AS lead_code,
            el.lead_name AS name,
            el.event_type AS type,
            TRIM(BOTH ', ' FROM CONCAT_WS(', ',
                CASE WHEN at.photographer = $1 THEN 'Photography' ELSE NULL END,
                CASE WHEN at.videographer = $1 THEN 'Videography' ELSE NULL END,
                CASE WHEN at.drone = $1 THEN 'Drone Coverage' ELSE NULL END,
                CASE WHEN at.save_the_date = $1 THEN 'Save the Date Post' ELSE NULL END,
                CASE WHEN at.save_the_video = $1 THEN 'Save the Date Video' ELSE NULL END,
                CASE WHEN at.retouch = $1 THEN 'Retouch' ELSE NULL END
            )) AS task_name,
            el.priority AS priority,
            at.event_date AS deadline
        FROM assign_teams at
        LEFT JOIN external_leads el ON at.external_lead_id = el.external_id
        WHERE at.photographer = $1 OR at.videographer = $1 OR at.drone = $1
           OR at.save_the_date = $1 OR at.save_the_video = $1 OR at.retouch = $1
        ORDER BY at.created_at DESC
    `, [empCode]);

    console.log('Results for', empCode, ':', result.rows.length, 'rows');
    result.rows.forEach(r => {
        console.log(`  Lead: ${r.lead_code} | Name: ${r.name} | task_name: "${r.task_name}" | type: ${r.type}`);
    });

    // Show what the filter would do for "retouch"
    const retouchFiltered = result.rows.filter(r => (r.task_name || '').toLowerCase().includes('retouch'));
    console.log('\nFiltered for "retouch":', retouchFiltered.length, 'rows');
    retouchFiltered.forEach(r => console.log(`  ${r.lead_code} -> ${r.task_name}`));

    const stdFiltered = result.rows.filter(r => (r.task_name || '').toLowerCase().includes('save the date'));
    console.log('Filtered for "save the date":', stdFiltered.length, 'rows');
    stdFiltered.forEach(r => console.log(`  ${r.lead_code} -> ${r.task_name}`));

    await c.end();
}).catch(console.error);
