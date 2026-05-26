const { Pool } = require('pg');
const pool = new Pool({ 
    connectionString: 'postgresql://postgres:password@localhost:6000/Redangle-Preproduction' 
});
pool.query(`
    ALTER TABLE event_details 
    ADD COLUMN IF NOT EXISTS photo_approved BOOLEAN DEFAULT FALSE, 
    ADD COLUMN IF NOT EXISTS video_approved BOOLEAN DEFAULT FALSE, 
    ADD COLUMN IF NOT EXISTS drone_approved BOOLEAN DEFAULT FALSE;
`).then(() => {
    console.log('Added columns');
}).catch(console.error).finally(() => pool.end());
