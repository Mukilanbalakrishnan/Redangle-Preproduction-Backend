const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function run() {
    const res = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('employees', 'employee_leave_requests', 'employees_attendance') 
    AND column_name = 'employee_id'
  `);
    console.log("SCHEMA:", res.rows);
    process.exit(0);
}
run().catch(console.error);
