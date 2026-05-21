import cron from "node-cron";
import { LeadSyncError, syncCompletedLeads } from "../services/externalLead.service";

// runs automatically
export const startLeadSyncJob = () => {
  const cronExpression = process.env.SYNC_CRON || "* * * * *";
  let lastFailureCode: string | null = null;

  cron.schedule(cronExpression, async () => {
    console.log("🔄 Sync Job Running...");

    try {
      const count = await syncCompletedLeads();
      lastFailureCode = null;

      console.log(`✅ Synced ${count} sales leads`);
    } catch (error) {
      if (error instanceof LeadSyncError) {
        if (lastFailureCode !== error.code) {
          console.warn(`⚠️ Lead sync skipped: ${error.message}`);
          lastFailureCode = error.code;
        }
        return;
      }

      console.error("❌ Sync failed:", error);
    }
  });
};
