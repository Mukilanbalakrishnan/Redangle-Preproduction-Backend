const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    password: 'tns7142006',
    host: 'localhost',
    port: 6000,
    database: 'Redangle',
});

async function run() {
    await client.connect();

    // Get external_leads to find an existing active lead
    const res1 = await client.query("SELECT * FROM external_leads LIMIT 5");
    console.log('--- LEADS ---');
    console.table(res1.rows);

    // Get clients
    const res2 = await client.query("SELECT id, email, role, lead_external_id FROM users WHERE role = 'client' LIMIT 5");
    console.log('--- CLIENT USERS ---');
    console.table(res2.rows);

    if (res1.rows.length > 0 && res2.rows.length > 0) {
        const lead = res1.rows[0];
        const user = res2.rows[0];

        await client.query("UPDATE users SET lead_external_id = $1 WHERE id = $2", [lead.id.toString(), user.id]);
        console.log(`Updated user ${user.email} line with lead_external_id = "${lead.id}"`);
    }

    await client.end();
}

run().catch(console.error);
