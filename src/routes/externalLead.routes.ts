import express from "express";
import {
  syncLeadsController,
  dashboardLeadsController,
  getLeadByIdController,
  updateExternalLeadController,
  deleteExternalLeadController
} from "../controllers/externalLead.controller";

const router = express.Router();

router.post("/sync-leads", syncLeadsController);
router.get("/dashboard-leads", dashboardLeadsController);
router.get("/:id", getLeadByIdController);
router.put("/:id", updateExternalLeadController);
router.delete("/:id", deleteExternalLeadController);

export default router;