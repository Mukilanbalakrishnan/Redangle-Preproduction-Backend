const { Client } = require('pg');
require('dotenv').config();

// Use env variables so this works in any environment
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 6000,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'Redangle-Preproduction'
});

async function run() {
  await client.connect();
  console.log('Connected to database.');

  try {
    // Add missing columns to event_details table (all safe with IF NOT EXISTS)
    const alterations = [
      // Videographer upload columns
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS video_drive_link TEXT`,
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS video_camera_used VARCHAR(255)`,
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS num_videos INTEGER DEFAULT 0`,
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS video_upload_notes TEXT`,
      // Photographer upload columns (in case they're missing too)
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS drive_link TEXT`,
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS camera_used VARCHAR(255)`,
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS num_images INTEGER DEFAULT 0`,
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS upload_notes TEXT`,
      // Media status for data manager
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS media_status VARCHAR(100) DEFAULT 'Pending'`,
      // updated_at
      `ALTER TABLE event_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    ];

    for (const sql of alterations) {
      try {
        await client.query(sql);
        const colMatch = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/);
        const colName = colMatch ? colMatch[1] : '?';
        console.log(`  ✓ Column "${colName}" ensured.`);
      } catch (e) {
        console.error(`  ✗ Failed: ${sql}\n    Error: ${e.message}`);
      }
    }

    // Verify current columns
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'event_details' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

    console.log('\n=== event_details columns after migration ===');
    result.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    console.log('\nMigration complete!');

  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await client.end();
  }
}

run();
