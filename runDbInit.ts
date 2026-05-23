import { initializeDatabase } from "./src/config/initDb";

initializeDatabase()
  .then(() => {
    console.log("🎉 Database initialization completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Database initialization failed:", err);
    process.exit(1);
  });
