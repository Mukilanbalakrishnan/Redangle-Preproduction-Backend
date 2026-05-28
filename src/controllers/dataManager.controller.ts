import { Request, Response } from "express";
import { getIncomingDataService, verifyMediaService, requestReuploadService, saveHardDiskClosureService, getHardDiskClosureService, getHardDiskStatsService, updateIncomingDataService, deleteIncomingDataService, markHardDiskReceivedService } from "../services/dataManager.service";
import { updateMediaStatusQuery } from "../queries/dataManager.query";
import { updatePixofficeStatusQuery } from "../queries/pixoffice.query";
import { pool } from "../config/db";
import { createNotificationService } from "../services/notification.service";

const notificationStageFromPhase = (phase?: string) => {
    const normalized = String(phase || '').toLowerCase();
    if (normalized === 'event') return 'event';
    if (normalized === 'post_production') return 'post-production';
    return 'pre-production';
};

export const getIncomingDataController = async (req: Request, res: Response) => {
    try {
        const data = await getIncomingDataService();
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("GET INCOMING DATA ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyMediaController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const data = await verifyMediaService(leadId);
        if (!data) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }

        // Work Tracking: Record milestones
        try {
            const { updateCurrentStageService } = require('../services/stageTracking.service');
            await updateCurrentStageService(leadId, 'data_manager_verification');
        } catch (e) {
            console.error('Failed to trigger DM stage tracking:', e);
        }

        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("VERIFY MEDIA ERROR:", error);
        if (String(error.message || '').startsWith('Cannot verify yet.')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

export const requestReuploadController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const { role, remarks } = req.body;
        const data = await requestReuploadService(leadId, role, remarks);
        if (!data) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("REQUEST REUPLOAD ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const saveVerificationDraftController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const draft = req.body.draft;
        const { saveVerificationDraftService } = require("../services/dataManager.service");
        const data = await saveVerificationDraftService(leadId, draft);
        if (!data) return res.status(404).json({ success: false, message: "Lead not found" });
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("SAVE DRAFT ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const markHardDiskReceivedController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const data = await markHardDiskReceivedService(leadId);
        if (!data) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }

        try {
            const { updateCurrentStageService } = require('../services/stageTracking.service');
            await updateCurrentStageService(leadId, 'data_manager_verification');
        } catch (e) {
            console.error('Failed to trigger hard disk received stage tracking:', e);
        }

        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("MARK HARD DISK RECEIVED ERROR:", error);
        if (String(error.message || '').startsWith('Cannot verify yet.')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

export const partialApproveMediaController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const { role } = req.body;
        const { partialApproveMediaService } = require("../services/dataManager.service");
        const data = await partialApproveMediaService(leadId, role);
        if (!data) return res.status(404).json({ success: false, message: "Lead not found" });
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("PARTIAL APPROVE MEDIA ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const approveMediaController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const { approveMediaService } = require("../services/dataManager.service");
        const data = await approveMediaService(leadId);
        if (!data) return res.status(404).json({ success: false, message: "Lead not found" });

        await pool.query(
            `UPDATE external_leads
             SET phase_status = 'approved',
                 phase_owner = CASE
                   WHEN current_phase = 'event' THEN 'post-production-crm'
                   WHEN current_phase = 'post_production' THEN 'post-production-crm'
                   ELSE 'pre-production-crm'
                 END,
                 updated_at = NOW()
             WHERE (external_id::text = $1 OR lead_serial_number = $1)
              AND current_phase IN ('pre_production', 'event')`,
            [leadId]
        );

        try {
            const phaseResult = await pool.query(
                `SELECT current_phase, lead_name
                 FROM external_leads
                 WHERE external_id::text = $1 OR lead_serial_number = $1
                 LIMIT 1`,
                [leadId]
            );
            const currentPhase = String(phaseResult.rows[0]?.current_phase || '').toLowerCase();
            await createNotificationService({
                type: 'raw_data_uploaded',
                title: currentPhase === 'event' ? 'Event raw data ready for approval' : 'Pre-production raw data ready for approval',
                detail: `Data Manager approved raw data for lead ${leadId}.`,
                lead_id: Number.isFinite(Number(leadId)) ? Number(leadId) : undefined,
                from_role: 'data-manager',
                from_name: 'Data Manager',
                target_roles: [currentPhase === 'event' ? 'post-production-crm' : 'pre-production-crm'],
                source_stage: notificationStageFromPhase(currentPhase),
            });
        } catch (e) {
            console.error('Failed to notify CRM about Data Manager approval:', e);
        }

        // Work Tracking: Record milestones
        try {
            const { updateCurrentStageService } = require('../services/stageTracking.service');
            // Notification only for DM milestone, CRM mapping moved to Pixoffice
            console.log('DM approved data for lead:', leadId);
        } catch (e) {
            console.error('Failed to trigger DM stage tracking on approve:', e);
        }

        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("APPROVE MEDIA ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const crmVerifyController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const gate = await pool.query(
            `
            SELECT
              COALESCE(ed.media_status, '') AS media_status,
              EXISTS (
                SELECT 1
                FROM lead_tracking_stages lts
                WHERE lts.external_lead_id::text = $1
                  AND lts.stage_name = 'data_manager_verification'
              ) AS data_manager_verified
            FROM event_details ed
            LEFT JOIN external_leads el
              ON ed.external_lead_id = el.external_id::text
              OR ed.external_lead_id = el.lead_serial_number
            WHERE ed.external_lead_id = $1
               OR el.external_id::text = $1
               OR el.lead_serial_number = $1
            LIMIT 1
            `,
            [leadId]
        );
        const mediaStatus = String(gate.rows[0]?.media_status || '').toLowerCase();
        if (!gate.rows[0]?.data_manager_verified && !['pending_verification', 'verified'].includes(mediaStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Data Manager verification must be completed before CRM verification',
            });
        }

        const data = await updateMediaStatusQuery(leadId, 'crm_verified');
        if (!data) return res.status(404).json({ success: false, message: "Lead not found" });

        // Update Pixoffice QC Status to "QC Completed"
        try {
            await updatePixofficeStatusQuery(leadId, 'QC Completed');
        } catch (e) {
            console.error('Failed to update pixoffice qc_status:', e);
        }

        try {
            const { updateCurrentStageService } = require('../services/stageTracking.service');
            await updateCurrentStageService(leadId, 'crm_verified');
        } catch (e) {
            console.error('Failed to trigger CRM verify stage tracking:', e);
        }

        let crmVerifiedPhase = 'pre_production';
        let crmVerifiedFlowType = '';
        let phaseData: any = null;
        try {
            const phaseResult = await pool.query(
                `SELECT current_phase, flow_type FROM external_leads
                 WHERE external_id::text = $1 OR lead_serial_number = $1
                 LIMIT 1`,
                [leadId]
            );
            crmVerifiedPhase = phaseResult.rows[0]?.current_phase || 'pre_production';
            crmVerifiedFlowType = phaseResult.rows[0]?.flow_type || '';

            if (crmVerifiedPhase === 'event' && crmVerifiedFlowType === 'post_wedding') {
                // Post-wedding: event -> pre-production (CRM assigns shoot team)
                const eventAdvance = await pool.query(
                    `UPDATE external_leads
                     SET current_phase = 'pre_production',
                         pre_production_step = 'shoot',
                         phase_status = 'in_progress',
                         phase_owner = 'pre-production-crm',
                         updated_at = NOW()
                     WHERE external_id::text = $1 OR lead_serial_number = $1
                     RETURNING *`,
                    [leadId]
                );
                phaseData = eventAdvance.rows[0] || null;
                await createNotificationService({
                    type: 'raw_data_uploaded',
                    title: 'Event raw data approved',
                    detail: `Event raw data approved for lead ${leadId}. Assign pre-production shoot team.`,
                    lead_id: Number.isFinite(Number(leadId)) ? Number(leadId) : undefined,
                    from_role: 'post-production-crm',
                    from_name: 'Post-production CRM',
                    target_roles: ['pre-production-crm'],
                    source_stage: 'event',
                });
            } else if (crmVerifiedPhase === 'event') {
                // Pre-wedding: event -> post-production (operational manager assigns editors)
                const eventAdvance = await pool.query(
                    `UPDATE external_leads
                     SET current_phase = 'post_production',
                         phase_status = 'not_started',
                         phase_owner = 'operational-manager',
                         updated_at = NOW()
                     WHERE external_id::text = $1 OR lead_serial_number = $1
                     RETURNING *`,
                    [leadId]
                );
                phaseData = eventAdvance.rows[0] || null;
                await createNotificationService({
                    type: 'raw_data_uploaded',
                    title: 'Event raw data approved',
                    detail: `Event raw data approved for lead ${leadId}. Assign post-production editors.`,
                    lead_id: Number.isFinite(Number(leadId)) ? Number(leadId) : undefined,
                    from_role: 'post-production-crm',
                    from_name: 'Post-production CRM',
                    target_roles: ['operational-manager'],
                    source_stage: 'event',
                });
            } else {
                const { reconcileLeadPhasesService } = require('../services/phaseTracking.service');
                phaseData = await reconcileLeadPhasesService(leadId);
            }
        } catch (e) {
            console.error('Failed to update phase after CRM verification:', e);
        }

        try {
            const stageLabel = crmVerifiedPhase === 'event' ? 'Event' : 'Pre-production';
            await createNotificationService({
                type: 'raw_data_uploaded',
                title: `${stageLabel} Pixoffice approval received`,
                detail: `${stageLabel} QC approval received for lead ${leadId}. Open Pixoffice to continue.`,
                lead_id: Number.isFinite(Number(leadId)) ? Number(leadId) : undefined,
                from_role: crmVerifiedPhase === 'event' ? 'post-production-crm' : 'crm',
                from_name: crmVerifiedPhase === 'event' ? 'Post-production CRM' : 'CRM',
                target_roles: ['data_manager'],
                source_stage: notificationStageFromPhase(crmVerifiedPhase),
            });
        } catch (e) {
            console.error('Failed to notify data manager about CRM approval:', e);
        }

        res.status(200).json({ success: true, data: { media: data, phase: phaseData } });
    } catch (error: any) {
        console.error("CRM VERIFY ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const saveHardDiskClosureController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const data = await saveHardDiskClosureService(leadId, req.body);

        if (req.body.status === 'Closed') {
            await updateMediaStatusQuery(leadId, 'harddisk_closed');
            try {
                const { updateCurrentStageService } = require('../services/stageTracking.service');
                await updateCurrentStageService(leadId, 'harddisk_closed');
            } catch (e) {
                console.error('Failed to trigger harddisk_closed stage tracking:', e);
            }
        }

        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("SAVE HARD DISK CLOSURE ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getHardDiskClosureController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const data = await getHardDiskClosureService(leadId);
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("GET HARD DISK CLOSURE ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getHardDiskStatsController = async (req: Request, res: Response) => {
    try {
        const data = await getHardDiskStatsService();
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error('GET HARD DISK STATS ERROR:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateIncomingDataController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        const data = await updateIncomingDataService(leadId, req.body);
        if (!data) return res.status(404).json({ success: false, message: "Lead not found" });
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("UPDATE INCOMING DATA ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteIncomingDataController = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId);
        await deleteIncomingDataService(leadId);
        res.status(200).json({ success: true, message: "Incoming data deleted effectively" });
    } catch (error: any) {
        console.error("DELETE INCOMING DATA ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
