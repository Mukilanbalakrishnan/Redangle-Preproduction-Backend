import { Router } from "express";
import {
    getCrmAttendance,
    getCrmWorkTracking,
    getCrmLeaveManagement,
    updateLeaveStatus,
    getCrmRawData,
    getCrmReports,
    verifyCrmRawData,
    assignCrmEditors,
    getRawDataDeliverySummary,
    sendRawDataToClient,
    getFinalDeliverySummary,
    sendFinalDeliveryToClient,
    approveClientDeliveryAndAdvance,
    createClientDeliveryQueryNotification
} from "../controllers/crm.controller";
import {
    setFlowTypeController,
    advancePhaseController,
    getPhaseInfoController,
    updatePhaseStatusController,
    getPreProductionStepController,
    approveShootPhaseController,
    approveEditingPhaseController,
    checkPhase2EditorsController,
    getPhase2SubmissionStatusController,
} from "../controllers/phaseTracking.controller";

const router = Router();

router.get("/crm/attendance", getCrmAttendance);
router.get("/crm/work-tracking", getCrmWorkTracking);
router.get("/crm/leave-management", getCrmLeaveManagement);
router.patch("/crm/leave-requests/:id", updateLeaveStatus);
router.get("/crm/raw-data", getCrmRawData);
router.get("/crm/raw-data/:leadId/delivery", getRawDataDeliverySummary);
router.post("/crm/raw-data/:leadId/send-to-client", sendRawDataToClient);
router.get("/crm/projects/:projectId/final-delivery", getFinalDeliverySummary);
router.post("/crm/projects/:projectId/send-final-to-client", sendFinalDeliveryToClient);
router.patch("/crm/client-deliveries/:leadId/client-approve", approveClientDeliveryAndAdvance);
router.patch("/data-manager/:leadId/client-approve", approveClientDeliveryAndAdvance);
router.post("/data-manager/:leadId/client-query", createClientDeliveryQueryNotification);
router.patch("/crm/raw-data/:id/verify", verifyCrmRawData);
router.post("/crm/assign-editors/:id", assignCrmEditors);
router.get("/crm/reports", getCrmReports);

// Phase tracking
router.patch("/crm/leads/:leadId/flow-type", setFlowTypeController);
router.patch("/crm/leads/:leadId/advance-phase", advancePhaseController);
router.patch("/crm/leads/:leadId/phase-status", updatePhaseStatusController);
router.get("/crm/leads/:leadId/phase-info", getPhaseInfoController);

// Pre-production sub-phase routes
router.get("/crm/leads/:leadId/pre-production-step", getPreProductionStepController);
router.patch("/crm/leads/:leadId/approve-shoot-phase", approveShootPhaseController);
router.patch("/crm/leads/:leadId/approve-editing-phase", approveEditingPhaseController);
router.get("/crm/leads/:leadId/phase2-editors", checkPhase2EditorsController);
router.get("/crm/leads/:leadId/phase2-submissions", getPhase2SubmissionStatusController);

export default router;
