import express from "express";
import { getDashboardLeads, getAdminDashboardStats } from "../controllers/dashboard.controller";

const router = express.Router();

router.get("/dashboard/leads", getDashboardLeads);
router.get("/dashboard/admin-stats", getAdminDashboardStats);

export default router;