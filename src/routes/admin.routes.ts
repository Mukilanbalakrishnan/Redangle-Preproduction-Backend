import express from "express";
import { getAdminDashboardStats } from "../controllers/dashboard.controller";

const router = express.Router();

// GET /api/admin/dashboard-stats
router.get("/dashboard-stats", getAdminDashboardStats);

export default router;
