import { Request, Response } from "express";
import {
  startEventQuery,
  pauseEventQuery,
  endEventQuery,
  getEventStatusQuery,
  getEventDataProgressQuery,
} from "../queries/eventRuntime.query";
import { createNotificationService } from "../services/notification.service";
import { syncLeadToEventPhaseService } from "../services/phaseTracking.service";
import { updateCurrentStageService } from "../services/stageTracking.service";

export const startEventController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const { started_by, work_date } = req.body;

    const result = await startEventQuery(leadId, started_by || "unknown", work_date);

    if (!result) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    await syncLeadToEventPhaseService(leadId);
    await updateCurrentStageService(leadId, "event_started");

    // Notify Event Coordinator
    await createNotificationService({
      type: "query",
      title: "Event Started",
      detail: `Event tracking for lead ${leadId} has been started${work_date ? ` on ${work_date}` : ""}`,
      lead_id: parseInt(leadId) || undefined,
      from_role: req.body.role || "photographer",
      from_name: started_by,
      target_roles: ["post-production-crm", "event-coordinator"],
      source_stage: "event",
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const pauseEventController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const { work_date } = req.body;
    const result = await pauseEventQuery(leadId, work_date);

    if (!result) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    await syncLeadToEventPhaseService(leadId);
    await createNotificationService({
      type: "query",
      title: "Event Paused",
      detail: `Event tracking for lead ${leadId} has been paused${work_date ? ` on ${work_date}` : ""}`,
      lead_id: parseInt(leadId) || undefined,
      from_role: req.body.role || "photographer",
      from_name: req.body.paused_by,
      target_roles: ["post-production-crm", "event-coordinator"],
      source_stage: "event",
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const endEventController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const { ended_by, work_date, complete_event } = req.body;
    const result = await endEventQuery(leadId, ended_by, work_date, complete_event !== false);

    if (!result) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    await syncLeadToEventPhaseService(leadId);
    if (complete_event !== false) {
      await updateCurrentStageService(leadId, "shoot_completed");
    }

    await createNotificationService({
      type: "query",
      title: complete_event === false ? "Event Day Tracking Ended" : "Event Tracking Completed",
      detail: complete_event === false
        ? `Event tracking for lead ${leadId} ended${work_date ? ` on ${work_date}` : ""}.`
        : `Event for lead ${leadId} has ended completely. Upload footages/images now available.`,
      lead_id: parseInt(leadId) || undefined,
      from_role: req.body.role || "photographer",
      from_name: ended_by,
      target_roles: ["post-production-crm", "event-coordinator"],
      source_stage: "event",
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEventStatusController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await getEventStatusQuery(leadId);

    if (!result) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEventDataProgressController = async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId);
    const result = await getEventDataProgressQuery(leadId);

    if (!result) {
      return res.status(404).json({ success: false, message: "Event data progress not found" });
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
