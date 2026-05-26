import { getIncomingDataQuery, updateMediaStatusQuery, upsertHardDiskClosureQuery, getHardDiskClosureQuery, getHardDiskStatsQuery, updateIncomingDataQuery, deleteIncomingDataQuery, markHardDiskReceivedQuery, updateReuploadRemarksQuery, updatePartialApprovalQuery, saveVerificationDraftQuery } from "../queries/dataManager.query";
import { createNotificationService } from "./notification.service";
import { pool } from "../config/db";
import { ensureAssignTeamColumnsQuery } from "../queries/assignTeam.query";

type RequiredSubmission = {
    label: string;
    assigned: boolean;
    submitted: boolean;
};

const hasValue = (value: unknown) => String(value || '').trim() !== '';
const isSubmittedStatus = (status: unknown) =>
    ['submitted', 'completed', 'approved'].includes(String(status || '').toLowerCase());

const getProjectSubmissionMap = async (leadId: number | string, row: any) => {
    const projectIds = [
        row.lead_serial_number ? `CRM-${row.lead_serial_number}` : null,
        row.external_id ? `CRM-${row.external_id}` : null,
        row.external_lead_id ? `CRM-${row.external_lead_id}` : null,
        `CRM-${leadId}`,
    ].filter(Boolean);

    const result = await pool.query(
        `
        SELECT project_type, status, upload_link
        FROM assigned_projects
        WHERE project_id = ANY($1::text[])
        `,
        [[...new Set(projectIds)]]
    );

    return new Map(result.rows.map((project) => [
        project.project_type,
        hasValue(project.upload_link) || isSubmittedStatus(project.status),
    ]));
};

const getPendingVerificationRoles = async (leadId: number | string) => {
    await ensureAssignTeamColumnsQuery();
    const result = await pool.query(
        `
        SELECT
            ed.external_lead_id,
            el.external_id::text AS external_id,
            el.lead_serial_number,
            COALESCE(el.current_phase, '') AS current_phase,
            COALESCE(el.pre_production_step, 'shoot') AS pre_production_step,
            CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END AS photographer,
            CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END AS videographer,
            CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END AS drone,
            at.save_the_date,
            at.save_the_video,
            at.retouch,
            ed.drive_link,
            ed.video_drive_link,
            ed.drone_photo_drive_link,
            ed.drone_video_drive_link,
            ed.save_the_date_drive_link,
            ed.save_the_date_submission_status,
            ed.save_the_video_drive_link,
            ed.save_the_video_submission_status,
            ed.retouch_drive_link,
            ed.retouch_submission_status,
            ed.photo_delivery_method,
            ed.photo_upload_phase,
            ed.photo_hard_disk_delivery_date,
            COALESCE(ed.photo_hard_disk_received, FALSE) AS photo_hard_disk_received,
            ed.video_delivery_method,
            ed.video_upload_phase,
            ed.video_hard_disk_delivery_date,
            COALESCE(ed.video_hard_disk_received, FALSE) AS video_hard_disk_received,
            ed.drone_delivery_method,
            ed.drone_upload_phase,
            ed.drone_hard_disk_delivery_date,
            COALESCE(ed.drone_hard_disk_received, FALSE) AS drone_hard_disk_received
        FROM event_details ed
        LEFT JOIN external_leads el
          ON ed.external_lead_id = el.external_id::text
          OR ed.external_lead_id = el.lead_serial_number
        LEFT JOIN assign_teams at
          ON at.external_lead_id = ed.external_lead_id
          OR at.external_lead_id = el.external_id::text
          OR at.external_lead_id = el.lead_serial_number
        WHERE ed.external_lead_id = $1
           OR el.external_id::text = $1
           OR el.lead_serial_number = $1
        LIMIT 1
        `,
        [String(leadId)]
    );

    const row = result.rows[0];
    if (!row) return ['lead media'];

    const currentPhase = String(row.current_phase || '').toLowerCase();
    const preStep = String(row.pre_production_step || 'shoot').toLowerCase();
    const isPreEditing = currentPhase === 'pre_production' && preStep === 'editing';
    const isEvent = currentPhase === 'event';
    const projectSubmitted = await getProjectSubmissionMap(leadId, row);

    const photoHardDiskSubmitted = row.photo_delivery_method === 'hard_disk' &&
        row.photo_upload_phase === currentPhase &&
        row.photo_hard_disk_delivery_date &&
        row.photo_hard_disk_received;
    const videoHardDiskSubmitted = row.video_delivery_method === 'hard_disk' &&
        row.video_upload_phase === currentPhase &&
        row.video_hard_disk_delivery_date &&
        row.video_hard_disk_received;
    const droneHardDiskSubmitted = row.drone_delivery_method === 'hard_disk' &&
        row.drone_upload_phase === currentPhase &&
        row.drone_hard_disk_delivery_date &&
        row.drone_hard_disk_received;

    const phase1Roles: RequiredSubmission[] = [
        { label: 'Photographer', assigned: hasValue(row.photographer), submitted: hasValue(row.drive_link) || Boolean(photoHardDiskSubmitted) },
        { label: 'Videographer', assigned: hasValue(row.videographer), submitted: hasValue(row.video_drive_link) || Boolean(videoHardDiskSubmitted) },
        { label: 'Drone', assigned: isEvent && hasValue(row.drone), submitted: hasValue(row.drone_photo_drive_link) || hasValue(row.drone_video_drive_link) || Boolean(droneHardDiskSubmitted) },
    ];

    const phase2Roles: RequiredSubmission[] = [
        {
            label: 'Save the Date',
            assigned: hasValue(row.save_the_date),
            submitted: hasValue(row.save_the_date_drive_link) || isSubmittedStatus(row.save_the_date_submission_status) || Boolean(projectSubmitted.get('Save the Date')),
        },
        {
            label: 'Save the Video',
            assigned: hasValue(row.save_the_video),
            submitted: hasValue(row.save_the_video_drive_link) || isSubmittedStatus(row.save_the_video_submission_status) || Boolean(projectSubmitted.get('Save the Video')),
        },
        {
            label: 'Retouch',
            assigned: hasValue(row.retouch),
            submitted: hasValue(row.retouch_drive_link) || isSubmittedStatus(row.retouch_submission_status) || Boolean(projectSubmitted.get('Retouching')),
        },
    ];

    const requiredRoles = isPreEditing ? phase2Roles : phase1Roles;
    return requiredRoles
        .filter((role) => role.assigned && !role.submitted)
        .map((role) => role.label);
};

