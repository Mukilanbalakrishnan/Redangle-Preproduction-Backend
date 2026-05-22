import { Router } from "express";
import {
  createLeaveRequestController,
  getLeaveRequestsByEmployeeController,
  getAllLeaveRequestsController,
  updateLeaveStatusController
} from "../controllers/leave.controller";

const router = Router();

router.post("/leave", createLeaveRequestController);
router.get("/leave/employee/:employee_id", getLeaveRequestsByEmployeeController);
router.get("/leave", getAllLeaveRequestsController);
router.put("/leave/:id/status", updateLeaveStatusController);

export default router;
