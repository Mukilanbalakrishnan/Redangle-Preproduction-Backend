const { Client } = require('pg');
const c = new Client({
    user: 'postgres',
    password: 'tns7142006',
    port: 6000,
    database: 'Redangle'
});
async function run() {
    await c.connect();
    const res = await c.query("SELECT password_hash FROM users WHERE email='tnsooriyaa@gmail.com'");
    if (res.rows.length) {
        await c.query("UPDATE users SET password_hash=$1 WHERE email='client@gmail.com'", [res.rows[0].password_hash]);
        console.log('Updated client password_hash');
    } else {
        console.log('tnsooriyaa@gmail.com not found');
    }
    await c.end();
}
run();
