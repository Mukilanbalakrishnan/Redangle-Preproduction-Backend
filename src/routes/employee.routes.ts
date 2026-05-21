import { Router } from "express";
import {
    getEmployeeDashboard,
    getAssignedProjects,
    getMyWork,
    getAttendance,
    getLeaveRequests,
    submitLeaveRequest,
    getTodayAttendance,
    punchIn,
    punchOut,
} from "../controllers/employee.controller";

const router = Router();

router.get("/employee/:employeeId/dashboard", getEmployeeDashboard);
router.get("/employee/:employeeId/assigned-projects", getAssignedProjects);
router.get("/employee/:employeeId/my-work", getMyWork);
router.get("/employee/:employeeId/attendance", getAttendance);
router.get("/employee/:employeeId/leave-requests", getLeaveRequests);
router.post("/employee/:employeeId/leave-requests", submitLeaveRequest);
router.get("/employee/:employeeId/attendance/today", getTodayAttendance);
router.post("/employee/:employeeId/punch-in", punchIn);
router.post("/employee/:employeeId/punch-out", punchOut);

export default router;