const assertReadyForDataManagerVerification = async (leadId: number | string) => {
    const pendingRoles = await getPendingVerificationRoles(leadId);
    if (pendingRoles.length > 0) {
        throw new Error(`Cannot verify yet. Pending same-phase submission: ${pendingRoles.join(', ')}`);
    }
};

export const getIncomingDataService = async () => {
    return await getIncomingDataQuery();
};

export const verifyMediaService = async (leadId: number | string) => {
    await assertReadyForDataManagerVerification(leadId);
    return await updateMediaStatusQuery(leadId, 'Pending_Verification');
};

export const requestReuploadService = async (leadId: number | string, role?: string, remarks?: string) => {
    if (role && remarks) {
        await createNotificationService({
            type: 'rework_request',
            title: `Rework Requested for Lead ${leadId}`,
            detail: `Data Manager has requested a rework. Remarks: ${remarks}`,
            lead_id: Number(leadId),
            from_role: 'data-manager',
            target_roles: [role],
        });
        return await updateReuploadRemarksQuery(leadId, role, remarks);
    }
    return await updateMediaStatusQuery(leadId, 'Reupload_Requested');
};

export const approveMediaService = async (leadId: number | string) => {
    return await updateMediaStatusQuery(leadId, 'Verified');
};

export const saveHardDiskClosureService = async (leadId: number | string, data: any) => {
    return await upsertHardDiskClosureQuery(leadId, data);
};

export const getHardDiskClosureService = async (leadId: number | string) => {
    return await getHardDiskClosureQuery(leadId);
};

export const getHardDiskStatsService = async () => {
    return await getHardDiskStatsQuery();
};

export const updateIncomingDataService = async (leadId: number | string, data: any) => {
    return await updateIncomingDataQuery(leadId, data);
};

export const partialApproveMediaService = async (leadId: number | string, role: string) => {
    return updatePartialApprovalQuery(leadId, role);
};

export const deleteIncomingDataService = async (leadId: number | string) => {
    return await deleteIncomingDataQuery(leadId);
};

export const saveVerificationDraftService = async (leadId: number | string, draft: any) => {
    return await saveVerificationDraftQuery(leadId, draft);
};

export const markHardDiskReceivedService = async (leadId: number | string) => {
    const data = await markHardDiskReceivedQuery(leadId);
    if (!data) return data;
    await assertReadyForDataManagerVerification(leadId);
    return await updateMediaStatusQuery(leadId, 'Pending_Verification');
};
