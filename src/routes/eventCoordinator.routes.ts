import express from "express";
import { getDashboardLeads } from "../controllers/dashboard.controller";
import {
  startEventController,
  pauseEventController,
  endEventController,
  getEventStatusController,
  getEventDataProgressController,
} from "../controllers/eventRuntime.controller";

const router = express.Router();

// Matches the functionality of what CRM uses for Leads
router.get("/dashboard/leads", getDashboardLeads);

// Event runtime actions
router.patch("/event/:leadId/start", startEventController);
router.patch("/event/:leadId/pause", pauseEventController);
router.patch("/event/:leadId/end", endEventController);
router.get("/event/:leadId/status", getEventStatusController);
router.get("/event/:leadId/data-progress", getEventDataProgressController);

export default router;
