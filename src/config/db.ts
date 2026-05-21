import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

// PreProduction database (Redangle-Preproduction)
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected (PreProduction)"))
  .catch(err => console.error("PreProduction DB Connection Error", err));

// Sales database (Redangle) — for employee dashboard, attendance, leaves, etc.
export const salesPool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.SALES_DB_NAME || "Redangle",
});

salesPool.connect()
  .then(() => console.log("✅ PostgreSQL Connected (Sales)"))
  .catch(err => console.error("Sales DB Connection Error", err));