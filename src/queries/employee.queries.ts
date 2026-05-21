import { pool } from "../config/db";
import { ensureEventUploadColumnsQuery } from "./eventDetails.query";
import { ensureAssignTeamColumnsQuery } from "./assignTeam.query";

// Safely convert EMP-XXX or numeric string to integer, throws if invalid
const toNumericEmployeeId = (employeeId: number | string): number => {
    const numericId = typeof employeeId === 'string' && employeeId.startsWith('EMP-')
        ? parseInt(employeeId.replace('EMP-', ''), 10)
        : Number(employeeId);
    if (isNaN(numericId) || numericId <= 0) {
        throw new Error(`Invalid employee ID: ${employeeId}`);
    }
    return numericId;
};

const getEmployeeCodeVariants = (employeeId: number | string): string[] => {
    const raw = String(employeeId ?? "").trim();
    const digits = raw.replace(/\D/g, "");
    const variants = new Set<string>();

    if (raw) variants.add(raw);

    if (digits) {
        const numeric = Number(digits);
        variants.add(`EMP-${digits}`);
        variants.add(`EMP-${numeric}`);
        variants.add(`EMP-${String(numeric).padStart(2, "0")}`);
        variants.add(`EMP-${String(numeric).padStart(3, "0")}`);
    }

    return Array.from(variants).filter(Boolean);
};

