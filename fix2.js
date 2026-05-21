const { Client } = require('pg');
const fs = require('fs');
const client = new Client({
  host: 'localhost',
  port: 6000,
  user: 'postgres',
  password: 'password',
  database: 'Redangle-Preproduction'
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT tc.table_schema, tc.constraint_name, tc.table_name, kcu.column_name, 
             ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu 
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema 
      JOIN information_schema.constraint_column_usage AS ccu 
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema 
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name='external_leads' 
        AND ccu.column_name='external_id';
    `);
    fs.writeFileSync('out1.json', JSON.stringify(res.rows, null, 2));

    const res2 = await client.query(`
      SELECT tc.table_schema, tc.constraint_name, tc.table_name, kcu.column_name, 
             ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu 
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema 
      JOIN information_schema.constraint_column_usage AS ccu 
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema 
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name='external_leads' 
        AND ccu.column_name='id';
    `);
    fs.writeFileSync('out2.json', JSON.stringify(res2.rows, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
