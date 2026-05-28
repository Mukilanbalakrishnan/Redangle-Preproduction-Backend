import { Request, Response } from "express";
import {
  createLeaveRequestService,
  getLeaveRequestsByEmployeeService,
  getAllLeaveRequestsService,
  updateLeaveStatusService
} from "../services/leave.service";
import { createNotificationService } from "../services/notification.service";
import { pool } from "../config/db";
import { ensureAssignTeamColumnsQuery } from "../queries/assignTeam.query";
import { ensureNotificationTableQuery } from "../queries/notification.queries";

const normalizeEmployeeIdTargets = (employeeId?: string | number | null) => {
  const raw = String(employeeId || "").trim();
  if (!raw) return [];
  const numeric = raw.replace(/\D/g, "");
  const unpaddedNumeric = numeric ? String(Number(numeric)) : "";
  return Array.from(new Set([
    raw,
    raw.toUpperCase(),
    numeric,
    unpaddedNumeric,
    numeric ? `EMP-${numeric}` : "",
    unpaddedNumeric ? `EMP-${unpaddedNumeric}` : "",
  ].filter(Boolean)));
};

const employeeLeaveJoinSql = `
  LEFT JOIN employees e
    ON e.employee_id = l.employee_id
    OR e.employee_id = ('EMP-' || regexp_replace(l.employee_id::text, '\\D', '', 'g'))
    OR regexp_replace(e.employee_id::text, '\\D', '', 'g') = regexp_replace(l.employee_id::text, '\\D', '', 'g')
`;

const normalizeSourceStage = (phase?: string | null) => {
  const normalized = String(phase || "").toLowerCase();
  if (normalized === "post_production") return "post-production";
  if (normalized === "pre_production") return "pre-production";
  if (normalized === "event") return "event";
  return "system";
};

const activeStatusSql = `
  LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'approved', 'cancelled', 'canceled', 'rejected')
`;

const isApprovedStatus = (status?: string) => status === 'Approved' || status === 'Accepted';
const isRejectedStatus = (status?: string) => status === 'Rejected';

const dateOnly = (value: any) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || '');
  return parsed.toISOString().slice(0, 10);
};

const leaveStatusNotificationContent = (leaveData: any, status: string) => {
  const fromDate = dateOnly(leaveData.from_date);
  const toDate = dateOnly(leaveData.to_date);
  const title = isApprovedStatus(status)
    ? 'Leave Request Approved'
    : isRejectedStatus(status)
      ? 'Leave Request Rejected'
      : 'Leave Request Updated';

  const detail = isApprovedStatus(status)
    ? `Your leave request for ${fromDate} to ${toDate} has been approved.`
    : isRejectedStatus(status)
      ? `Your leave request for ${fromDate} to ${toDate} has been rejected.`
      : `Your leave request status has been updated to ${status}.`;

  return { title, detail };
};

const ensureEmployeeLeaveStatusNotification = async (leaveData: any, status: string) => {
  if (!leaveData?.employee_id || (!isApprovedStatus(status) && !isRejectedStatus(status))) return;

  const { title, detail } = leaveStatusNotificationContent(leaveData, status);
  const employeeTargets = normalizeEmployeeIdTargets(leaveData.employee_id);
  await ensureNotificationTableQuery();

  const existing = await pool.query(
    `SELECT id FROM notifications
     WHERE type = 'leave_request'
       AND title = $1
       AND detail = $2
       AND target_employee_id = ANY($3::text[])
     LIMIT 1`,
    [title, detail, employeeTargets]
  );

  if (existing.rows[0]) return;

  await createNotificationService({
    type: 'leave_request',
    title,
    detail,
    lead_id: undefined,
    from_role: 'system',
    from_name: 'System',
    target_roles: [],
    target_employee_id: String(leaveData.employee_id || ''),
    source_stage: 'system',
  }).catch(err => console.error("Status update notification error:", err));
};

const notifyManagersForApprovedLeave = async (leaveData: any) => {
  const employee_id = leaveData.employee_id;
  if (!employee_id) return;
  try { await ensureAssignTeamColumnsQuery(); } catch (err) {}
  
  const empName = leaveData.employee_name || 'Employee';
  const detail = `${empName} has approved leave from ${leaveData.from_date} to ${leaveData.to_date}. Please check assignments.`;
  await createNotificationService({
    type: 'leave_cascade',
    title: 'Team Member Leave Approved',
    detail,
    target_roles: ['operational-manager', 'event-coordinator', 'crm'],
    source_stage: 'system',
  }).catch(err => console.error(err));
};

