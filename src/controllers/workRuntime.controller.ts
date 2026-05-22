import { Request, Response } from "express";
import {
  endWorkRuntimeService,
  getProjectWorkRuntimeSummaryService,
  getWorkRuntimeStatusService,
  pauseWorkRuntimeService,
  startWorkRuntimeService,
} from "../services/project.service";

const parseAssignmentId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const getWorkRuntimeStatusController = async (req: Request, res: Response) => {
  try {
    const assignmentId = parseAssignmentId(String(req.params.id));
    if (!assignmentId) {
      return res.status(400).json({ success: false, message: "Valid assignment id is required" });
    }

    const data = await getWorkRuntimeStatusService(assignmentId);
    if (!data) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const startWorkRuntimeController = async (req: Request, res: Response) => {
  try {
    const assignmentId = parseAssignmentId(String(req.params.id));
    if (!assignmentId) {
      return res.status(400).json({ success: false, message: "Valid assignment id is required" });
    }

    const data = await startWorkRuntimeService(
      assignmentId,
      req.body.started_by || "Multi-Role Employee",
      req.body.work_date
    );
    if (!data) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const pauseWorkRuntimeController = async (req: Request, res: Response) => {
  try {
    const assignmentId = parseAssignmentId(String(req.params.id));
    if (!assignmentId) {
      return res.status(400).json({ success: false, message: "Valid assignment id is required" });
    }

    const data = await pauseWorkRuntimeService(assignmentId, req.body.work_date);
    if (!data) {
      return res.status(404).json({ success: false, message: "Active work session not found" });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const endWorkRuntimeController = async (req: Request, res: Response) => {
  try {
    const assignmentId = parseAssignmentId(String(req.params.id));
    if (!assignmentId) {
      return res.status(400).json({ success: false, message: "Valid assignment id is required" });
    }

    const data = await endWorkRuntimeService(
      assignmentId,
      req.body.ended_by || "Multi-Role Employee",
      req.body.work_date
    );
    if (!data) {
      return res.status(404).json({ success: false, message: "Active work session not found" });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProjectWorkRuntimeSummaryController = async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.project_id || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, message: "project_id is required" });
    }

    const data = await getProjectWorkRuntimeSummaryService(projectId);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
