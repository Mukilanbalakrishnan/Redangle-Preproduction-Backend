require('dotenv').config();
const { Client } = require('pg');

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
        // get an arbitrary active user
        const res = await client.query('SELECT * FROM users LIMIT 1');
        if (res.rows.length === 0) {
            console.log('No users found in database');
            return;
        }
        const email = res.rows[0].email;

        // Assign multi-roles
        const update = await client.query(`UPDATE users SET roles = ARRAY['photographer', 'employee-4'] WHERE email = $1 RETURNING *`, [email]);
        console.log(`Successfully assigned ['photographer', 'employee-4'] roles to ${email}. Details:`);
        console.log(update.rows[0]);
    } catch (err) {
        console.error('Failed', err);
    } finally {
        await client.end();
    }
}
run();
