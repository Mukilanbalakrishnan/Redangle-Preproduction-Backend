import { Request, Response } from "express";
import {
    getCrmAttendanceQuery,
    getCrmWorkTrackingQuery,
    getCrmLeaveManagementQuery,
    updateLeaveStatusQuery,
    getCrmRawDataQuery,
    getCrmReportsQuery,
    getRawDataDeliverySummaryQuery,
    sendRawDataToClientQuery,
    getFinalDeliverySummaryQuery,
    sendFinalDeliveryToClientQuery,
    markClientDeliveryApprovedForLeadQuery,
    getClientDeliveryLeadContextQuery,
} from "../queries/crm.queries";
import { createNotificationService } from "../services/notification.service";
import { updateCurrentStageService } from "../services/stageTracking.service";
import {
    advancePhaseService,
    advanceToEditingStepService,
    completeEditingStepService,
    updatePhaseStatusService,
} from "../services/phaseTracking.service";

export const getCrmAttendance = async (req: Request, res: Response) => {
    try {
        const date = req.query.date as string | undefined;
        const data = await getCrmAttendanceQuery(date);
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("CRM ATTENDANCE ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getCrmWorkTracking = async (req: Request, res: Response) => {
    try {
        const data = await getCrmWorkTrackingQuery();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("CRM WORK TRACKING ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

//data without conflict

export const getCrmLeaveManagement = async (req: Request, res: Response) => {
    try {
        const data = await getCrmLeaveManagementQuery();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("CRM LEAVE MANAGEMENT ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateLeaveStatus = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        const { status } = req.body;
        if (!["Approved", "Rejected"].includes(status)) {
            res.status(400).json({ success: false, message: "Status must be Approved or Rejected" });
            return;
        }
        const data = await updateLeaveStatusQuery(id, status);
        if (!data) {
            res.status(404).json({ success: false, message: "Leave request not found" });
            return;
        }
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("UPDATE LEAVE STATUS ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getCrmRawData = async (req: Request, res: Response) => {
    try {
        const data = await getCrmRawDataQuery();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("CRM RAW DATA ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRawDataDeliverySummary = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId || '');
        const data = await getRawDataDeliverySummaryQuery(leadId);
        if (!data) {
            res.status(404).json({ success: false, message: "Raw data delivery record not found" });
            return;
        }
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("RAW DATA DELIVERY SUMMARY ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendRawDataToClient = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId || '');
        const data = await sendRawDataToClientQuery(leadId, req.body?.notes);
        if (!data) {
            res.status(404).json({ success: false, message: "Raw data delivery record not found" });
            return;
        }
        res.json({ success: true, data, message: "Delivery details sent to client successfully!" });
    } catch (error: any) {
        console.error("SEND RAW DATA TO CLIENT ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getFinalDeliverySummary = async (req: Request, res: Response) => {
    try {
        const projectId = String(req.params.projectId || '');
        const data = await getFinalDeliverySummaryQuery(projectId);
        if (!data) {
            res.status(404).json({ success: false, message: "Final delivery record not found" });
            return;
        }
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("FINAL DELIVERY SUMMARY ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendFinalDeliveryToClient = async (req: Request, res: Response) => {
    try {
        const projectId = String(req.params.projectId || '');
        const data = await sendFinalDeliveryToClientQuery(projectId, req.body?.notes);
        if (!data) {
            res.status(404).json({ success: false, message: "Final delivery record not found" });
            return;
        }
        res.json({ success: true, data, message: "Final delivery sent to client successfully!" });
    } catch (error: any) {
        console.error("SEND FINAL DELIVERY TO CLIENT ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const advanceAfterClientApproval = async (leadId: string, deliveryType: string, lead: any) => {
    const currentPhase = String(lead.current_phase || '').toLowerCase();
    const preProductionStep = String(lead.pre_production_step || 'shoot').toLowerCase();

    if (deliveryType === 'RAW_DATA' && currentPhase === 'pre_production' && preProductionStep === 'shoot') {
        return {
            action: 'pre_production_shoot_approved',
            data: await advanceToEditingStepService(leadId),
        };
    }

    if (deliveryType === 'EVENT_RAW_DATA' && currentPhase === 'event') {
        await updatePhaseStatusService(leadId, 'approved');
        return {
            action: 'event_approved_and_advanced',
            data: await advancePhaseService(leadId),
        };
    }

    if (deliveryType === 'FINAL_DELIVERABLES' && currentPhase === 'pre_production' && preProductionStep === 'editing') {
        await completeEditingStepService(leadId);
        return {
            action: 'pre_production_editing_approved_and_advanced',
            data: await advancePhaseService(leadId),
        };
    }

    if (deliveryType === 'FINAL_DELIVERABLES' && currentPhase === 'post_production') {
        await updatePhaseStatusService(leadId, 'approved');
        return {
            action: 'post_production_completed',
            data: await advancePhaseService(leadId),
        };
    }

    return {
        action: 'delivery_approved_no_phase_change',
        data: lead,
    };
};

const getLeadDisplayId = (leadId: string, lead?: any) =>
    String(lead?.lead_serial_number || lead?.external_id || leadId || '').replace(/^CRM-/i, '');

const getNotificationLeadId = (leadId: string, lead?: any) => {
    const numericId = Number(getLeadDisplayId(leadId, lead));
    return Number.isFinite(numericId) ? numericId : undefined;
};

const resolveClientDeliveryCrmRole = (deliveryType: string, lead: any) => {
    const currentPhase = String(lead?.current_phase || '').toLowerCase();
    const preProductionStep = String(lead?.pre_production_step || '').toLowerCase();

    if (!lead && deliveryType === 'FINAL_DELIVERABLES') return 'post-production-crm';
    if (deliveryType === 'RAW_DATA' && currentPhase === 'pre_production') return 'pre-production-crm';
    if (deliveryType === 'RAW_DATA' && !currentPhase) return 'pre-production-crm';
    if (deliveryType === 'EVENT_RAW_DATA') return 'post-production-crm';
    if (deliveryType === 'FINAL_DELIVERABLES' && currentPhase === 'post_production') return 'post-production-crm';
    if (deliveryType === 'FINAL_DELIVERABLES' && currentPhase === 'pre_production' && preProductionStep === 'editing') return 'pre-production-crm';

    return lead?.phase_owner || (
        currentPhase === 'event'
            ? 'post-production-crm'
            : currentPhase === 'post_production'
                ? 'post-production-crm'
                : 'pre-production-crm'
    );
};

const resolveClientDeliverySourceStage = (deliveryType: string, lead: any) => {
    const currentPhase = String(lead?.current_phase || '').toLowerCase();
    if (deliveryType === 'EVENT_RAW_DATA' || currentPhase === 'event') return 'event';
    if (currentPhase === 'post_production') return 'post-production';
    if (deliveryType === 'FINAL_DELIVERABLES') return 'client';
    return 'pre-production';
};

const deliveryTypeLabel = (deliveryType: string) => {
    if (deliveryType === 'RAW_DATA') return 'incoming raw data';
    if (deliveryType === 'EVENT_RAW_DATA') return 'event raw data';
    if (deliveryType === 'FINAL_DELIVERABLES') return 'final deliverables';
    return String(deliveryType || 'delivery').replace(/_/g, ' ').toLowerCase();
};

const notifyClientDeliveryResponse = async ({
    type,
    leadId,
    lead,
    deliveryType,
    comment,
}: {
    type: 'approval' | 'query';
    leadId: string;
    lead: any;
    deliveryType: string;
    comment?: string;
}) => {
    const displayId = getLeadDisplayId(leadId, lead);
    const targetRole = resolveClientDeliveryCrmRole(deliveryType, lead);
    const label = deliveryTypeLabel(deliveryType);
    const cleanComment = String(comment || '').trim();

    await createNotificationService({
        type: type === 'approval' ? 'client_delivery' : 'query',
        title: type === 'approval' ? `Client approved ${label}` : `Client raised a query on ${label}`,
        detail: `${type === 'approval' ? 'Approval' : 'Query'} received for lead ${displayId}.${cleanComment ? ` Comment: ${cleanComment}` : ''}`,
        lead_id: getNotificationLeadId(leadId, lead),
        from_role: 'client',
        from_name: 'Client',
        target_roles: [targetRole],
        source_stage: resolveClientDeliverySourceStage(deliveryType, lead),
    });
};

export const approveClientDeliveryAndAdvance = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId || req.body?.leadId || '');
        const deliveryType = String(req.body?.deliveryType || req.query.deliveryType || '').trim();
        const deliveryId = req.body?.deliveryId || req.query.deliveryId;
        const comment = String(req.body?.comment || '').trim();

        if (!leadId) {
            res.status(400).json({ success: false, message: "leadId is required" });
            return;
        }

        const result = await markClientDeliveryApprovedForLeadQuery(leadId, deliveryType, deliveryId);
        if (!result) {
            res.status(404).json({ success: false, message: "Lead not found" });
            return;
        }

        const approvedDeliveryType = String(result.delivery?.delivery_type || deliveryType || '').trim();
        if (!approvedDeliveryType) {
            res.status(400).json({ success: false, message: "deliveryType is required" });
            return;
        }

        try {
            await notifyClientDeliveryResponse({
                type: 'approval',
                leadId,
                lead: result.lead,
                deliveryType: approvedDeliveryType,
                comment,
            });
        } catch (error: any) {
            console.error("CLIENT DELIVERY APPROVAL NOTIFICATION ERROR:", error.message);
        }

        const phaseResult = await advanceAfterClientApproval(leadId, approvedDeliveryType, result.lead);
        res.json({
            success: true,
            data: {
                delivery: result.delivery,
                phase: phaseResult.data,
                action: phaseResult.action,
            },
            message: "Client approval recorded and workflow gate processed",
        });
    } catch (error: any) {
        console.error("CLIENT DELIVERY APPROVAL GATE ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createClientDeliveryQueryNotification = async (req: Request, res: Response) => {
    try {
        const leadId = String(req.params.leadId || req.body?.leadId || '');
        const deliveryType = String(req.body?.deliveryType || req.query.deliveryType || '').trim();
        const queryMessage = String(req.body?.queryMessage || req.body?.comment || '').trim();

        if (!leadId) {
            res.status(400).json({ success: false, message: "leadId is required" });
            return;
        }

        if (!queryMessage) {
            res.status(400).json({ success: false, message: "queryMessage is required" });
            return;
        }

        const lead = await getClientDeliveryLeadContextQuery(leadId);

        const resolvedDeliveryType = deliveryType || (
            String(lead?.current_phase || '').toLowerCase() === 'event'
                ? 'EVENT_RAW_DATA'
                : 'RAW_DATA'
        );

        await notifyClientDeliveryResponse({
            type: 'query',
            leadId,
            lead,
            deliveryType: resolvedDeliveryType,
            comment: queryMessage,
        });

        res.json({ success: true, message: "Client query notification created" });
    } catch (error: any) {
        console.error("CLIENT DELIVERY QUERY NOTIFICATION ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getCrmReports = async (req: Request, res: Response) => {
    try {
        const data = await getCrmReportsQuery();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("CRM REPORTS ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyCrmRawData = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) {
            res.status(400).json({ success: false, message: "Invalid ID" });
            return;
        }

        // Fire the crm_verified stage
        await updateCurrentStageService(id, 'crm_verified');

        res.json({ success: true, message: "CRM Verified successfully" });
    } catch (error: any) {
        console.error("CRM VERIFY ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const assignCrmEditors = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) {
            res.status(400).json({ success: false, message: "Invalid ID" });
            return;
        }

        // In a real flow, you would save the actual editor assignments to the DB.
        // For now, we will just trigger the tracker.
        await updateCurrentStageService(id, 'editor_team_assigned');

        res.json({ success: true, message: "Editors assigned successfully" });
    } catch (error: any) {
        console.error("CRM ASSIGN EDITORS ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
