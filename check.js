const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 6000,
  user: 'postgres',
  password: 'password',
  database: 'Redangle-Preproduction'
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('event_details', 'creative_planning', 'assign_teams') 
      AND column_name IN ('external_lead_id', 'external_id', 'lead_id')
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) { console.error(e); }
  finally { await client.end(); }
}
run();
