require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'Redangle-Preproduction'
});

async function run() {
    await client.connect();
    try {
        const sqlPath = path.join(__dirname, 'src', 'migrations', 'add_roles_array.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('Migration added successfully');
    } catch (err) {
        console.error('Migration failed', err);
    } finally {
        await client.end();
    }
}
run();
