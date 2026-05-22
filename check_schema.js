const { Client } = require('pg');
const c = new Client({
  host: 'localhost',
  port: 6000,
  user: 'postgres',
  password: 'password',
  database: 'Redangle-Preproduction'
});

async function run() {
  await c.connect();
  try {
    // Add video_camera_used column if it doesn't exist
    await c.query(`
      ALTER TABLE event_details 
      ADD COLUMN IF NOT EXISTS video_camera_used TEXT;
    `);
    console.log('Column video_camera_used added (or already exists).');
  } catch (e) {
    console.error(e);
  } finally {
    await c.end();
  }
}

run();