export const createLeaveRequestController = async (req: Request, res: Response) => {
  try {
    const { employee_id, leave_type, from_date, to_date, no_of_days, reason } = req.body;

    if (!employee_id || !leave_type || !from_date || !to_date || no_of_days === undefined || !reason) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const data = await createLeaveRequestService(req.body);

    // Get employee details for notification
    const empResult = await pool.query(
      `SELECT first_name, last_name, role as position
       FROM employees
       WHERE employee_id = ANY($1::text[])
          OR regexp_replace(employee_id::text, '\\D', '', 'g') = regexp_replace($2::text, '\\D', '', 'g')
       LIMIT 1`,
      [normalizeEmployeeIdTargets(employee_id), String(employee_id)]
    );

    // Roles whose leave requests should ONLY go to admin for approval
    const ELEVATED_ROLES = ['crm', 'event-coordinator', 'data-manager', 'operational-manager'];
    const MANAGER_ROLES = ['admin', 'crm', 'event-coordinator', 'data-manager', 'operational-manager'];

    // Default targets: all managers
    let target_roles = [...MANAGER_ROLES];
    let requesterName = 'Unknown';
    let requesterRole = 'employee';

    if (empResult.rows.length > 0) {
      const emp = empResult.rows[0];
      requesterName = `${emp.first_name} ${emp.last_name || ''}`.trim();
      requesterRole = emp.position;

      // If requester is a manager themselves, only notify admin
      if (ELEVATED_ROLES.includes(requesterRole)) {
        target_roles = ['admin'];
      }
    }

    // Trigger Notification
    await createNotificationService({
      type: 'leave_request',
      title: 'New Leave Request',
      detail: `${requesterName} requested leave from ${from_date} to ${to_date} (${no_of_days} days).`,
      lead_id: undefined,
      from_role: requesterRole,
      from_name: requesterName,
      target_roles,
      source_stage: 'system',
    }).catch(err => console.error("Notification trigger error:", err));

    res.status(201).json({
      success: true,
      data,
      message: "Leave request submitted successfully"
    });
  } catch (error: any) {
    console.error("CREATE LEAVE REQUEST ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getLeaveRequestsByEmployeeController = async (req: Request, res: Response) => {
  try {
    const { employee_id } = req.params;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: "employee_id parameter is required" });
    }

    const data = await getLeaveRequestsByEmployeeService(employee_id as string);

    await Promise.all(
      data.map((leave: any) => ensureEmployeeLeaveStatusNotification(leave, leave.status))
    );

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error("GET LEAVE REQUESTS EROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllLeaveRequestsController = async (req: Request, res: Response) => {
  try {
    const viewer_role = req.query.role as string | undefined;
    const data = await getAllLeaveRequestsService(viewer_role);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error("GET ALL LEAVE REQUESTS ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateLeaveStatusController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ success: false, message: "id and status are required" });
    }

    // Get the leave request details before updating
    const leaveResult = await pool.query(
      `SELECT l.*, COALESCE(e.first_name || ' ' || COALESCE(e.last_name, ''), 'Unknown') as employee_name, e.role
       FROM employee_leave_requests l
       ${employeeLeaveJoinSql}
       WHERE l.leave_request_id = $1`,
      [id]
    );

    const leaveData = leaveResult.rows[0];

    const data = await updateLeaveStatusService(id, { status });

    // Notify the employee about the status change
    if (leaveData) {
      // Map display role names to normalized role names for notification targeting
      const roleDisplayToNormalised: Record<string, string> = {
        'Photographer': 'photographer',
        'Videographer': 'videographer',
        'Save the Date Post': 'employee-1',
        'Save the Date Video': 'employee-2',
        'Retouch Photo': 'employee-4',
        'Data Manager': 'data-manager',
        'CRM': 'crm',
        'Event Coordinator': 'event-coordinator',
        'Admin': 'admin',
        'Drone': 'drone',
        'Operational Manager': 'operational-manager',
        'Traditional Video Editor': 'traditional-video-editor',
        'Retouch Editor': 'retouch-editor',
        'Album Designer': 'album-designer',
      };

      const normalisedRole = roleDisplayToNormalised[leaveData.role] || leaveData.role;

      await ensureEmployeeLeaveStatusNotification(leaveData, status);

      if (status === 'Approved' || status === 'Accepted') {
        await notifyManagersForApprovedLeave(leaveData).catch(err => console.error("Leave cascade notification error:", err));
      }
    }

    res.status(200).json({
      success: true,
      data,
      message: "Leave status updated successfully"
    });
  } catch (error: any) {
    console.error("UPDATE LEAVE STATUS ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
