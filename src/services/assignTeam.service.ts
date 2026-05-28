import { pool } from "../config/db";
import { AssignTeamDTO } from "../types/assignTeam.types";

import {
  upsertAssignTeamQuery
} from "../queries/assignTeam.query";

import {
  syncPreProductionAssignmentsQuery
} from "../queries/project.query";

import {
  updateLeadStatusQuery
} from "../queries/externalLead.query";

import {
  submitPreProductionPhaseService
} from "./phaseTracking.service";
import { createNotificationService } from "./notification.service";

type AssignmentNotificationTarget = {
  employeeId: string;
  role: string;
  task: string;
};

const normalizeStageLabel = (phase?: string) => {
  const normalized = String(phase || "").toLowerCase();
  if (normalized === "event") return "Event";
  if (normalized === "post_production" || normalized === "post-production") return "Post-production";
  return "Pre-production";
};

const normalizeSourceStage = (phase?: string) => normalizeStageLabel(phase).toLowerCase();

const roleSlug = (role: string) =>
  role.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const cleanEmployeeId = (value?: string | null) => String(value || "").split("::")[0].trim();

const parseStaffRole = (value?: string | null) => {
  const parts = String(value || "").split("::");
  return parts[1]?.trim() || "Staff";
};

const uniqueTargets = (targets: AssignmentNotificationTarget[]) => {
  const seen = new Set<string>();
  return targets.filter(target => {
    if (!target.employeeId || target.employeeId.startsWith("FREELANCE_")) return false;
    const key = `${target.employeeId}:${target.task}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const assignmentTargetsFromPayload = (data: AssignTeamDTO, phase: string): AssignmentNotificationTarget[] => {
  const isEvent = phase === "event";
  const targets: AssignmentNotificationTarget[] = [];

  const push = (employeeId: string | undefined, role: string, task = role) => {
    const clean = cleanEmployeeId(employeeId);
    if (clean) targets.push({ employeeId: clean, role: roleSlug(role), task });
  };

  push(data.photographer, "Photographer");
  push(data.videographer, "Videographer");
  push(data.drone, "Drone");

  (data.secondary_photographer || []).forEach(id => push(id, "Photographer", "Secondary Photographer"));
  (data.secondary_videographer || []).forEach(id => push(id, "Videographer", "Secondary Videographer"));
  (data.secondary_drone || []).forEach(id => push(id, "Drone", "Secondary Drone"));

  if (!isEvent) {
    push(data.save_the_date, "Save the Date Post", "Save the Date");
    push(data.save_the_video, "Save the Date Video", "Save the Video");
    push(data.retouch, "Retouch Photo", "Retouching");
  }

  (data.additional_staff || []).forEach(entry => {
    const role = parseStaffRole(entry);
    push(entry, role, role);
  });

  return uniqueTargets(targets);
};

const assignmentTargetsFromRow = (row: any, phase: string): AssignmentNotificationTarget[] => {
  if (!row) return [];
  const isEvent = phase === "event";
  return assignmentTargetsFromPayload({
    external_lead_id: row.external_lead_id,
    assignment_phase: isEvent ? "event" : "pre_production",
    photographer: isEvent ? row.event_photographer : row.photographer,
    videographer: isEvent ? row.event_videographer : row.videographer,
    drone: isEvent ? row.event_drone : row.drone,
    secondary_photographer: isEvent ? row.event_secondary_photographer : row.secondary_photographer,
    secondary_videographer: isEvent ? row.event_secondary_videographer : row.secondary_videographer,
    secondary_drone: isEvent ? row.event_secondary_drone : row.secondary_drone,
    additional_staff: isEvent ? row.event_additional_staff : row.additional_staff,
    save_the_date: row.save_the_date,
    save_the_video: row.save_the_video,
    retouch: row.retouch,
  }, phase);
};

const getProjectNameForAssignment = async (externalLeadId: string | number) => {
  const fallback = `Lead #${externalLeadId}`;
  const result = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(ed.client_name), ''), NULLIF(TRIM(el.lead_name), ''), $2) AS project_name
     FROM external_leads el
     LEFT JOIN event_details ed ON ed.external_lead_id = el.external_id OR ed.external_lead_id = el.lead_serial_number
     WHERE el.external_id = $1 OR el.lead_serial_number = $1
     LIMIT 1`,
    [String(externalLeadId), fallback]
  );
  return result.rows[0]?.project_name || fallback;
};

const notifyAssignedEmployees = async (
  data: AssignTeamDTO,
  phase: string,
  previousRow: any
) => {
  const nextTargets = assignmentTargetsFromPayload(data, phase);
  if (!nextTargets.length) return;

  const previousKeys = new Set(
    assignmentTargetsFromRow(previousRow, phase).map(target => `${target.employeeId}:${target.task}`)
  );
  const newTargets = nextTargets.filter(target => !previousKeys.has(`${target.employeeId}:${target.task}`));
  if (!newTargets.length) return;

  const stageLabel = normalizeStageLabel(phase);
  const projectName = await getProjectNameForAssignment(data.external_lead_id);
  const fromName = data.assigned_by_name || data.assigned_by_role || stageLabel;
  const fromRole = data.assigned_by_role || (phase === "event" ? "event-coordinator" : "crm");

  await Promise.all(newTargets.map(target =>
    createNotificationService({
      type: "work_assigned",
      title: "Work Assigned",
      detail: `${fromName} assigned you ${target.task} work for ${projectName} from ${stageLabel}.`,
      from_role: fromRole,
      from_name: fromName,
      target_roles: [target.role],
      target_employee_id: target.employeeId,
      source_stage: normalizeSourceStage(phase),
    }).catch(err => console.error("Assignment notification error:", err))
  ));
};

export const saveAssignTeamService = async (
  data: AssignTeamDTO
) => {
  const assignmentPhase = String(data.assignment_phase || '').toLowerCase();

  const existingResult = await pool.query(
    `SELECT * FROM assign_teams WHERE external_lead_id = $1 LIMIT 1`,
    [String(data.external_lead_id).trim()]
  );
  const previousTeam = existingResult.rows[0] || null;

  const team = await upsertAssignTeamQuery(data);

  // Get current pre-production step
  const stepResult = await pool.query(
    `SELECT pre_production_step, current_phase FROM external_leads
     WHERE external_id = $1 OR lead_serial_number = $1`,
    [data.external_lead_id]
  );

  const currentStep = stepResult.rows[0]?.pre_production_step || 'shoot';
  const currentPhase = stepResult.rows[0]?.current_phase;
  const effectivePhase = assignmentPhase === 'event' || currentPhase === 'event' ? 'event' : (currentPhase || 'pre_production');

  await notifyAssignedEmployees(data, effectivePhase, previousTeam);

  if (assignmentPhase === 'event' || currentPhase === 'event') {
    await updateLeadStatusQuery(
      data.external_lead_id,
      "assign_team"
    );
    return team;
  }

  // Sync Phase 2 editor assignments to projects table
  await syncPreProductionAssignmentsQuery(data.external_lead_id, [
    {
      project_type: "Save the Date",
      employee_id: data.save_the_date || "",
    },
    {
      project_type: "Save the Video",
      employee_id: data.save_the_video || "",
    },
    {
      project_type: "Retouching",
      employee_id: data.retouch || "",
    },
  ]);

  await updateLeadStatusQuery(
    data.external_lead_id,
    "assign_team"
  );

  // Only submit phase for approval when:
  // 1. We're in pre_production phase AND
  // 2. We're in the editing step (Phase 2) - OR -
  // 3. The lead is NOT in pre_production (event phase team assignment)
  if (currentPhase === 'pre_production' && currentStep === 'editing') {
    await submitPreProductionPhaseService(String(data.external_lead_id));
  } else if (currentPhase !== 'pre_production') {
    // Event phase or other phases - normal submission
    await submitPreProductionPhaseService(String(data.external_lead_id));
  }
  // In shoot step (Phase 1): don't submit - client approval needed first

  return team;
};

export const updateResourcesService = async (external_lead_id: string, file_path: string) => {
  const { updateResourcesQuery } = require("../queries/assignTeam.query");
  return await updateResourcesQuery(external_lead_id, file_path);
};
