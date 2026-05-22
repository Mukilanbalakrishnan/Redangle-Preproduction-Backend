import { Request, Response } from "express";
import {
  setFlowTypeService,
  advancePhaseService,
  getPhaseInfoService,
  updatePhaseStatusService,
  getPreProductionStepService,
  advanceToEditingStepService,
  completeEditingStepService,
  checkPhase2EditorsAssignedService,
  getPhase2SubmissionStatusService,
} from "../services/phaseTracking.service";

export const setFlowTypeController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const { flow_type } = req.body;

    if (!flow_type || !['pre_wedding', 'post_wedding'].includes(flow_type)) {
      return res.status(400).json({ success: false, message: "flow_type must be 'pre_wedding' or 'post_wedding'" });
    }

    const result = await setFlowTypeService(leadId, flow_type);

    if (!result) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const advancePhaseController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await advancePhaseService(leadId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const updatePhaseStatusController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const { status } = req.body;

    const valid = ['not_started', 'in_progress', 'submitted', 'approved', 'completed'];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` });
    }

    const result = await updatePhaseStatusService(leadId, status);
    if (!result) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPhaseInfoController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await getPhaseInfoService(leadId);

    if (!result) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Pre-production Sub-phase Controllers

export const getPreProductionStepController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await getPreProductionStepService(leadId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// Client approves Phase 1 (shoot) - transition to Phase 2 (editing)
export const approveShootPhaseController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await advanceToEditingStepService(leadId);
    return res.json({
      success: true,
      data: result,
      message: 'Shoot phase approved. Now in editing phase - CRM must assign Phase 2 editors.'
    });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// CRM approves Phase 2 (editing) - marks pre-production as complete
export const approveEditingPhaseController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await completeEditingStepService(leadId);
    return res.json({
      success: true,
      data: result,
      message: 'Editing phase approved. Ready for phase advancement.'
    });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// Check if Phase 2 editors are assigned
export const checkPhase2EditorsController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await checkPhase2EditorsAssignedService(leadId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Check whether all assigned Phase 2 editors have submitted files
export const getPhase2SubmissionStatusController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await getPhase2SubmissionStatusService(leadId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
