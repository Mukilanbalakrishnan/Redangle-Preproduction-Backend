import { Router } from "express";
import {
  clockInController,
  clockOutController,
  getAttendanceController
} from "../controllers/attendance.controller";

const router = Router();

router.post("/attendance/clock-in", clockInController);
router.post("/attendance/clock-out", clockOutController);
router.get("/attendance/employee/:employee_id", getAttendanceController);

export default router;
