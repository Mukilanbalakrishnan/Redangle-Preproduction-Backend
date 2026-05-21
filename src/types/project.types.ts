export interface AssignProjectDTO {
  project_id: string;      // Using external_lead_id or unique CRM format
  employee_id: string;
  project_name: string;
  project_type: string;
}

export interface UpdateProjectStatusDTO {
  status: string; // 'In Progress', 'Pending', 'Review', 'Completed', etc.
}

export interface AssignedProjectRecord {
  id: number;
  project_id: string;
  project_name: string;
  project_type: string;
  employee_id: string;
  status: string;
  upload_link?: string;
  upload_notes?: string;
  admin_notes?: string;
  created_at?: string;
  updated_at?: string;
  
  // Joins
  employee_name?: string;
}

export interface ApprovedDriveLinkRecord {
  id: number;
  project_id: string;
  project_name: string;
  project_type: string;
  employee_id: string;
  upload_link: string;
  admin_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  sent_to_client?: boolean;
  // Joins
  employee_name?: string;
}

export interface CRMFinalApprovalRecord {
  id: number;
  project_id: string;
  checked_items: number[];
  rework_notes?: string;
  review_status: string;
  change_source?: string;
  change_notes?: string;
  assigned_to?: string;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
}
