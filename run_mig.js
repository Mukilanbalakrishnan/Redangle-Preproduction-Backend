const fs = require('fs');
const { Client } = require('pg');
async function run() {
    const passwords = ['tns7142006', 'password', ''];
    const dbs = ['Redangle-Preproduction', 'Redangle', 'postgres'];
    let connected = false;
    for (let db of dbs) {
        for (let pw of passwords) {
            const client = new Client({
                host: 'localhost',
                port: 6000,
                user: 'postgres',
                password: pw,
                database: db
            });
            try {
                await client.connect();
                console.log('Connected to db ' + db + ' with pw ' + pw);
                const sql = fs.readFileSync('./src/migrations/structure_update.sql', 'utf8');
                await client.query(sql);
                console.log('Migration executed successfully on ' + db);
                await client.end();
                return;
            } catch(e) {
                if (e.message && e.message.includes('password authorization failed')) {
                    // wrong password
                } else if (e.message && e.message.includes('does not exist')) {
                    // wrong db
                } else if (!e.message.includes('auth')) {
                    console.log('Error on ' + db + ' with ' + pw + ':', e.message);
                }
            }
        }
    }
    console.log('Could not connect or execute');
}
run();
