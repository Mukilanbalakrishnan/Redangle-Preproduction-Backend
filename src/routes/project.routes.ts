import { Router } from "express";
import {
  assignProjectController,
  getAssignedProjectsByEmployeeController,
  getProjectsByEmployeeAndTypeController,
  getReworkRequestsController,
  getAssignmentsByProjectIdController,
  updateProjectStatusController,
  assignProjectBatchController,
  submitUploadLinkController,
  reviewProjectController,
  getAllAssignedProjectsController,
  getApprovedDriveLinksByProjectIdController,
  getApprovedClientsController,
  sendLinksToClientController,
  getCRMFinalApprovalByProjectIdController,
  upsertCRMFinalApprovalController,
} from "../controllers/project.controller";
import {
  endWorkRuntimeController,
  getProjectWorkRuntimeSummaryController,
  getWorkRuntimeStatusController,
  pauseWorkRuntimeController,
  startWorkRuntimeController,
} from "../controllers/workRuntime.controller";

const router = Router();

// Note: Uses a different path than original assignTeam so it acts as employee-specific project assignments.
router.post("/employee-projects", assignProjectController);
router.post("/employee-projects/batch", assignProjectBatchController);
// Get all assigned projects (for edit approval page)
router.get("/employee-projects/all", getAllAssignedProjectsController);
router.get("/employee-projects/employee/:employee_id/type/:project_type", getProjectsByEmployeeAndTypeController);
router.get("/employee-projects/employee/:employee_id/reworks", getReworkRequestsController);
router.get("/employee-projects/employee/:employee_id", getAssignedProjectsByEmployeeController);
router.get("/employee-projects/project/:project_id/work-runtime-summary", getProjectWorkRuntimeSummaryController);
router.get("/employee-projects/project/:project_id", getAssignmentsByProjectIdController);
router.get("/employee-projects/:id/work-runtime", getWorkRuntimeStatusController);
router.patch("/employee-projects/:id/work-runtime/start", startWorkRuntimeController);
router.patch("/employee-projects/:id/work-runtime/pause", pauseWorkRuntimeController);
router.patch("/employee-projects/:id/work-runtime/end", endWorkRuntimeController);
router.put("/employee-projects/:id/status", updateProjectStatusController);
// Editor: submit upload link (sets status = Completed)
router.put("/employee-projects/:id/submit-link", submitUploadLinkController);
// Admin/CRM: approve or request rework
router.put("/employee-projects/:id/review", reviewProjectController);
// Get approved drive links for a project
router.get("/employee-projects/project/:project_id/approved-links", getApprovedDriveLinksByProjectIdController);
router.get("/employee-projects/project/:project_id/final-approval", getCRMFinalApprovalByProjectIdController);
router.put("/employee-projects/project/:project_id/final-approval", upsertCRMFinalApprovalController);
// Client Approval Workflow
router.get("/employee-projects/approved-clients", getApprovedClientsController);
router.put("/employee-projects/project/:project_id/send-to-client", sendLinksToClientController);
export default router;
