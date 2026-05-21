const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
});

async function run() {
  await client.connect();

  const maxRes = await client.query(`
    SELECT COALESCE(MAX(
      CAST(NULLIF(regexp_replace(lead_serial_number, '[^0-9]', '', 'g'), '') AS INTEGER)
    ), 0) AS n
    FROM external_leads
    WHERE lead_serial_number LIKE 'LD-NOFLOW-%'
  `);
  const nextNum = Number(maxRes.rows[0]?.n || 0) + 1;
  const leadId = `LD-NOFLOW-${String(nextNum).padStart(3, '0')}`;

  const result = await client.query(
    `
    INSERT INTO external_leads
      (external_id, lead_serial_number, lead_name, email, phone, location, event_type, event_date, priority, status, flow_type, current_phase, phase_status, pre_production_step)
    VALUES
      ($1, $1, $2, $3, $4, $5, $6, $7, 'medium', 'new', NULL, NULL, NULL, NULL)
    RETURNING external_id, lead_serial_number, lead_name, email, phone, location, event_type, event_date, status, flow_type, current_phase, phase_status
    `,
    [
      leadId,
      'New Client Lead',
      'newclient@example.com',
      '9876543210',
      'Chennai',
      'Wedding',
      '2027-03-15',
    ]
  );

  console.log('Created lead:', result.rows[0]);
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
