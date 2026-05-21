import { pool } from "../config/db";
import { AssignProjectDTO, UpdateProjectStatusDTO, AssignedProjectRecord, ApprovedDriveLinkRecord, CRMFinalApprovalRecord } from "../types/project.types";
import { ensureEventUploadColumnsQuery } from "./eventDetails.query";

export const createProjectTablesQuery = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assigned_projects (
      id SERIAL PRIMARY KEY,
      project_id VARCHAR(100) NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      project_type VARCHAR(100),
      employee_id VARCHAR(100) NOT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      upload_link TEXT,
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(project_id, employee_id, project_type)
    );

    CREATE TABLE IF NOT EXISTS approved_drive_links (
      id SERIAL PRIMARY KEY,
      project_id VARCHAR(100) NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      project_type VARCHAR(100),
      employee_id VARCHAR(100) NOT NULL,
      upload_link TEXT NOT NULL,
      admin_notes TEXT,
      approved_by VARCHAR(100),
      approved_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      sent_to_client BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS crm_final_approvals (
      id SERIAL PRIMARY KEY,
      project_id VARCHAR(100) NOT NULL UNIQUE,
      checked_items INTEGER[] DEFAULT '{}',
      rework_notes TEXT,
      review_status VARCHAR(50) DEFAULT 'pending_review',
      change_source VARCHAR(20),
      change_notes TEXT,
      assigned_to VARCHAR(255),
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Migrate existing table constraints and add new columns
  await pool.query(`
    ALTER TABLE assigned_projects DROP CONSTRAINT IF EXISTS assigned_projects_employee_id_fkey;
    ALTER TABLE assigned_projects DROP CONSTRAINT IF EXISTS assigned_projects_project_id_employee_id_key;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assigned_projects_unique_assignment') THEN
        ALTER TABLE assigned_projects ADD CONSTRAINT assigned_projects_unique_assignment UNIQUE (project_id, employee_id, project_type);
      END IF;
    END $$;
    ALTER TABLE assigned_projects ALTER COLUMN employee_id TYPE VARCHAR(100);
    ALTER TABLE assigned_projects ADD COLUMN IF NOT EXISTS upload_link TEXT;
    ALTER TABLE assigned_projects ADD COLUMN IF NOT EXISTS upload_notes TEXT;
    ALTER TABLE assigned_projects ADD COLUMN IF NOT EXISTS admin_notes TEXT;
    ALTER TABLE approved_drive_links ADD COLUMN IF NOT EXISTS sent_to_client BOOLEAN DEFAULT FALSE;
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS checked_items INTEGER[] DEFAULT '{}';
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS rework_notes TEXT;
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'pending_review';
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS change_source VARCHAR(20);
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS change_notes TEXT;
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE crm_final_approvals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);
};

export const assignProjectQuery = async (data: AssignProjectDTO): Promise<AssignedProjectRecord> => {
  const result = await pool.query(
    `
    INSERT INTO assigned_projects (project_id, project_name, project_type, employee_id, status)
    VALUES ($1, $2, $3, $4, 'Pending')
    ON CONFLICT (project_id, employee_id, project_type)
    DO UPDATE SET project_name = EXCLUDED.project_name, status = 'Pending', updated_at = NOW()
    RETURNING *;
    `,
    [data.project_id, data.project_name, data.project_type, data.employee_id]
  );
  return result.rows[0];
};

export const replaceProjectAssignmentsForTypesQuery = async (
  project_id: string,
  projectTypes: string[],
  assignments: AssignProjectDTO[]
): Promise<AssignedProjectRecord[]> => {
  await createProjectTablesQuery();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM assigned_projects
      WHERE project_id = $1
        AND project_type = ANY($2::text[])
        AND LOWER(status) IN ('pending', 'accepted', 'rework')
      `,
      [project_id, projectTypes]
    );

    const synced: AssignedProjectRecord[] = [];
    for (const assignment of assignments) {
      const result = await client.query(
        `
        INSERT INTO assigned_projects (project_id, project_name, project_type, employee_id, status)
        VALUES ($1, $2, $3, $4, 'Pending')
        ON CONFLICT (project_id, employee_id, project_type)
        DO UPDATE SET
          project_name = EXCLUDED.project_name,
          status = CASE
            WHEN LOWER(assigned_projects.status) IN ('completed', 'approved') THEN assigned_projects.status
            ELSE 'Pending'
          END,
          updated_at = NOW()
        RETURNING *;
        `,
        [
          assignment.project_id,
          assignment.project_name,
          assignment.project_type,
          assignment.employee_id,
        ]
      );

      synced.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return synced;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

type PreProductionProjectAssignment = {
  employee_id: string;
  project_type: "Save the Date" | "Save the Video" | "Retouching";
};

const getProjectNameForLead = async (
  externalLeadId: string | number
): Promise<string> => {
  const fallbackName = `Lead #${externalLeadId}`;
  const result = await pool.query(
    `
    SELECT COALESCE(
      NULLIF(TRIM(ed.client_name), ''),
      NULLIF(TRIM(el.lead_name), ''),
      $2
    ) AS project_name
    FROM external_leads el
    LEFT JOIN event_details ed ON ed.external_lead_id = el.external_id
    WHERE el.external_id = $1 OR el.lead_serial_number = $1
    LIMIT 1
    `,
    [String(externalLeadId), fallbackName]
  );

  return result.rows[0]?.project_name || fallbackName;
};

export const syncPreProductionAssignmentsQuery = async (
  externalLeadId: string | number,
  assignments: PreProductionProjectAssignment[]
): Promise<AssignedProjectRecord[]> => {
  await createProjectTablesQuery();

  const projectId = `CRM-${externalLeadId}`;
  const projectName = await getProjectNameForLead(externalLeadId);
  const desiredAssignments = new Map<string, string>();

  for (const assignment of assignments) {
    const employeeId = String(assignment.employee_id || "").trim();
    if (!employeeId) continue;
    desiredAssignments.set(assignment.project_type, employeeId);
  }

  const supportedTypes: PreProductionProjectAssignment["project_type"][] = [
    "Save the Date",
    "Save the Video",
    "Retouching",
  ];

  const synced: AssignedProjectRecord[] = [];

  for (const projectType of supportedTypes) {
    const employeeId = desiredAssignments.get(projectType);

    if (!employeeId) {
      await pool.query(
        `
        DELETE FROM assigned_projects
        WHERE project_id = $1
          AND project_type = $2
          AND LOWER(status) IN ('pending', 'accepted', 'rework')
        `,
        [projectId, projectType]
      );
      continue;
    }

    await pool.query(
      `
      DELETE FROM assigned_projects
      WHERE project_id = $1
        AND project_type = $2
        AND employee_id <> $3
        AND LOWER(status) IN ('pending', 'accepted', 'rework')
      `,
      [projectId, projectType, employeeId]
    );

    const result = await pool.query(
      `
      INSERT INTO assigned_projects (project_id, project_name, project_type, employee_id, status)
      VALUES ($1, $2, $3, $4, 'Pending')
      ON CONFLICT (project_id, employee_id, project_type)
      DO UPDATE SET
        project_name = EXCLUDED.project_name,
        updated_at = NOW()
      RETURNING *;
      `,
      [projectId, projectName, projectType, employeeId]
    );

    synced.push(result.rows[0]);
  }

  return synced;
};

const backfillPreProductionAssignmentsForEmployeeQuery = async (
  employee_id: string
) => {
  await createProjectTablesQuery();

  const result = await pool.query(
    `
    SELECT
      at.external_lead_id,
      at.save_the_date,
      at.save_the_video,
      at.retouch
    FROM assign_teams at
    WHERE at.save_the_date = $1
       OR at.save_the_video = $1
       OR at.retouch = $1
    `,
    [employee_id]
  );

  for (const row of result.rows) {
    await syncPreProductionAssignmentsQuery(row.external_lead_id, [
      {
        project_type: "Save the Date",
        employee_id: row.save_the_date || "",
      },
      {
        project_type: "Save the Video",
        employee_id: row.save_the_video || "",
      },
      {
        project_type: "Retouching",
        employee_id: row.retouch || "",
      },
    ]);
  }
};

export const getAssignedProjectsByEmployeeQuery = async (employee_id: string): Promise<AssignedProjectRecord[]> => {
  await backfillPreProductionAssignmentsForEmployeeQuery(employee_id);

  const result = await pool.query(
    `
    SELECT p.*, COALESCE(e.first_name || ' ' || COALESCE(e.last_name, ''), p.employee_id) as employee_name
    FROM assigned_projects p
    LEFT JOIN employees e ON p.employee_id = e.employee_id
    WHERE p.employee_id = $1
    ORDER BY p.created_at DESC
    `,
    [employee_id]
  );
  return result.rows;
};

export const getProjectsByEmployeeAndTypeQuery = async (employee_id: string, project_type: string): Promise<AssignedProjectRecord[]> => {
  await backfillPreProductionAssignmentsForEmployeeQuery(employee_id);

  const result = await pool.query(
    `
    SELECT p.*, COALESCE(e.first_name || ' ' || COALESCE(e.last_name, ''), p.employee_id) as employee_name
    FROM assigned_projects p
    LEFT JOIN employees e ON p.employee_id = e.employee_id
    WHERE p.employee_id = $1 AND p.project_type = $2
    ORDER BY p.created_at DESC
    `,
    [employee_id, project_type]
  );
  return result.rows;
};

export const getReworkRequestsQuery = async (employee_id: string): Promise<AssignedProjectRecord[]> => {
  await backfillPreProductionAssignmentsForEmployeeQuery(employee_id);

  const result = await pool.query(
    `
    SELECT p.*, COALESCE(e.first_name || ' ' || COALESCE(e.last_name, ''), p.employee_id) as employee_name
    FROM assigned_projects p
    LEFT JOIN employees e ON p.employee_id = e.employee_id
    WHERE p.employee_id = $1 AND LOWER(p.status) LIKE '%rework%'
    ORDER BY p.updated_at DESC
    `,
    [employee_id]
  );
  return result.rows;
};

export const getAssignmentsByProjectIdQuery = async (project_id: string): Promise<AssignedProjectRecord[]> => {
  const result = await pool.query(
    `SELECT p.*, COALESCE(e.first_name || ' ' || COALESCE(e.last_name, ''), p.employee_id) as employee_name
     FROM assigned_projects p
     LEFT JOIN employees e ON p.employee_id = e.employee_id
     WHERE p.project_id = $1 ORDER BY p.created_at DESC`,
    [project_id]
  );
  return result.rows;
};

export const updateProjectStatusQuery = async (id: number, data: UpdateProjectStatusDTO): Promise<AssignedProjectRecord> => {
  const result = await pool.query(
    `UPDATE assigned_projects SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`,
    [data.status, id]
  );
  return result.rows[0];
};

// Editor submits completed work with an upload link
export const submitUploadLinkQuery = async (id: number, upload_link: string, upload_notes: string = ''): Promise<AssignedProjectRecord> => {
  const result = await pool.query(
    `UPDATE assigned_projects SET upload_link = $1, upload_notes = $2, status = 'Completed', updated_at = NOW() WHERE id = $3 RETURNING *;`,
    [upload_link, upload_notes, id]
  );
  return result.rows[0];
};

const POST_PRODUCTION_PROJECT_TYPES = [
  'Traditional Video Editing',
  'Retouch Editing',
  'Album Design',
  'Candid Video Editing',
];

const PRE_PRODUCTION_PROJECT_TYPES = [
  'Save the Date',
  'Save the Video',
  'Retouching',
];

export const markLeadSubmittedIfPostProductionCompletedQuery = async (
  project_id: string
): Promise<{ submitted: boolean; assignedCount: number; completedCount: number }> => {
  await createProjectTablesQuery();

  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS assigned_count,
      COUNT(*) FILTER (
        WHERE LOWER(status) IN ('completed', 'approved')
           OR COALESCE(upload_link, '') <> ''
      )::int AS completed_count
    FROM assigned_projects
    WHERE project_id = $1
      AND project_type = ANY($2::text[])
    `,
    [project_id, POST_PRODUCTION_PROJECT_TYPES]
  );

  const assignedCount = Number(result.rows[0]?.assigned_count || 0);
  const completedCount = Number(result.rows[0]?.completed_count || 0);

  if (assignedCount === 0 || assignedCount !== completedCount) {
    return { submitted: false, assignedCount, completedCount };
  }

  const leadId = project_id.replace(/^CRM-/, '');
  await pool.query(
    `
    UPDATE external_leads
    SET current_phase = 'post_production',
        phase_status = CASE
          WHEN phase_status = 'completed' THEN phase_status
          ELSE 'submitted'
        END,
        phase_owner = 'post-production-crm',
        updated_at = NOW()
    WHERE external_id = $1 OR lead_serial_number = $1
    `,
    [leadId]
  );

  return { submitted: true, assignedCount, completedCount };
};

export const markLeadCompletedIfPostProductionApprovedQuery = async (
  project_id: string
): Promise<{ completed: boolean; assignedCount: number; approvedCount: number }> => {
  await createProjectTablesQuery();

  const result = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (
        WHERE LOWER(status) IN ('completed', 'approved', 'rework')
           OR COALESCE(upload_link, '') <> ''
      )::int AS assigned_count,
      COUNT(*) FILTER (WHERE LOWER(status) = 'approved')::int AS approved_count
    FROM assigned_projects
    WHERE project_id = $1
      AND project_type = ANY($2::text[])
    `,
    [project_id, POST_PRODUCTION_PROJECT_TYPES]
  );

  const assignedCount = Number(result.rows[0]?.assigned_count || 0);
  const approvedCount = Number(result.rows[0]?.approved_count || 0);

  if (assignedCount === 0 || assignedCount !== approvedCount) {
    return { completed: false, assignedCount, approvedCount };
  }

  const leadId = project_id.replace(/^CRM-/, '');
  await pool.query(
    `
    UPDATE external_leads
    SET status = 'completed',
        current_phase = 'post_production',
        phase_status = 'completed',
        phase_owner = 'post-production-crm',
        updated_at = NOW()
    WHERE external_id = $1 OR lead_serial_number = $1
    `,
    [leadId]
  );

  return { completed: true, assignedCount, approvedCount };
};

export const markLeadAdvancedIfPreProductionApprovedQuery = async (
  project_id: string
): Promise<{ advanced: boolean; assignedCount: number; approvedCount: number }> => {
  await createProjectTablesQuery();

  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS assigned_count,
      COUNT(*) FILTER (WHERE LOWER(status) = 'approved')::int AS approved_count
    FROM assigned_projects
    WHERE project_id = $1
      AND project_type = ANY($2::text[])
    `,
    [project_id, PRE_PRODUCTION_PROJECT_TYPES]
  );

  const assignedCount = Number(result.rows[0]?.assigned_count || 0);
  const approvedCount = Number(result.rows[0]?.approved_count || 0);

  if (assignedCount === 0 || assignedCount !== approvedCount) {
    return { advanced: false, assignedCount, approvedCount };
  }

  const leadId = project_id.replace(/^CRM-/, '');
  const updateResult = await pool.query(
    `
    UPDATE external_leads
    SET current_phase = CASE WHEN flow_type = 'pre_wedding' THEN 'event' ELSE 'post_production' END,
        phase_status = 'not_started',
        phase_owner = 'post-production-crm',
        updated_at = NOW()
    WHERE (external_id = $1 OR lead_serial_number = $1)
      AND current_phase = 'pre_production'
    RETURNING external_id, lead_serial_number, flow_type, current_phase
    `,
    [leadId]
  );

  const advancedLead = updateResult.rows[0];
  if (advancedLead?.flow_type === 'pre_wedding' && advancedLead.current_phase === 'event') {
    await ensureEventUploadColumnsQuery();
    await pool.query(
      `
      UPDATE event_details
      SET
        drive_link = NULL,
        video_drive_link = NULL,
        camera_used = NULL,
        video_camera_used = NULL,
        num_images = NULL,
        num_videos = NULL,
        upload_notes = NULL,
        video_upload_notes = NULL,
        photo_delivery_method = NULL,
        photo_hard_disk_delivery_date = NULL,
        photo_hard_disk_received = FALSE,
        photo_upload_phase = NULL,
        video_delivery_method = NULL,
        video_hard_disk_delivery_date = NULL,
        video_hard_disk_received = FALSE,
        video_upload_phase = NULL,
        drone_photo_drive_link = NULL,
        drone_video_drive_link = NULL,
        drone_camera_used = NULL,
        drone_video_camera_used = NULL,
        drone_num_images = NULL,
        drone_num_videos = NULL,
        drone_upload_notes = NULL,
        drone_video_upload_notes = NULL,
        drone_delivery_method = NULL,
        drone_hard_disk_delivery_date = NULL,
        drone_hard_disk_received = FALSE,
        drone_upload_phase = NULL,
        media_status = 'Pending',
        event_status = 'not_started',
        event_started_at = NULL,
        event_paused_at = NULL,
        event_ended_at = NULL,
        event_started_by = NULL,
        updated_at = NOW()
      WHERE external_lead_id = $1 OR external_lead_id = $2
      `,
      [advancedLead.external_id, advancedLead.lead_serial_number]
    );
  }

  return {
    advanced: updateResult.rowCount > 0,
    assignedCount,
    approvedCount,
  };
};

// Fetch all assigned projects (for edit approval listing)
export const getAllAssignedProjectsQuery = async (): Promise<AssignedProjectRecord[]> => {
  const result = await pool.query(
    `SELECT p.*, COALESCE(e.first_name || ' ' || COALESCE(e.last_name, ''), p.employee_id) as employee_name
     FROM assigned_projects p
     LEFT JOIN employees e ON p.employee_id = e.employee_id
     ORDER BY p.updated_at DESC`
  );
  return result.rows;
};

// Admin approves or requests re-upload with optional notes
export const reviewProjectQuery = async (id: number, status: 'Approved' | 'Rework', admin_notes?: string): Promise<AssignedProjectRecord> => {
  const result = await pool.query(
    `UPDATE assigned_projects SET status = $1, admin_notes = $2, updated_at = NOW() WHERE id = $3 RETURNING *;`,
    [status, admin_notes || null, id]
  );
  return result.rows[0];
};

export const saveApprovedDriveLinkQuery = async (data: ApprovedDriveLinkRecord): Promise<ApprovedDriveLinkRecord> => {
  const result = await pool.query(
    `INSERT INTO approved_drive_links 
      (project_id, project_name, project_type, employee_id, upload_link, admin_notes, approved_by) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING *;`,
    [data.project_id, data.project_name, data.project_type, data.employee_id, data.upload_link, data.admin_notes, data.approved_by]
  );
  return result.rows[0];
};

export const getApprovedDriveLinksByProjectIdQuery = async (project_id: string): Promise<ApprovedDriveLinkRecord[]> => {
  const result = await pool.query(
    `SELECT a.*, COALESCE(e.first_name || ' ' || COALESCE(e.last_name, ''), a.employee_id) as employee_name
     FROM approved_drive_links a
     LEFT JOIN employees e ON a.employee_id = e.employee_id
     WHERE a.project_id = $1 
     ORDER BY a.created_at DESC`,
    [project_id]
  );
  return result.rows;
};

// Client Approval Workflow

export const getApprovedClientsQuery = async (): Promise<any[]> => {
  const result = await pool.query(
    `SELECT project_id, project_name, COUNT(*) as link_count, MAX(created_at) as latest_approval
     FROM approved_drive_links
     GROUP BY project_id, project_name
     ORDER BY latest_approval DESC`
  );
  return result.rows;
};

export const sendLinksToClientQuery = async (project_id: string): Promise<any> => {
  const result = await pool.query(
    `UPDATE approved_drive_links SET sent_to_client = TRUE WHERE project_id = $1 RETURNING *;`,
    [project_id]
  );
  return result.rows;
};

export const getCRMFinalApprovalByProjectIdQuery = async (
  project_id: string
): Promise<CRMFinalApprovalRecord | null> => {
  await createProjectTablesQuery();

  const result = await pool.query(
    `
    SELECT *
    FROM crm_final_approvals
    WHERE project_id = $1
    LIMIT 1
    `,
    [project_id]
  );

  return result.rows[0] || null;
};

type UpsertCRMFinalApprovalInput = {
  project_id: string;
  checked_items: number[];
  rework_notes?: string;
  review_status: string;
  change_source?: string;
  change_notes?: string;
  assigned_to?: string;
};

export const upsertCRMFinalApprovalQuery = async (
  data: UpsertCRMFinalApprovalInput
): Promise<CRMFinalApprovalRecord> => {
  await createProjectTablesQuery();

  const result = await pool.query(
    `
    INSERT INTO crm_final_approvals (
      project_id,
      checked_items,
      rework_notes,
      review_status,
      change_source,
      change_notes,
      assigned_to,
      approved_at,
      updated_at
    )
    VALUES (
      $1,
      $2::int[],
      $3,
      $4::varchar(50),
      $5,
      $6,
      $7,
      CASE WHEN $4::text = 'client_approved' THEN NOW() ELSE NULL END,
      NOW()
    )
    ON CONFLICT (project_id)
    DO UPDATE SET
      checked_items = EXCLUDED.checked_items,
      rework_notes = EXCLUDED.rework_notes,
      review_status = EXCLUDED.review_status,
      change_source = EXCLUDED.change_source,
      change_notes = EXCLUDED.change_notes,
      assigned_to = EXCLUDED.assigned_to,
      approved_at = CASE
        WHEN EXCLUDED.review_status = 'client_approved' THEN COALESCE(crm_final_approvals.approved_at, NOW())
        ELSE crm_final_approvals.approved_at
      END,
      updated_at = NOW()
    RETURNING *;
    `,
    [
      data.project_id,
      data.checked_items,
      data.rework_notes || null,
      data.review_status,
      data.change_source || null,
      data.change_notes || null,
      data.assigned_to || null,
    ]
  );

  return result.rows[0];
};
