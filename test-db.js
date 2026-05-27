const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:6000/red_angle_preproduction' });

async function check() {
    try {
        const res = await pool.query('SELECT external_id, lead_serial_number FROM external_leads WHERE client_name ILIKE $1', ['%Vinoo%']);
        console.log('external_leads:', res.rows);
        const dr = await pool.query('SELECT * FROM data_manager_raw_data');
        console.log('data_manager_raw_data sample:', dr.rows.slice(0, 5).map(r => ({ id: r.id, file_path: r.file_path, lead_serial_number: r.lead_serial_number })));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
