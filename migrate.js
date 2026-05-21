const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ 
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Redangle',
    password: process.env.DB_PASSWORD || '1234',
    port: parseInt(process.env.DB_PORT || '5432')
});

async function run() {
    try {
        await client.connect();
        console.log('Running DB Migration...');
        await client.query(`UPDATE users SET role = 'retouch-editor' WHERE role = 'traditional-photo-editor'`);
        await client.query(`UPDATE users SET roles = array_replace(roles, 'traditional-photo-editor', 'retouch-editor')`);
        await client.query(`UPDATE employees SET role = 'Retouch Editor' WHERE role = 'Traditional Photo Editor'`);
        await client.query(`UPDATE assigned_projects SET project_type = 'Retouch Editing' WHERE project_type = 'Traditional Photo Editing'`);
        console.log('Migration Complete');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
run();
