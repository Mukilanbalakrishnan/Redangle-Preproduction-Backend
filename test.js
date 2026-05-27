const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/red_angle_preproduction' });
pool.query('SELECT external_lead_id, additional_staff, event_additional_staff FROM assign_teams').then(res => {
    console.log(res.rows);
    pool.end();
}).catch(err => {
    console.error(err);
    pool.end();
});
