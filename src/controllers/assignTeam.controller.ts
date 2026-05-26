import { Request, Response } from "express";

import {
  saveAssignTeamService
} from "../services/assignTeam.service";

import {
  getAssignTeamQuery,
  acceptAssignmentQuery,
  getAssignmentStatusQuery
} from "../queries/assignTeam.query";

const toNumericEmployeeId = (employeeId: string | number): number => {
  const raw = String(employeeId ?? "").trim();
  const numeric = raw.startsWith("EMP-")
    ? Number(raw.replace("EMP-", ""))
    : Number(raw.replace(/\D/g, ""));

  return Number.isFinite(numeric) ? numeric : NaN;
};


export const saveAssignTeamController = async (
  req: Request,
  res: Response
) => {

  try {

    const data = await saveAssignTeamService(req.body);

    res.status(201).json({
      success: true,
      data
    });

  } catch (error: any) {

    console.error("ASSIGN TEAM ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


export const getAssignTeamController = async (
  req: Request,
  res: Response
) => {

  try {

    const { external_lead_id } = req.params;
    const assignmentPhase = String(req.query.phase || "");

    const data = await getAssignTeamQuery(
      String(external_lead_id),
      assignmentPhase
    );

    res.json({
      success: true,
      data
    });

  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};

export const acceptAssignmentController = async (
  req: Request,
  res: Response
) => {
  try {
    const { external_lead_id } = req.params;
    const { employeeId, taskName } = req.body;
    const numericEmployeeId = toNumericEmployeeId(employeeId);

    if (!employeeId || !Number.isFinite(numericEmployeeId) || numericEmployeeId <= 0) {
      return res.status(400).json({ success: false, message: 'employeeId is required' });
    }
    if (!taskName || typeof taskName !== 'string') {
      return res.status(400).json({ success: false, message: 'taskName is required to accept a specific assignment' });
    }
    const data = await acceptAssignmentQuery(String(external_lead_id), numericEmployeeId, taskName);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('ACCEPT ASSIGNMENT ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAssignmentStatusController = async (
  req: Request,
  res: Response
) => {
  try {
    const { external_lead_id } = req.params;
    const data = await getAssignmentStatusQuery(String(external_lead_id));
    res.json({ success: true, data: data || { accepted: false } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateResourcesController = async (
  req: Request,
  res: Response
) => {
  try {
    const { external_lead_id } = req.params;
    const { file_path } = req.body;
    
    if (file_path === undefined) {
      return res.status(400).json({ success: false, message: 'file_path is required' });
    }
    
    const { updateResourcesService } = require("../services/assignTeam.service");
    const data = await updateResourcesService(String(external_lead_id), file_path);
    
    if (!data) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('UPDATE RESOURCES ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
