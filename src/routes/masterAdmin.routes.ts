import express from "express";
import {
  masterAdminAttendance,
  masterAdminClient,
  masterAdminClientAttendance,
  masterAdminClientEmployees,
  masterAdminClientInvoice,
  masterAdminClientReport,
  masterAdminClients,
  masterAdminClientWorkTracker,
  masterAdminDashboard,
  masterAdminEmployees,
  masterAdminInvoices,
  masterAdminReports,
  masterAdminWorkTracker,
} from "../controllers/masterAdmin.controller";

const router = express.Router();

router.get("/sales/dashboard", masterAdminDashboard);
router.get("/sales/clients", masterAdminClients);
router.get("/sales/clients/:clientId", masterAdminClient);
router.get("/sales/clients/:clientId/employees", masterAdminClientEmployees);
router.get("/sales/clients/:clientId/work-tracker", masterAdminClientWorkTracker);
router.get("/sales/clients/:clientId/invoice", masterAdminClientInvoice);
router.get("/sales/clients/:clientId/attendance", masterAdminClientAttendance);
router.get("/sales/clients/:clientId/report", masterAdminClientReport);
router.get("/sales/employees", masterAdminEmployees);
router.get("/sales/work-tracker", masterAdminWorkTracker);
router.get("/sales/invoices", masterAdminInvoices);
router.get("/sales/attendance", masterAdminAttendance);
router.get("/sales/reports", masterAdminReports);

export default router;
