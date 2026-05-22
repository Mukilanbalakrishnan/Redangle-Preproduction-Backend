import {
  createProjectTablesQuery,
  assignProjectQuery,
  getAssignedProjectsByEmployeeQuery,
  getProjectsByEmployeeAndTypeQuery,
  getReworkRequestsQuery,
  getAssignmentsByProjectIdQuery,
  updateProjectStatusQuery,
  submitUploadLinkQuery,
  reviewProjectQuery,
  getAllAssignedProjectsQuery,
  saveApprovedDriveLinkQuery,
  getApprovedDriveLinksByProjectIdQuery,
  getApprovedClientsQuery,
  sendLinksToClientQuery,
  replaceProjectAssignmentsForTypesQuery,
  markLeadCompletedIfPostProductionApprovedQuery,
  markLeadSubmittedIfPostProductionCompletedQuery,
  markLeadAdvancedIfPreProductionApprovedQuery,
  getCRMFinalApprovalByProjectIdQuery,
  upsertCRMFinalApprovalQuery,
} from "../queries/project.query";
import {
  endWorkRuntimeQuery,
  getProjectWorkRuntimeSummaryQuery,
  getWorkRuntimeStatusQuery,
  pauseWorkRuntimeQuery,
  startWorkRuntimeQuery,
} from "../queries/workRuntime.query";
import { AssignProjectDTO, UpdateProjectStatusDTO, ApprovedDriveLinkRecord } from "../types/project.types";

// Ensure tables exist on startup (simple migration)
createProjectTablesQuery().catch(console.error);

export const assignProjectService = async (data: AssignProjectDTO) => {
  return await assignProjectQuery(data);
};

export const replaceProjectAssignmentsForTypesService = async (
  project_id: string,
  projectTypes: string[],
  assignments: AssignProjectDTO[]
) => {
  return await replaceProjectAssignmentsForTypesQuery(project_id, projectTypes, assignments);
};

export const getAssignedProjectsByEmployeeService = async (employee_id: string) => {
  return await getAssignedProjectsByEmployeeQuery(employee_id);
};

export const getProjectsByEmployeeAndTypeService = async (employee_id: string, project_type: string) => {
  return await getProjectsByEmployeeAndTypeQuery(employee_id, project_type);
};

export const getReworkRequestsService = async (employee_id: string) => {
  return await getReworkRequestsQuery(employee_id);
};

export const getAssignmentsByProjectIdService = async (project_id: string) => {
  return await getAssignmentsByProjectIdQuery(project_id);
};

export const updateProjectStatusService = async (id: number, data: UpdateProjectStatusDTO) => {
  return await updateProjectStatusQuery(id, data);
};

// Editor submits work with upload link → status becomes 'Completed'
export const submitUploadLinkService = async (id: number, upload_link: string, upload_notes: string = '') => {
  const project = await submitUploadLinkQuery(id, upload_link, upload_notes);
  if (project?.project_id) {
    await markLeadSubmittedIfPostProductionCompletedQuery(project.project_id);
  }
  return project;
};

// Admin reviews: 'Approved' or 'Rework'
export const reviewProjectService = async (id: number, status: 'Approved' | 'Rework', admin_notes?: string) => {
  return await reviewProjectQuery(id, status, admin_notes);
};

// Fetch all assigned projects for edit approval listing
export const getAllAssignedProjectsService = async () => {
  return await getAllAssignedProjectsQuery();
};

export const saveApprovedDriveLinkService = async (data: ApprovedDriveLinkRecord) => {
  return await saveApprovedDriveLinkQuery(data);
};

export const getApprovedDriveLinksByProjectIdService = async (project_id: string) => {
  return await getApprovedDriveLinksByProjectIdQuery(project_id);
};

export const getApprovedClientsService = async () => {
  return await getApprovedClientsQuery();
};

export const sendLinksToClientService = async (project_id: string) => {
  return await sendLinksToClientQuery(project_id);
};

export const markLeadCompletedIfPostProductionApprovedService = async (project_id: string) => {
  return await markLeadCompletedIfPostProductionApprovedQuery(project_id);
};

export const markLeadAdvancedIfPreProductionApprovedService = async (project_id: string) => {
  return await markLeadAdvancedIfPreProductionApprovedQuery(project_id);
};

export const getCRMFinalApprovalByProjectIdService = async (project_id: string) => {
  return await getCRMFinalApprovalByProjectIdQuery(project_id);
};

export const upsertCRMFinalApprovalService = async (data: {
  project_id: string;
  checked_items: number[];
  rework_notes?: string;
  review_status: string;
  change_source?: string;
  change_notes?: string;
  assigned_to?: string;
}) => {
  return await upsertCRMFinalApprovalQuery(data);
};

export const getWorkRuntimeStatusService = async (assignmentId: number) => {
  return await getWorkRuntimeStatusQuery(assignmentId);
};

export const startWorkRuntimeService = async (assignmentId: number, startedBy: string, workDate?: string) => {
  return await startWorkRuntimeQuery(assignmentId, startedBy, workDate);
};

export const pauseWorkRuntimeService = async (assignmentId: number, workDate?: string) => {
  return await pauseWorkRuntimeQuery(assignmentId, workDate);
};

export const endWorkRuntimeService = async (assignmentId: number, endedBy?: string, workDate?: string) => {
  return await endWorkRuntimeQuery(assignmentId, endedBy, workDate);
};

export const getProjectWorkRuntimeSummaryService = async (projectId: string) => {
  return await getProjectWorkRuntimeSummaryQuery(projectId);
};
