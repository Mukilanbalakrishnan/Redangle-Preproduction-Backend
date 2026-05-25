import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

let activePool: Pool | null = null;
let activeSalesPool: Pool | null = null;

function getPool(): Pool {
  if (!activePool) {
    activePool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    
    activePool.on("error", (err) => {
      console.error("❌ PreProduction DB Pool Error:", err.message);
    });
  }
  return activePool;
}

function getSalesPool(): Pool {
  if (!activeSalesPool) {
    activeSalesPool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.SALES_DB_NAME || "Redangle",
    });
    
    activeSalesPool.on("error", (err) => {
      console.error("❌ Sales DB Pool Error:", err.message);
    });
  }
  return activeSalesPool;
}

// Recreate the pools with updated credentials (e.g. after a fallback password is resolved)
export function refreshPools() {
  console.log("🔄 Recreating database connection pools with updated credentials...");
  if (activePool) {
    const oldPool = activePool;
    activePool = null;
    oldPool.end().catch(err => console.error("Error closing old PreProduction pool:", err.message));
  }
  if (activeSalesPool) {
    const oldSalesPool = activeSalesPool;
    activeSalesPool = null;
    oldSalesPool.end().catch(err => console.error("Error closing old Sales pool:", err.message));
  }
}

// Proxy for pool to delegate all accesses dynamically
export const pool = new Proxy({} as Pool, {
  get(target, prop, receiver) {
    const p = getPool();
    const value = Reflect.get(p, prop, receiver);
    if (typeof value === "function") {
      return value.bind(p);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    return Reflect.set(getPool(), prop, value, receiver);
  }
});

// Proxy for salesPool to delegate all accesses dynamically
export const salesPool = new Proxy({} as Pool, {
  get(target, prop, receiver) {
    const p = getSalesPool();
    const value = Reflect.get(p, prop, receiver);
    if (typeof value === "function") {
      return value.bind(p);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    return Reflect.set(getSalesPool(), prop, value, receiver);
  }
});
