import { Request, Response } from "express";
import {
  clockInService,
  clockOutService,
  getAttendanceService
} from "../services/attendance.service";

export const clockInController = async (req: Request, res: Response) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: "employee_id is required" });
    }

    const data = await clockInService({ employee_id });

    res.status(200).json({
      success: true,
      data,
      message: "Clocked in successfully"
    });
  } catch (error: any) {
    console.error("CLOCK IN ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const clockOutController = async (req: Request, res: Response) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: "employee_id is required" });
    }

    const data = await clockOutService({ employee_id });

    if (!data) {
      return res.status(400).json({ success: false, message: "No active clock-in found for today." });
    }

    res.status(200).json({
      success: true,
      data,
      message: "Clocked out successfully"
    });
  } catch (error: any) {
    console.error("CLOCK OUT ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAttendanceController = async (req: Request, res: Response) => {
  try {
    const { employee_id } = req.params;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: "employee_id parameter is required" });
    }

    const data = await getAttendanceService(String(employee_id));

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error("GET ATTENDANCE ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
