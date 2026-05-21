import { Request, Response } from "express";
import {
  assignProjectService,
  getAssignedProjectsByEmployeeService,
  getProjectsByEmployeeAndTypeService,
  getReworkRequestsService,
  getAssignmentsByProjectIdService,
  updateProjectStatusService,
  submitUploadLinkService,
  reviewProjectService,
  getAllAssignedProjectsService,
  saveApprovedDriveLinkService,
  getApprovedDriveLinksByProjectIdService,
  getApprovedClientsService,
  sendLinksToClientService,
  replaceProjectAssignmentsForTypesService,
  getCRMFinalApprovalByProjectIdService,
  upsertCRMFinalApprovalService,
} from "../services/project.service";
import { updateLeadStatusQuery } from "../queries/externalLead.query";

export const assignProjectController = async (req: Request, res: Response) => {
  try {
    const { project_id, employee_id, project_name, project_type } = req.body;

    if (!project_id || !employee_id || !project_name) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const data = await assignProjectService(req.body);

    res.status(201).json({
      success: true,
      data,
      message: "Project assigned successfully"
    });
  } catch (error: any) {
    console.error("ASSIGN PROJECT ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAssignedProjectsByEmployeeController = async (req: Request, res: Response) => {
  try {
    const { employee_id } = req.params;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: "employee_id parameter is required" });
    }

    const data = await getAssignedProjectsByEmployeeService(String(employee_id));

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error("GET ASSIGNED PROJECTS EROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateProjectStatusController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ success: false, message: "id and status are required" });
    }

    const data = await updateProjectStatusService(id, { status });

    res.status(200).json({
      success: true,
      data,
      message: "Project status updated successfully"
    });
  } catch (error: any) {
    console.error("UPDATE PROJECT STATUS ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getProjectsByEmployeeAndTypeController = async (req: Request, res: Response) => {
  try {
    const { employee_id, project_type } = req.params;
    if (!employee_id || !project_type) {
      return res.status(400).json({ success: false, message: "employee_id and project_type are required" });
    }

    const data = await getProjectsByEmployeeAndTypeService(String(employee_id), decodeURIComponent(String(project_type)));
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("GET PROJECTS BY TYPE ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReworkRequestsController = async (req: Request, res: Response) => {
  try {
    const { employee_id } = req.params;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: "employee_id is required" });
    }

    const data = await getReworkRequestsService(String(employee_id));
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("GET REWORK REQUESTS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAssignmentsByProjectIdController = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.params;
    if (!project_id) {
      return res.status(400).json({ success: false, message: "project_id is required" });
    }
    const data = await getAssignmentsByProjectIdService(String(project_id));
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("GET ASSIGNMENTS BY PROJECT ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignProjectBatchController = async (req: Request, res: Response) => {
  try {
    const { external_lead_id, project_name, editors, assistants, phase } = req.body;

    if (!external_lead_id || !project_name || !editors) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const assignments = [];

    // Map the dropdown roles to the project type names
    const roleMap: Record<string, string> = {
      saveTheDate: "Save the Date",
      saveTheVideo: "Save the Video",
      retouching: "Retouching",
      traditionalVideo: "Traditional Video Editing",
      traditionalPhoto: "Retouch Editing",
      albumDesign: "Album Design",
      candidVideo: "Candid Video Editing"
    };
    const preProductionTypes = ["Save the Date", "Save the Video", "Retouching"];
    const postProductionTypes = [
      "Traditional Video Editing",
      "Retouch Editing",
      "Album Design",
      "Candid Video Editing"
    ];
    const editableProjectTypes = phase === "post_production"
      ? [...postProductionTypes]
      : [...preProductionTypes];
    if (assistants && Array.isArray(assistants)) {
      editableProjectTypes.push("Assistant");
    }

    for (const [key, employee_id] of Object.entries(editors)) {
      if (employee_id && roleMap[key]) {
        assignments.push({
          project_id: `CRM-${external_lead_id}`,
          project_name,
          project_type: roleMap[key],
          employee_id: employee_id as string
        });
      }
    }

    if (assistants && Array.isArray(assistants)) {
      for (const assistant of assistants) {
        assignments.push({
          project_id: `CRM-${external_lead_id}`,
          project_name,
          project_type: "Assistant",
          employee_id: assistant
        });
      }
    }

    await replaceProjectAssignmentsForTypesService(
      `CRM-${external_lead_id}`,
      editableProjectTypes,
      assignments
    );

    // Update the lead status
    await updateLeadStatusQuery(external_lead_id, "editing_in_progress");

    res.status(201).json({
      success: true,
      message: "Editors and assistants assigned successfully",
      count: assignments.length
    });
  } catch (error: any) {
    console.error("ASSIGN BATCH ERR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Editor submits completed work + upload link → status becomes 'Completed'
export const submitUploadLinkController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { upload_link, upload_notes } = req.body;
    if (!id || !upload_link) {
      return res.status(400).json({ success: false, message: "id and upload_link are required" });
    }
    const data = await submitUploadLinkService(id, upload_link, upload_notes || '');
    res.status(200).json({ success: true, data, message: "Upload link submitted, status set to Completed" });
  } catch (error: any) {
    console.error("SUBMIT UPLOAD LINK ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin approves or requests re-upload
export const reviewProjectController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status, admin_notes } = req.body;
    // We assume there will be some authentication middleware later that might provide req.user
    const approved_by = 'Admin'; // Hardcoding for now

    if (!id || !status || !['Approved', 'Rework'].includes(status)) {
      return res.status(400).json({ success: false, message: "id and status (Approved|Rework) are required" });
    }
    const data = await reviewProjectService(id, status as 'Approved' | 'Rework', admin_notes);
    
    if (status === 'Approved') {
      // If approved, add to approved_drive_links table
      if (data.upload_link) {
        await saveApprovedDriveLinkService({
          id: 0, // Generated by DB
          project_id: data.project_id,
          project_name: data.project_name,
          project_type: data.project_type,
          employee_id: data.employee_id,
          upload_link: data.upload_link,
          admin_notes: admin_notes || '',
          approved_by
        });
      }

      // Stage progression is gated by client delivery approval.
      // CRM approval only makes the editor link available for sending.
    }

    res.status(200).json({ success: true, data, message: `Project ${status.toLowerCase()} successfully` });
  } catch (error: any) {
    console.error("REVIEW PROJECT ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getApprovedDriveLinksByProjectIdController = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.params;
    if (!project_id) {
      return res.status(400).json({ success: false, message: "project_id is required" });
    }
    const data = await getApprovedDriveLinksByProjectIdService(String(project_id));
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("GET APPROVED DRIVE LINKS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all assigned projects (for edit approval page)
export const getAllAssignedProjectsController = async (req: Request, res: Response) => {
  try {
    const data = await getAllAssignedProjectsService();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("GET ALL ASSIGNED PROJECTS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getApprovedClientsController = async (req: Request, res: Response) => {
  try {
    const data = await getApprovedClientsService();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("GET APPROVED CLIENTS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendLinksToClientController = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.params;
    if (!project_id) {
      return res.status(400).json({ success: false, message: "project_id is required" });
    }
    const data = await sendLinksToClientService(String(project_id));
    res.status(200).json({ success: true, data, message: "Links successfully marked as sent to client" });
  } catch (error: any) {
    console.error("SEND LINKS TO CLIENT ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCRMFinalApprovalByProjectIdController = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.params;
    if (!project_id) {
      return res.status(400).json({ success: false, message: "project_id is required" });
    }

    const data = await getCRMFinalApprovalByProjectIdService(String(project_id));
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("GET CRM FINAL APPROVAL ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertCRMFinalApprovalController = async (req: Request, res: Response) => {
  try {
    const { project_id } = req.params;
    const {
      checked_items,
      rework_notes,
      review_status,
      change_source,
      change_notes,
      assigned_to,
    } = req.body;

    const validStatuses = ['pending_review', 'changes_pending', 'changes_completed', 'client_approved'];

    if (!project_id) {
      return res.status(400).json({ success: false, message: "project_id is required" });
    }

    if (!Array.isArray(checked_items) || !checked_items.every((item) => Number.isInteger(item))) {
      return res.status(400).json({ success: false, message: "checked_items must be an array of integers" });
    }

    if (!review_status || !validStatuses.includes(review_status)) {
      return res.status(400).json({ success: false, message: `review_status must be one of: ${validStatuses.join(', ')}` });
    }

    const data = await upsertCRMFinalApprovalService({
      project_id: String(project_id),
      checked_items,
      rework_notes,
      review_status,
      change_source,
      change_notes,
      assigned_to,
    });

    return res.status(200).json({ success: true, data, message: "Final approval state saved" });
  } catch (error: any) {
    console.error("UPSERT CRM FINAL APPROVAL ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
