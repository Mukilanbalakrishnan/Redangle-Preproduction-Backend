import { Request, Response } from "express";
import { LeadSyncError, syncCompletedLeads } from "../services/externalLead.service";
import { getDashboardLeads } from "../queries/externalLead.query";

export const syncLeadsController = async (
  _req: Request,
  res: Response
) => {
  try {
    const count = await syncCompletedLeads();

    res.json({
      success: true,
      message: `${count} leads synced`,
    });
  } catch (err) {
    const statusCode = err instanceof LeadSyncError ? err.statusCode : 500;
    const message = err instanceof LeadSyncError ? err.message : "Sync failed";

    res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

export const dashboardLeadsController = async (
  _req: Request,
  res: Response
) => {
  const leads = await getDashboardLeads();

  res.json({
    success: true,
    data: leads,
  });
};

import { getLeadById, updateExternalLead, deleteExternalLead } from "../queries/externalLead.query";

export const getLeadByIdController = async (
  req: Request,
  res: Response
) => {
  try {
    const lead = await getLeadById(String(req.params.id));
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateExternalLeadController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = Number(req.params.id);
    const updatedLead = await updateExternalLead(id, req.body);
    if (!updatedLead) return res.status(404).json({ success: false, message: "Lead not found" });
    return res.json({ success: true, data: updatedLead });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteExternalLeadController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = Number(req.params.id);
    await deleteExternalLead(id);
    return res.json({ success: true, message: "Lead deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
