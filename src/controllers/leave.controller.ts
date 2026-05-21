import { Request, Response } from "express";
import {
  createLeaveRequestService,
  getLeaveRequestsByEmployeeService,
  getAllLeaveRequestsService,
  updateLeaveStatusService
} from "../services/leave.service";
import { createNotificationService } from "../services/notification.service";
import { pool } from "../config/db";

export const createLeaveRequestController = async (req: Request, res: Response) => {
  try {
    const { employee_id, leave_type, from_date, to_date, no_of_days, reason } = req.body;

    if (!employee_id || !leave_type || !from_date || !to_date || no_of_days === undefined || !reason) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const data = await createLeaveRequestService(req.body);

    // Get employee details for notification
    const empResult = await pool.query(
      `SELECT first_name, last_name, role as position FROM employees WHERE employee_id = $1`,
      [employee_id]
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
       LEFT JOIN employees e ON e.employee_id = ('EMP-' || l.employee_id::text)
       WHERE l.leave_request_id = $1`,
      [id]
    );

    const leaveData = leaveResult.rows[0];

    const data = await updateLeaveStatusService(id, { status });

    // Notify the employee about the status change
    if (leaveData) {
      const notificationTitle = status === 'Approved' || status === 'Accepted'
        ? 'Leave Request Approved'
        : status === 'Rejected'
          ? 'Leave Request Rejected'
          : 'Leave Request Updated';

      const notificationDetail = status === 'Approved' || status === 'Accepted'
        ? `Your leave request for ${leaveData.from_date} to ${leaveData.to_date} has been approved.`
        : status === 'Rejected'
          ? `Your leave request for ${leaveData.from_date} to ${leaveData.to_date} has been rejected.`
          : `Your leave request status has been updated to ${status}.`;

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

      await createNotificationService({
        type: 'leave_request',
        title: notificationTitle,
        detail: notificationDetail,
        lead_id: undefined,
        from_role: 'system',
        from_name: 'System',
        target_roles: [normalisedRole],
      }).catch(err => console.error("Status update notification error:", err));
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
