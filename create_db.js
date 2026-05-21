const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    password: 'tns7142006',
    host: 'localhost',
    port: 6000,
    database: 'postgres'
});

client.connect()
    .then(() => client.query('CREATE DATABASE "Redangle_sales"'))
    .then(() => {
        console.log('Successfully created Redangle_sales database');
        process.exit(0);
    })
    .catch(e => {
        if (e.message.includes('already exists')) {
            console.log('Database already exists');
            process.exit(0);
        } else {
            console.error('Error creating database:', e.message);
            process.exit(1);
        }
    });
