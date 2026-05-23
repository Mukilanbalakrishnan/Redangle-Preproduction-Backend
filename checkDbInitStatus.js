const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const dbHost = process.env.DB_HOST || "localhost";
const dbPort = Number(process.env.DB_PORT) || 6000;
const dbUser = process.env.DB_USER || "postgres";
const dbName = process.env.DB_NAME || "Redangle-Preproduction";

const passwordsToTry = [
  process.env.DB_PASSWORD || "password",
  "tns7142006",
  "password",
  "1234",
  ""
];

async function check() {
  let client = null;
  const uniquePasswords = Array.from(new Set(passwordsToTry));
  
  for (const pw of uniquePasswords) {
    try {
      client = new Client({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: pw,
        database: dbName
      });
      await client.connect();
      console.log(`✅ Successfully connected to database "${dbName}" using password "${pw}"!`);
      break;
    } catch (err) {
      if (client) {
        await client.end().catch(() => {});
        client = null;
      }
    }
  }

  if (!client) {
    console.error(`❌ Could not connect to database "${dbName}" with any password. Database might not exist yet.`);
    process.exit(1);
  }

  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log(`Found ${res.rows.length} tables in "${dbName}":`);
    res.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });
  } catch (err) {
    console.error("Error querying tables:", err);
  } finally {
    await client.end();
  }
}

check();
