const { Client } = require('pg');
const c = new Client({ user:'postgres', password:'tns7142006', host:'localhost', port:6000, database:'Redangle' });

async function run() {
  await c.connect();

  // Check leads
  const leads = await c.query(`
    SELECT external_id, lead_name, flow_type, current_phase, phase_status, phase_owner, pre_production_step, status
    FROM external_leads
    WHERE lead_name IN ('Rem','Ram') OR external_id LIKE '%REM%' OR external_id LIKE '%RAM%'
  `);
  console.log('=== LEADS ===');
  console.log(JSON.stringify(leads.rows, null, 2));

  // Check event_details for these leads
  const events = await c.query(`
    SELECT ed.*
    FROM event_details ed
    WHERE ed.external_lead_id LIKE '%REM%' OR ed.external_lead_id LIKE '%RAM%'
       OR ed.external_lead_id IN (
         SELECT external_id::text FROM external_leads WHERE lead_name IN ('Rem','Ram')
       )
  `);
  console.log('\n=== EVENT DETAILS ===');
  console.log(JSON.stringify(events.rows, null, 2));

  // Check lead_tracking_stages
  const stages = await c.query(`
    SELECT *
    FROM lead_tracking_stages
    WHERE external_lead_id LIKE '%REM%' OR external_lead_id LIKE '%RAM%'
       OR external_lead_id IN (
         SELECT external_id::text FROM external_leads WHERE lead_name IN ('Rem','Ram')
       )
  `);
  console.log('\n=== TRACKING STAGES ===');
  console.log(JSON.stringify(stages.rows, null, 2));

  // Check assign_teams
  const teams = await c.query(`
    SELECT *
    FROM assign_teams
    WHERE external_lead_id LIKE '%REM%' OR external_lead_id LIKE '%RAM%'
       OR external_lead_id IN (
         SELECT external_id::text FROM external_leads WHERE lead_name IN ('Rem','Ram')
       )
  `);
  console.log('\n=== ASSIGN TEAMS ===');
  console.log(JSON.stringify(teams.rows, null, 2));

  await c.end();
}

run().catch(e => { console.error(e); process.exit(1); });
