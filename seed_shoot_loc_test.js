const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
});

async function run() {
    await client.connect();
    const result = await client.query(`
        INSERT INTO external_leads
            (external_id, lead_serial_number, lead_name, email, phone, location, event_type, event_date, priority, status)
        VALUES
            ('SHOOT-LOC-TEST', 'SHOOT-LOC-TEST', 'Test Shoot Location', 'shootloc@test.com', '9876500001', 'Chennai', 'Wedding', '2026-12-20', 'high', 'new')
        ON CONFLICT (external_id) DO UPDATE SET
            lead_name = EXCLUDED.lead_name,
            status = 'new',
            flow_type = NULL,
            current_phase = NULL,
            phase_status = NULL
        RETURNING external_id, lead_name, status
    `);
    console.log('✅ Created lead:', result.rows[0]);
    await client.end();
}

run().catch(console.error);