const getNumericEmployeeIdOrNull = (employeeId: number | string): number | null => {
    const digits = String(employeeId ?? "").replace(/\D/g, "");
    if (!digits) return null;

    const numeric = Number(digits);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const ensureAssignmentAcceptanceColumnsQuery = async () => {
    await ensureAssignTeamColumnsQuery();
    await pool.query(`
        ALTER TABLE assign_teams
        ADD COLUMN IF NOT EXISTS accepted_assignments JSONB DEFAULT '[]'::jsonb
    `);
};

const roleAssignmentsLateral = `
    CROSS JOIN LATERAL (
        VALUES
            (
                'photography',
                'Photography',
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production' THEN 'Pre-production' ELSE 'Event' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production' THEN 'Pre-production Coordinator' ELSE 'Event Coordinator' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production'
                     THEN 'Pre-production -> Pre-production Coordinator -> Photographer'
                     ELSE 'Event -> Event Coordinator -> Photographer' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'event'
                     THEN at.event_photographer = ANY($1::text[])
                     ELSE at.photographer = ANY($1::text[]) END,
                ed.drive_link,
                ed.upload_notes,
                CASE WHEN COALESCE(ed.drive_link, '') != '' THEN 'Submitted' ELSE NULL END
            ),
            (
                'videography',
                'Videography',
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production' THEN 'Pre-production' ELSE 'Event' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production' THEN 'Pre-production Coordinator' ELSE 'Event Coordinator' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production'
                     THEN 'Pre-production -> Pre-production Coordinator -> Videographer'
                     ELSE 'Event -> Event Coordinator -> Videographer' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'event'
                     THEN at.event_videographer = ANY($1::text[])
                     ELSE at.videographer = ANY($1::text[]) END,
                ed.video_drive_link,
                ed.video_upload_notes,
                CASE WHEN COALESCE(ed.video_drive_link, '') != '' THEN 'Submitted' ELSE NULL END
            ),
            (
                'drone-coverage',
                'Drone Coverage',
                'Event',
                'Event Coordinator',
                'Event -> Event Coordinator -> Drone',
                CASE WHEN COALESCE(el.current_phase, '') = 'event'
                     THEN at.event_drone = ANY($1::text[])
                     ELSE at.drone = ANY($1::text[]) END,
                COALESCE(ed.drone_photo_drive_link, ed.drone_video_drive_link),
                COALESCE(ed.drone_upload_notes, ed.drone_video_upload_notes),
                CASE
                    WHEN COALESCE(ed.drone_photo_drive_link, '') != '' OR COALESCE(ed.drone_video_drive_link, '') != '' THEN 'Submitted'
                    ELSE NULL
                END
            ),
            (
                'save-the-date-post',
                'Save the Date Post',
                'Pre-production Phase 2',
                'CRM Editing Team',
                'Pre-production -> Phase 2 Editing -> Save the Date Post',
                at.save_the_date = ANY($1::text[]),
                ed.save_the_date_drive_link,
                ed.save_the_date_upload_notes,
                COALESCE(
                    ed.save_the_date_submission_status,
                    CASE WHEN COALESCE(ed.save_the_date_drive_link, '') != '' THEN 'Submitted' ELSE NULL END
                )
            ),
            (
                'save-the-video',
                'Save the Video',
                'Pre-production Phase 2',
                'CRM Editing Team',
                'Pre-production -> Phase 2 Editing -> Save the Video',
                at.save_the_video = ANY($1::text[]),
                ed.save_the_video_drive_link,
                ed.save_the_video_upload_notes,
                COALESCE(
                    ed.save_the_video_submission_status,
                    CASE WHEN COALESCE(ed.save_the_video_drive_link, '') != '' THEN 'Submitted' ELSE NULL END
                )
            ),
            (
                'retouch',
                'Retouch',
                'Pre-production Phase 2',
                'CRM Editing Team',
                'Pre-production -> Phase 2 Editing -> Retouch',
                at.retouch = ANY($1::text[]),
                ed.retouch_drive_link,
                ed.retouch_upload_notes,
                COALESCE(
                    ed.retouch_submission_status,
                    CASE WHEN COALESCE(ed.retouch_drive_link, '') != '' THEN 'Submitted' ELSE NULL END
                )
            ),
            (
                'secondary-photography',
                'Secondary Photography',
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production' THEN 'Pre-production' ELSE 'Event' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production' THEN 'Pre-production Coordinator' ELSE 'Event Coordinator' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production'
                     THEN 'Pre-production -> Pre-production Coordinator -> Secondary Photographer'
                     ELSE 'Event -> Event Coordinator -> Secondary Photographer' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'event'
                     THEN COALESCE(at.event_secondary_photographer, '[]'::jsonb) ?| $1::text[]
                     ELSE COALESCE(at.secondary_photographer, '[]'::jsonb) ?| $1::text[] END,
                ed.drive_link,
                ed.upload_notes,
                CASE WHEN COALESCE(ed.drive_link, '') != '' THEN 'Submitted' ELSE NULL END
            ),
            (
                'secondary-videography',
                'Secondary Videography',
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production' THEN 'Pre-production' ELSE 'Event' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production' THEN 'Pre-production Coordinator' ELSE 'Event Coordinator' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'pre_production'
                     THEN 'Pre-production -> Pre-production Coordinator -> Secondary Videographer'
                     ELSE 'Event -> Event Coordinator -> Secondary Videographer' END,
                CASE WHEN COALESCE(el.current_phase, '') = 'event'
                     THEN COALESCE(at.event_secondary_videographer, '[]'::jsonb) ?| $1::text[]
                     ELSE COALESCE(at.secondary_videographer, '[]'::jsonb) ?| $1::text[] END,
                ed.video_drive_link,
                ed.video_upload_notes,
                CASE WHEN COALESCE(ed.video_drive_link, '') != '' THEN 'Submitted' ELSE NULL END
            ),
            (
                'secondary-drone-coverage',
                'Secondary Drone Coverage',
                'Event',
                'Event Coordinator',
                'Event -> Event Coordinator -> Secondary Drone',
                CASE WHEN COALESCE(el.current_phase, '') = 'event'
                     THEN COALESCE(at.event_secondary_drone, '[]'::jsonb) ?| $1::text[]
                     ELSE COALESCE(at.secondary_drone, '[]'::jsonb) ?| $1::text[] END,
                COALESCE(ed.drone_photo_drive_link, ed.drone_video_drive_link),
                COALESCE(ed.drone_upload_notes, ed.drone_video_upload_notes),
                CASE
                    WHEN COALESCE(ed.drone_photo_drive_link, '') != '' OR COALESCE(ed.drone_video_drive_link, '') != '' THEN 'Submitted'
                    ELSE NULL
                END
            )
    ) AS role_assignment(task_key, task_name, flow_stage, request_source, stage_path, is_assigned, upload_link, upload_notes, status)
`;

// Dashboard: stats + recent projects for an employee
export const getEmployeeDashboardQuery = async (employeeId: number | string) => {
    await ensureEventUploadColumnsQuery();
    await ensureAssignmentAcceptanceColumnsQuery();
    const empCodes = getEmployeeCodeVariants(employeeId);
    const numericEmployeeId = getNumericEmployeeIdOrNull(employeeId);

    let preStatsRaw = { rows: [{ total_assigned: "0", pending: "0", submitted: "0" }] };
    let preRecentRaw = { rows: [] as any[] };

    try {
        preStatsRaw = await pool.query(
            `SELECT
          COUNT(*) AS total_assigned,
          COUNT(*) FILTER (
            WHERE NOT (
              $2::int IS NOT NULL
              AND COALESCE(at.accepted_assignments, '[]'::jsonb) @> jsonb_build_array($2::text || ':' || role_assignment.task_key)
            )
          ) AS pending,
          COUNT(*) FILTER (WHERE COALESCE(role_assignment.status, '') = 'Submitted') AS submitted
        FROM assign_teams at
        LEFT JOIN external_leads el
            ON at.external_lead_id = el.external_id::text
            OR at.external_lead_id = el.lead_serial_number
        LEFT JOIN event_details ed
            ON ed.external_lead_id = at.external_lead_id
            OR ed.external_lead_id = el.external_id::text
            OR ed.external_lead_id = el.lead_serial_number
        ${roleAssignmentsLateral}
        WHERE role_assignment.is_assigned`,
            [empCodes, numericEmployeeId]
        );

        preRecentRaw = await pool.query(
            `SELECT
                CONCAT(at.id, '-', regexp_replace(lower(role_assignment.task_name), '[^a-z0-9]+', '-', 'g')) AS lead_employee_id,
                COALESCE(el.external_id::text, at.external_lead_id) AS lead_id,
                COALESCE(
                    el.lead_serial_number,
                    CASE WHEN el.external_id IS NOT NULL THEN CONCAT('EXT-', el.external_id::text) END,
                    at.external_lead_id
                ) AS lead_code,
                COALESCE(el.lead_name, ed.client_name, at.external_lead_id) AS name,
                COALESCE(el.event_type, ed.event_type) AS type,
                role_assignment.task_key,
                role_assignment.task_name,
                role_assignment.flow_stage,
                role_assignment.request_source,
                role_assignment.stage_path,
                el.priority AS priority,
                CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_assignment_date ELSE at.event_date END AS deadline,
                at.created_at
            FROM assign_teams at
            LEFT JOIN external_leads el
                ON at.external_lead_id = el.external_id::text
                OR at.external_lead_id = el.lead_serial_number
            LEFT JOIN event_details ed
                ON ed.external_lead_id = at.external_lead_id
                OR ed.external_lead_id = el.external_id::text
                OR ed.external_lead_id = el.lead_serial_number
            ${roleAssignmentsLateral}
            WHERE role_assignment.is_assigned
            ORDER BY at.created_at DESC
            LIMIT 5`,
            [empCodes]
        );
    } catch (err) {
        console.error("Failed to fetch PreProduction data for dashboard:", err);
    }

    // Merge Stats
    const total_assigned = (parseInt(preStatsRaw.rows[0].total_assigned) || 0);
    const pending = (parseInt(preStatsRaw.rows[0].pending) || 0);
    const submitted = (parseInt(preStatsRaw.rows[0].submitted) || 0);

    // Merge and sort recent projects - REMOVED MERGE
    const recentProjects = preRecentRaw.rows;

    return {
        stats: {
            assigned: total_assigned,
            pending: pending,
            submitted: submitted,
            approved: 0,
        },
        recentProjects,
    };
};

// Assigned Projects: all leads assigned to employee
export const getAssignedProjectsQuery = async (employeeId: number | string) => {
    await ensureEventUploadColumnsQuery();
    await ensureAssignmentAcceptanceColumnsQuery();
    const empCodes = getEmployeeCodeVariants(employeeId);
    const numericEmployeeId = getNumericEmployeeIdOrNull(employeeId);
    let preProjects = { rows: [] as any[] };

    try {
        preProjects = await pool.query(
            `SELECT
                CONCAT(at.id, '-', regexp_replace(lower(role_assignment.task_name), '[^a-z0-9]+', '-', 'g')) AS lead_employee_id,
                COALESCE(el.external_id::text, at.external_lead_id) AS lead_id,
                COALESCE(
                    el.lead_serial_number,
                    CASE WHEN el.external_id IS NOT NULL THEN CONCAT('EXT-', el.external_id::text) END,
                    at.external_lead_id
                ) AS lead_code,
                COALESCE(el.lead_name, ed.client_name, at.external_lead_id) AS name,
                COALESCE(el.event_type, ed.event_type) AS type,
                role_assignment.task_name,
                role_assignment.flow_stage,
                role_assignment.request_source,
                role_assignment.stage_path,
                el.priority AS priority,
                CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_assignment_date ELSE at.event_date END AS deadline,
                COALESCE(el.location, ed.event_location, CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_assignment_location ELSE at.location END) AS description,
                (
                    $2::int IS NOT NULL
                    AND COALESCE(at.accepted_assignments, '[]'::jsonb) @> jsonb_build_array($2::text || ':' || role_assignment.task_key)
                ) AS accepted,
                role_assignment.upload_link,
                role_assignment.upload_notes,
                role_assignment.status,
                COALESCE(ed.event_status, 'not_started') AS event_status,
                ed.event_started_at,
                ed.event_paused_at,
                ed.event_ended_at,
                at.created_at
            FROM assign_teams at
            LEFT JOIN external_leads el
                ON at.external_lead_id = el.external_id::text
                OR at.external_lead_id = el.lead_serial_number
            LEFT JOIN event_details ed
                ON ed.external_lead_id = at.external_lead_id
                OR ed.external_lead_id = el.external_id::text
                OR ed.external_lead_id = el.lead_serial_number
            ${roleAssignmentsLateral}
            WHERE role_assignment.is_assigned
            ORDER BY at.created_at DESC`,
            [empCodes, numericEmployeeId]
        );
    } catch (err) {
        console.error("Failed to fetch PreProduction projects:", err);
    }

    return preProjects.rows;
};

export const getMyWorkQuery = async (employeeId: number | string) => {
    await ensureEventUploadColumnsQuery();
    await ensureAssignmentAcceptanceColumnsQuery();
    const empCodes = getEmployeeCodeVariants(employeeId);
    const numericEmployeeId = getNumericEmployeeIdOrNull(employeeId);
    let preWork = { rows: [] as any[] };

    try {
        preWork = await pool.query(
            `SELECT
                CONCAT(at.id, '-', regexp_replace(lower(role_assignment.task_name), '[^a-z0-9]+', '-', 'g')) AS lead_employee_id,
                COALESCE(el.external_id::text, at.external_lead_id) AS lead_id,
                COALESCE(
                    el.lead_serial_number,
                    CASE WHEN el.external_id IS NOT NULL THEN CONCAT('EXT-', el.external_id::text) END,
                    at.external_lead_id
                ) AS lead_code,
                COALESCE(el.lead_name, ed.client_name, at.external_lead_id) AS client,
                COALESCE(el.event_type, ed.event_type) AS type,
                role_assignment.task_key,
                role_assignment.task_name AS name,
                role_assignment.flow_stage,
                role_assignment.request_source,
                role_assignment.stage_path,
                el.priority AS priority,
                CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_assignment_date ELSE at.event_date END AS deadline,
                NULL AS estimated_duration,
                COALESCE(el.location, ed.event_location, CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_assignment_location ELSE at.location END) AS description,
                (
                    $2::int IS NOT NULL
                    AND COALESCE(at.accepted_assignments, '[]'::jsonb) @> jsonb_build_array($2::text || ':' || role_assignment.task_key)
                ) AS accepted,
                role_assignment.upload_link,
                role_assignment.upload_notes,
                role_assignment.status,
                at.created_at
            FROM assign_teams at
            LEFT JOIN external_leads el
                ON at.external_lead_id = el.external_id::text
                OR at.external_lead_id = el.lead_serial_number
            LEFT JOIN event_details ed
                ON ed.external_lead_id = at.external_lead_id
                OR ed.external_lead_id = el.external_id::text
                OR ed.external_lead_id = el.lead_serial_number
            ${roleAssignmentsLateral}
            WHERE role_assignment.is_assigned
            ORDER BY at.created_at DESC NULLS LAST, COALESCE(at.event_assignment_date, at.event_date) DESC NULLS LAST`,
            [empCodes, numericEmployeeId]
        );
    } catch (err) {
        console.error("Failed to fetch PreProduction work:", err);
    }

    return preWork.rows;
};

// Attendance: records + stats for an employee
export const getAttendanceQuery = async (employeeId: number | string) => {
    const numericId = toNumericEmployeeId(employeeId);
    const recordsResult = await pool.query(
        `SELECT
      attendance_id,
      date,
      check_in,
      check_out,
      status
    FROM employees_attendance
    WHERE employee_id = $1
    ORDER BY date DESC`,
        [numericId]
    );

    const statsResult = await pool.query(
        `SELECT
      COUNT(*) AS total_days,
      COUNT(*) FILTER (WHERE status = 'Present') AS present,
      COUNT(*) FILTER (WHERE status = 'Absent') AS absent
    FROM employees_attendance
    WHERE employee_id = $1`,
        [numericId]
    );

    const stats = statsResult.rows[0];
    const totalDays = parseInt(stats.total_days) || 0;
    const present = parseInt(stats.present) || 0;
    const absent = parseInt(stats.absent) || 0;
    const percentage = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

    return {
        records: recordsResult.rows,
        stats: {
            totalDays,
            present,
            absent,
            percentage,
        },
    };
};

// Leave Requests: history for an employee
export const getLeaveRequestsQuery = async (employeeId: number | string) => {
    const empStr = String(employeeId);
    const empCode = empStr.startsWith('EMP-') ? empStr : `EMP-${empStr}`;
    const result = await pool.query(
        `SELECT
      leave_request_id,
      leave_type,
      from_date,
      to_date,
      no_of_days,
      status,
      reason,
      created_at
    FROM employee_leave_requests
    WHERE employee_id = $1
    ORDER BY created_at DESC`,
        [empCode]
    );
    return result.rows;
};

// Submit a new leave request
export const createLeaveRequestQuery = async (
    employeeId: number | string,
    leaveType: string,
    fromDate: string,
    toDate: string,
    reason: string
) => {
    const empStr = String(employeeId);
    const empCode = empStr.startsWith('EMP-') ? empStr : `EMP-${empStr}`;
    const result = await pool.query(
        `INSERT INTO employee_leave_requests
      (employee_id, leave_type, from_date, to_date, no_of_days, status, reason, created_at)
    VALUES
      ($1, $2, $3, $4, ($4::date - $3::date + 1), 'Pending', $5, NOW())
    RETURNING *`,
        [empCode, leaveType, fromDate, toDate, reason]
    );
    return result.rows[0];
};

// Get today's attendance record for an employee
export const getTodayAttendanceQuery = async (employeeId: number | string) => {
    const numericId = toNumericEmployeeId(employeeId);
    const result = await pool.query(
        `SELECT attendance_id, date, check_in, check_out, status
         FROM employees_attendance
         WHERE employee_id = $1 AND date = CURRENT_DATE`,
        [numericId]
    );
    return result.rows[0] || null;
};

// Punch In: insert today's record with check_in time
export const punchInQuery = async (employeeId: number | string) => {
    const numericId = toNumericEmployeeId(employeeId);
    // Check if already punched in today
    const existing = await getTodayAttendanceQuery(employeeId);
    if (existing && existing.check_in) {
        // Already punched in — return existing record instead of erroring
        return existing;
    }
    if (existing) {
        // Row exists but no check_in — update it
        const result = await pool.query(
            `UPDATE employees_attendance
             SET check_in = NOW()
             WHERE attendance_id = $1
             RETURNING *`,
            [existing.attendance_id]
        );
        return result.rows[0];
    }
    // No record for today — insert new one
    try {
        const result = await pool.query(
            `INSERT INTO employees_attendance (employee_id, date, check_in, status)
             VALUES ($1, CURRENT_DATE, NOW(), 'Present')
             RETURNING *`,
            [numericId]
        );
        return result.rows[0];
    } catch (err: any) {
        // If 'Present' doesn't match enum, try other casings
        if (err.message?.includes('invalid input value for enum')) {
            const result = await pool.query(
                `INSERT INTO employees_attendance (employee_id, date, check_in, status)
                 VALUES ($1, CURRENT_DATE, NOW(), 'present')
                 RETURNING *`,
                [numericId]
            );
            return result.rows[0];
        }
        throw err;
    }
};

// Punch Out: update today's record with check_out time
export const punchOutQuery = async (employeeId: number | string) => {
    const numericId = toNumericEmployeeId(employeeId);
    const existing = await getTodayAttendanceQuery(employeeId);
    if (!existing || !existing.check_in) {
        throw new Error('You must punch in before punching out');
    }
    if (existing.check_out) {
        throw new Error('Already punched out today');
    }
    const result = await pool.query(
        `UPDATE employees_attendance
         SET check_out = NOW()
         WHERE employee_id = $1 AND date = CURRENT_DATE
         RETURNING *`,
        [numericId]
    );
    return result.rows[0];
};
