"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPhase2EditorsAssignedService = exports.getPhase2SubmissionStatusService = exports.completeEditingStepService = exports.advanceToEditingStepService = exports.getPreProductionStepService = exports.getPhaseInfoService = exports.updatePhaseStatusService = exports.advancePhaseService = exports.setFlowTypeService = exports.submitPreProductionPhaseService = exports.syncLeadToEventPhaseService = exports.reconcileLeadPhasesService = void 0;
const db_1 = require("../config/db");
const eventDetails_query_1 = require("../queries/eventDetails.query");
const project_query_1 = require("../queries/project.query");
const PHASE_ORDER = {
    pre_wedding: ['pre_production', 'event', 'post_production'],
    post_wedding: ['event', 'pre_production', 'post_production'],
};
const PHASE_OWNERS = {
    pre_production: 'pre-production-crm',
    event: 'event-crm',
    post_production: 'post-production-crm',
};
const PRE_PRODUCTION_STEPS = ['shoot', 'editing'];
const resetMediaCycleFields = `
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
`;
const ensurePhaseTrackingSchema = async () => {
    await db_1.pool.query(`
    ALTER TABLE external_leads
    ADD COLUMN IF NOT EXISTS flow_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS current_phase VARCHAR(30) DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS phase_status VARCHAR(20) DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS phase_owner VARCHAR(30),
    ADD COLUMN IF NOT EXISTS pre_production_step VARCHAR(20) DEFAULT 'shoot'
  `);
    await (0, eventDetails_query_1.ensureEventUploadColumnsQuery)();
};
const resetEventCycleData = async (leadId) => {
    await ensurePhaseTrackingSchema();
    await db_1.pool.query(`
    UPDATE event_details
    SET
      ${resetMediaCycleFields}
    WHERE external_lead_id IN (
      SELECT external_id::text
      FROM external_leads
      WHERE external_id = $1 OR lead_serial_number = $1
      UNION
      SELECT $1
    )
    `, [leadId]);
};
const reconcileLeadPhasesService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    await (0, project_query_1.createProjectTablesQuery)();
    const leadFilter = leadId
        ? `AND (el.external_id = $1 OR el.lead_serial_number = $1)`
        : "";
    const params = leadId ? [leadId] : [];
    await db_1.pool.query(`
    UPDATE external_leads el
    SET current_phase = 'pre_production',
        phase_owner = 'pre-production-crm',
        phase_status = 'in_progress',
        updated_at = NOW()
    WHERE el.flow_type = 'pre_wedding'
      AND COALESCE(el.pre_production_step, 'shoot') = 'shoot'
      AND el.current_phase <> 'pre_production'
      AND NOT EXISTS (
        SELECT 1
        FROM assigned_projects ap
        WHERE ap.project_id IN ('CRM-' || el.external_id::text, 'CRM-' || el.lead_serial_number::text)
          AND ap.project_type IN ('Save the Date', 'Save the Video', 'Retouching')
          AND (
            LOWER(COALESCE(ap.status, '')) IN ('completed', 'approved', 'rework')
            OR COALESCE(ap.upload_link, '') <> ''
          )
      )
      ${leadFilter}
    `, params);
    // When a pre-wedding shoot cycle has been verified, move the same lead to
    // the editing sub-step of pre-production. Historical stage rows are accepted
    // here because pre-wedding starts in pre-production.
    await db_1.pool.query(`
    UPDATE external_leads el
    SET current_phase = 'pre_production',
        phase_owner = 'pre-production-crm',
        phase_status = 'in_progress',
        pre_production_step = 'editing',
        updated_at = NOW()
    WHERE el.flow_type = 'pre_wedding'
      AND COALESCE(el.pre_production_step, 'shoot') = 'shoot'
      AND el.phase_status IN ('not_started', 'in_progress', 'submitted')
      ${leadFilter}
      AND (
        EXISTS (
          SELECT 1
          FROM lead_tracking_stages lts
          WHERE (lts.external_lead_id = el.external_id OR lts.external_lead_id = el.lead_serial_number)
            AND lts.stage_name = 'crm_verified'
        )
        OR EXISTS (
          SELECT 1
          FROM event_details ed
          WHERE ed.external_lead_id = el.external_id
            AND COALESCE(ed.media_status, '') = 'crm_verified'
        )
      )
    `, params);
    // Pre-wedding reaches the event phase after pre-production has already
    // passed its own gate. Once the current event cycle is ended and CRM has
    // verified the event package, move only this branch to post-production.
    await db_1.pool.query(`
    UPDATE external_leads el
    SET current_phase = 'post_production',
        phase_owner = 'post-production-crm',
        phase_status = 'not_started',
        updated_at = NOW()
    WHERE el.flow_type = 'pre_wedding'
      AND el.current_phase = 'event'
      AND el.phase_status IN ('not_started', 'in_progress', 'submitted', 'approved')
      ${leadFilter}
      AND EXISTS (
        SELECT 1
        FROM event_details ed
        WHERE ed.external_lead_id IN (el.external_id::text, el.lead_serial_number::text)
          AND COALESCE(ed.event_status, '') = 'ended'
          AND COALESCE(ed.media_status, '') IN ('crm_verified', 'harddisk_closed')
      )
    `, params);
    // Post-wedding starts at the event phase. After Data Manager/CRM verifies
    // the event uploads, the next actionable CRM screen is pre-production
    // phase 1, where CRM assigns the separate photo/video shoot team.
    await db_1.pool.query(`
    WITH moved AS (
      UPDATE external_leads el
      SET current_phase = 'pre_production',
          phase_owner = 'pre-production-crm',
          phase_status = 'in_progress',
          pre_production_step = 'shoot',
          updated_at = NOW()
      WHERE el.flow_type = 'post_wedding'
        AND el.current_phase = 'event'
        AND el.phase_status IN ('not_started', 'in_progress', 'submitted', 'approved')
        ${leadFilter}
        AND (
          EXISTS (
            SELECT 1
            FROM lead_tracking_stages lts
            WHERE (lts.external_lead_id = el.external_id OR lts.external_lead_id = el.lead_serial_number)
              AND lts.stage_name = 'crm_verified'
          )
          OR EXISTS (
            SELECT 1
            FROM event_details ed
            WHERE ed.external_lead_id = el.external_id
              AND COALESCE(ed.media_status, '') = 'crm_verified'
          )
        )
      RETURNING el.external_id::text AS external_id, el.lead_serial_number
    )
    UPDATE event_details ed
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
    FROM moved
    WHERE ed.external_lead_id IN (moved.external_id, moved.lead_serial_number)
    `, params);
    // Recovery for rows that were briefly promoted straight to phase 2 before
    // the post-wedding phase-1 shoot gate was restored. Do not rewind leads that
    // already have phase-2 editors assigned.
    await db_1.pool.query(`
    WITH recovered AS (
      UPDATE external_leads el
      SET pre_production_step = 'shoot',
          phase_status = 'in_progress',
          phase_owner = 'pre-production-crm',
          updated_at = NOW()
      WHERE el.flow_type = 'post_wedding'
        AND el.current_phase = 'pre_production'
        AND el.pre_production_step = 'editing'
        AND el.phase_status IN ('not_started', 'in_progress')
        ${leadFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM assign_teams at
          WHERE (
            at.external_lead_id = el.external_id::text
            OR at.external_lead_id = el.lead_serial_number
          )
          AND (
            NULLIF(TRIM(COALESCE(at.save_the_date, '')), '') IS NOT NULL
            OR NULLIF(TRIM(COALESCE(at.save_the_video, '')), '') IS NOT NULL
            OR NULLIF(TRIM(COALESCE(at.retouch, '')), '') IS NOT NULL
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM lead_tracking_stages lts
          WHERE (lts.external_lead_id = el.external_id OR lts.external_lead_id = el.lead_serial_number)
            AND lts.stage_name = 'confirmed_shoot_team'
        )
      RETURNING el.external_id::text AS external_id, el.lead_serial_number
    )
    UPDATE event_details ed
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
    FROM recovered
    WHERE ed.external_lead_id IN (recovered.external_id, recovered.lead_serial_number)
    `, params);
    /*
      Do not place another post-wedding editing->shoot recovery after this point.
      Once the fresh Phase 1 upload is CRM-verified, the post_wedding rule above
      intentionally moves the lead into the editing step with no editors yet.
    */
    // Post-wedding has an earlier event cycle that can also create a generic
    // crm_verified stage row. For post-wedding phase-1 pre-production, advance
    // only when the current media_status is crm_verified for this fresh cycle.
    await db_1.pool.query(`
    UPDATE external_leads el
    SET current_phase = 'pre_production',
        phase_owner = 'pre-production-crm',
        phase_status = 'in_progress',
        pre_production_step = 'editing',
        updated_at = NOW()
    WHERE el.flow_type = 'post_wedding'
      AND el.current_phase = 'pre_production'
      AND COALESCE(el.pre_production_step, 'shoot') = 'shoot'
      AND el.phase_status IN ('not_started', 'in_progress', 'submitted')
      ${leadFilter}
      AND EXISTS (
        SELECT 1
        FROM event_details ed
        WHERE ed.external_lead_id = el.external_id
          AND COALESCE(ed.media_status, '') = 'crm_verified'
      )
    `, params);
    await db_1.pool.query(`
    UPDATE external_leads el
    SET status = 'completed',
        current_phase = 'post_production',
        phase_status = 'completed',
        phase_owner = 'post-production-crm',
        updated_at = NOW()
    WHERE el.current_phase = 'post_production'
      AND COALESCE(el.status, '') <> 'completed'
      AND EXISTS (
        SELECT 1
        FROM assigned_projects ap
        WHERE ap.project_id IN ('CRM-' || el.external_id::text, 'CRM-' || el.lead_serial_number::text)
          AND ap.project_type IN (
            'Traditional Video Editing',
            'Traditional Photo Editing',
            'Album Design',
            'Candid Video Editing'
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM assigned_projects ap
        WHERE ap.project_id IN ('CRM-' || el.external_id::text, 'CRM-' || el.lead_serial_number::text)
          AND ap.project_type IN (
            'Traditional Video Editing',
            'Traditional Photo Editing',
            'Album Design',
            'Candid Video Editing'
          )
          AND LOWER(COALESCE(ap.status, '')) <> 'approved'
      )
      ${leadFilter}
    `, params);
    await db_1.pool.query(`
    UPDATE external_leads el
    SET current_phase = CASE WHEN el.flow_type = 'pre_wedding' THEN 'event' ELSE 'post_production' END,
        phase_status = 'not_started',
        phase_owner = CASE WHEN el.flow_type = 'pre_wedding' THEN 'event-crm' ELSE 'post-production-crm' END,
        updated_at = NOW()
    WHERE el.current_phase = 'pre_production'
      ${leadFilter}
      AND EXISTS (
        SELECT 1
        FROM assigned_projects ap
        WHERE ap.project_id IN ('CRM-' || el.external_id::text, 'CRM-' || el.lead_serial_number::text)
          AND ap.project_type IN ('Save the Date', 'Save the Video', 'Retouching')
          AND (
            LOWER(COALESCE(ap.status, '')) IN ('completed', 'approved', 'rework')
            OR COALESCE(ap.upload_link, '') <> ''
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM assigned_projects ap
        WHERE ap.project_id IN ('CRM-' || el.external_id::text, 'CRM-' || el.lead_serial_number::text)
          AND ap.project_type IN ('Save the Date', 'Save the Video', 'Retouching')
          AND (
            LOWER(COALESCE(ap.status, '')) IN ('completed', 'approved', 'rework')
            OR COALESCE(ap.upload_link, '') <> ''
          )
          AND LOWER(COALESCE(ap.status, '')) <> 'approved'
      )
    `, params);
};
exports.reconcileLeadPhasesService = reconcileLeadPhasesService;
const syncLeadToEventPhaseService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    const result = await db_1.pool.query(`
    UPDATE external_leads
    SET current_phase = CASE
          WHEN current_phase = 'pre_production' THEN current_phase
          ELSE 'event'
        END,
        phase_owner = CASE
          WHEN current_phase = 'pre_production' THEN phase_owner
          ELSE 'event-crm'
        END,
        phase_status = CASE
          WHEN phase_status IN ('approved', 'completed') THEN phase_status
          ELSE 'in_progress'
        END,
        updated_at = NOW()
    WHERE external_id = $1 OR lead_serial_number = $1
    RETURNING *
    `, [leadId]);
    return result.rows[0] || null;
};
exports.syncLeadToEventPhaseService = syncLeadToEventPhaseService;
const submitPreProductionPhaseService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    const result = await db_1.pool.query(`
    UPDATE external_leads
    SET phase_status = 'submitted',
        updated_at = NOW()
    WHERE (external_id = $1 OR lead_serial_number = $1)
      AND current_phase = 'pre_production'
      AND phase_status IN ('not_started', 'in_progress', 'submitted')
    RETURNING *
    `, [leadId]);
    return result.rows[0] || null;
};
exports.submitPreProductionPhaseService = submitPreProductionPhaseService;
const setFlowTypeService = async (leadId, flowType) => {
    await ensurePhaseTrackingSchema();
    const phases = PHASE_ORDER[flowType];
    const firstPhase = phases[0];
    const owner = PHASE_OWNERS[firstPhase];
    const result = await db_1.pool.query(`UPDATE external_leads
     SET flow_type = $2, current_phase = $3, phase_status = 'not_started', phase_owner = $4, updated_at = NOW()
     WHERE external_id = $1 OR lead_serial_number = $1
     RETURNING *`, [leadId, flowType, firstPhase, owner]);
    return result.rows[0];
};
exports.setFlowTypeService = setFlowTypeService;
const advancePhaseService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    // Get current state
    const current = await db_1.pool.query(`SELECT flow_type, current_phase, phase_status FROM external_leads
     WHERE external_id = $1 OR lead_serial_number = $1`, [leadId]);
    if (current.rows.length === 0) {
        throw new Error('Lead not found');
    }
    const lead = current.rows[0];
    if (!lead.flow_type) {
        throw new Error('Flow type not set for this lead');
    }
    if (lead.phase_status !== 'approved' && lead.phase_status !== 'completed') {
        throw new Error('Current phase must be approved or completed before advancing');
    }
    const phases = PHASE_ORDER[lead.flow_type];
    const currentIndex = phases.indexOf(lead.current_phase);
    if (currentIndex === -1) {
        throw new Error('Invalid current phase');
    }
    if (currentIndex >= phases.length - 1) {
        // Mark final phase completed
        const result = await db_1.pool.query(`UPDATE external_leads
       SET phase_status = 'completed', updated_at = NOW()
       WHERE external_id = $1 OR lead_serial_number = $1
       RETURNING *`, [leadId]);
        return { ...result.rows[0], allPhasesComplete: true };
    }
    const nextPhase = phases[currentIndex + 1];
    const owner = PHASE_OWNERS[nextPhase];
    if (nextPhase === 'event') {
        await resetEventCycleData(leadId);
    }
    const result = await db_1.pool.query(`UPDATE external_leads
     SET current_phase = $2, phase_status = 'not_started', phase_owner = $3, updated_at = NOW()
     WHERE external_id = $1 OR lead_serial_number = $1
     RETURNING *`, [leadId, nextPhase, owner]);
    return { ...result.rows[0], allPhasesComplete: false };
};
exports.advancePhaseService = advancePhaseService;
const updatePhaseStatusService = async (leadId, status) => {
    await ensurePhaseTrackingSchema();
    const result = await db_1.pool.query(`UPDATE external_leads
     SET phase_status = $2, updated_at = NOW()
     WHERE external_id = $1 OR lead_serial_number = $1
     RETURNING *`, [leadId, status]);
    return result.rows[0];
};
exports.updatePhaseStatusService = updatePhaseStatusService;
const getPhaseInfoService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    await (0, exports.reconcileLeadPhasesService)(leadId);
    const result = await db_1.pool.query(`SELECT external_id, lead_name, flow_type, current_phase, phase_status, phase_owner, pre_production_step
     FROM external_leads
     WHERE external_id = $1 OR lead_serial_number = $1`, [leadId]);
    if (result.rows.length === 0)
        return null;
    const lead = result.rows[0];
    const flowType = lead.flow_type;
    const phases = flowType ? PHASE_ORDER[flowType] : [];
    return {
        ...lead,
        phase_order: phases,
        phase_owners: PHASE_OWNERS,
    };
};
exports.getPhaseInfoService = getPhaseInfoService;
// ============================================================
// Pre-production Sub-phase Services
// ============================================================
const getPreProductionStepService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    const result = await db_1.pool.query(`SELECT external_id, lead_name, current_phase, phase_status, pre_production_step
     FROM external_leads
     WHERE external_id = $1 OR lead_serial_number = $1`, [leadId]);
    if (result.rows.length === 0) {
        throw new Error('Lead not found');
    }
    return result.rows[0];
};
exports.getPreProductionStepService = getPreProductionStepService;
const advanceToEditingStepService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    // Client has approved Phase 1 (shoot) - transition to Phase 2 (editing)
    const current = await db_1.pool.query(`SELECT current_phase, pre_production_step, phase_status FROM external_leads
     WHERE external_id = $1 OR lead_serial_number = $1`, [leadId]);
    if (current.rows.length === 0) {
        throw new Error('Lead not found');
    }
    const lead = current.rows[0];
    if (lead.current_phase !== 'pre_production') {
        throw new Error('Can only advance sub-phase during pre_production phase');
    }
    if (lead.pre_production_step !== 'shoot') {
        throw new Error('Can only advance from shoot step to editing step');
    }
    const result = await db_1.pool.query(`UPDATE external_leads
     SET pre_production_step = 'editing',
         phase_status = 'in_progress',
         updated_at = NOW()
     WHERE external_id = $1 OR lead_serial_number = $1
     RETURNING *`, [leadId]);
    return result.rows[0];
};
exports.advanceToEditingStepService = advanceToEditingStepService;
const completeEditingStepService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    // CRM has approved Phase 2 (editing) - mark as approved and advance phase
    const current = await db_1.pool.query(`SELECT current_phase, pre_production_step, phase_status FROM external_leads
     WHERE external_id = $1 OR lead_serial_number = $1`, [leadId]);
    if (current.rows.length === 0) {
        throw new Error('Lead not found');
    }
    const lead = current.rows[0];
    if (lead.current_phase !== 'pre_production') {
        throw new Error('Can only complete editing step during pre_production phase');
    }
    if (lead.pre_production_step !== 'editing') {
        throw new Error('Must be in editing step to complete');
    }
    const submissionStatus = await (0, exports.getPhase2SubmissionStatusService)(leadId);
    if (!submissionStatus.hasAssignedEditors) {
        throw new Error('Phase 2 requires at least one editor assignment (Save the Date, Save the Video, or Retouch)');
    }
    if (!submissionStatus.allSubmitted) {
        const pendingLabels = submissionStatus.roles
            .filter((role) => role.assigned && !role.submitted)
            .map((role) => role.label)
            .join(', ');
        throw new Error(`All assigned Phase 2 editors must submit files before completing. Pending: ${pendingLabels || 'assigned editors'}`);
    }
    // Set phase status to approved
    const result = await db_1.pool.query(`UPDATE external_leads
     SET phase_status = 'approved',
         updated_at = NOW()
     WHERE external_id = $1 OR lead_serial_number = $1
     RETURNING *`, [leadId]);
    return result.rows[0];
};
exports.completeEditingStepService = completeEditingStepService;
const getPhase2SubmissionStatusService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    await (0, eventDetails_query_1.ensureEventUploadColumnsQuery)();
    await (0, project_query_1.createProjectTablesQuery)();
    const assignmentResult = await db_1.pool.query(`
    SELECT
      at.external_lead_id,
      at.save_the_date,
      at.save_the_video,
      at.retouch,
      ed.save_the_date_drive_link,
      ed.save_the_date_submission_status,
      ed.save_the_video_drive_link,
      ed.save_the_video_submission_status,
      ed.retouch_drive_link,
      ed.retouch_submission_status
    FROM assign_teams at
    LEFT JOIN event_details ed
      ON ed.external_lead_id = at.external_lead_id
    WHERE at.external_lead_id = $1
       OR EXISTS (
        SELECT 1
        FROM external_leads el
        WHERE (el.external_id = $1 OR el.lead_serial_number = $1)
          AND at.external_lead_id IN (el.external_id::text, el.lead_serial_number::text)
       )
    LIMIT 1
    `, [leadId]);
    if (assignmentResult.rows.length === 0) {
        return {
            hasAssignedEditors: false,
            assignedCount: 0,
            submittedCount: 0,
            allSubmitted: false,
            roles: [
                { key: 'save_the_date', label: 'Save the Date', employee_id: null, assigned: false, submitted: false, upload_link: null },
                { key: 'save_the_video', label: 'Save the Video', employee_id: null, assigned: false, submitted: false, upload_link: null },
                { key: 'retouch', label: 'Retouch', employee_id: null, assigned: false, submitted: false, upload_link: null },
            ],
        };
    }
    const row = assignmentResult.rows[0];
    const projectIds = [`CRM-${row.external_lead_id}`, `CRM-${leadId}`];
    const projectResult = await db_1.pool.query(`
    SELECT project_type, status, upload_link
    FROM assigned_projects
    WHERE project_id = ANY($1::text[])
      AND project_type IN ('Save the Date', 'Save the Video', 'Retouching')
    `, [[...new Set(projectIds)]]);
    const projectUploads = new Map();
    for (const project of projectResult.rows) {
        projectUploads.set(project.project_type, {
            status: project.status || '',
            upload_link: project.upload_link || '',
        });
    }
    const isProjectSubmitted = (projectType) => {
        const project = projectUploads.get(projectType);
        if (!project)
            return false;
        const status = String(project.status || '').toLowerCase();
        return Boolean(project.upload_link) || status === 'completed' || status === 'approved';
    };
    const roles = [
        {
            key: 'save_the_date',
            label: 'Save the Date',
            employee_id: row.save_the_date || null,
            assigned: Boolean(row.save_the_date),
            submitted: Boolean(row.save_the_date) && (Boolean(row.save_the_date_drive_link) ||
                String(row.save_the_date_submission_status || '').toLowerCase() === 'submitted' ||
                isProjectSubmitted('Save the Date')),
            upload_link: row.save_the_date ? (row.save_the_date_drive_link || projectUploads.get('Save the Date')?.upload_link || null) : null,
        },
        {
            key: 'save_the_video',
            label: 'Save the Video',
            employee_id: row.save_the_video || null,
            assigned: Boolean(row.save_the_video),
            submitted: Boolean(row.save_the_video) && (Boolean(row.save_the_video_drive_link) ||
                String(row.save_the_video_submission_status || '').toLowerCase() === 'submitted' ||
                isProjectSubmitted('Save the Video')),
            upload_link: row.save_the_video ? (row.save_the_video_drive_link || projectUploads.get('Save the Video')?.upload_link || null) : null,
        },
        {
            key: 'retouch',
            label: 'Retouch',
            employee_id: row.retouch || null,
            assigned: Boolean(row.retouch),
            submitted: Boolean(row.retouch) && (Boolean(row.retouch_drive_link) ||
                String(row.retouch_submission_status || '').toLowerCase() === 'submitted' ||
                isProjectSubmitted('Retouching')),
            upload_link: row.retouch ? (row.retouch_drive_link || projectUploads.get('Retouching')?.upload_link || null) : null,
        },
    ];
    const assignedRoles = roles.filter((role) => role.assigned);
    const submittedCount = assignedRoles.filter((role) => role.submitted).length;
    return {
        hasAssignedEditors: assignedRoles.length > 0,
        assignedCount: assignedRoles.length,
        submittedCount,
        allSubmitted: assignedRoles.length > 0 && submittedCount === assignedRoles.length,
        roles,
    };
};
exports.getPhase2SubmissionStatusService = getPhase2SubmissionStatusService;
const checkPhase2EditorsAssignedService = async (leadId) => {
    await ensurePhaseTrackingSchema();
    const result = await db_1.pool.query(`SELECT save_the_date, save_the_video, retouch
     FROM assign_teams
     WHERE external_lead_id = $1`, [leadId]);
    if (result.rows.length === 0) {
        return { assigned: false, editors: null };
    }
    const editors = result.rows[0];
    const hasPhase2Editors = !!(editors.save_the_date || editors.save_the_video || editors.retouch);
    return {
        assigned: hasPhase2Editors,
        editors: {
            save_the_date: editors.save_the_date || null,
            save_the_video: editors.save_the_video || null,
            retouch: editors.retouch || null,
        }
    };
};
exports.checkPhase2EditorsAssignedService = checkPhase2EditorsAssignedService;
