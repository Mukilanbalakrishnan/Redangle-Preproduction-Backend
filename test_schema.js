const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: 'localhost', database: 'Redangle-Preproduction', password: 'password', port: 6000 });
client.connect().then(() => {
    return client.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'event_details\' ORDER BY ordinal_position');
}).then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    return client.end();
}).catch(console.error);
