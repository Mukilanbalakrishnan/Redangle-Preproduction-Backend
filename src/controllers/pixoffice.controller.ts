import { Request, Response } from "express";
import { submitPixofficeDataService, getPixofficeStatsService } from "../services/pixoffice.service";

export const submitPixofficeDataController = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        // Validate required fields
        if (!body.external_lead_id || !body.event_name) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        const data = await submitPixofficeDataService(body);
        
        // Work Tracking: Record milestones
        try {
            const { updateCurrentStageService } = require('../services/stageTracking.service');
            await updateCurrentStageService(body.external_lead_id, 'pixoffice_processing');
            await updateCurrentStageService(body.external_lead_id, 'assigned_to_crm');
        } catch (e) {
            console.error('Failed to trigger Pixoffice stage tracking:', e);
        }

        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("SUBMIT PIXOFFICE ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPixofficeStatsController = async (req: Request, res: Response) => {
    try {
        const stats = await getPixofficeStatsService();
        res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
        console.error("GET PIXOFFICE STATS ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
