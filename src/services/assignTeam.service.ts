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

export const saveAssignTeamService = async (
  data: AssignTeamDTO
) => {

  const team = await upsertAssignTeamQuery(data);
  const assignmentPhase = String(data.assignment_phase || '').toLowerCase();

  // Get current pre-production step
  const stepResult = await pool.query(
    `SELECT pre_production_step, current_phase FROM external_leads
     WHERE external_id = $1 OR lead_serial_number = $1`,
    [data.external_lead_id]
  );

  const currentStep = stepResult.rows[0]?.pre_production_step || 'shoot';
  const currentPhase = stepResult.rows[0]?.current_phase;

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
