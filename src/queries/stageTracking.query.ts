import { pool } from "../config/db";
import { UpdateStageDTO, LeadStageTracking }
from "../types/stageTracking.types";

export const updateCurrentStageQuery = async (
  external_lead_id: number | string,
  stage_name: string
) => {

  const query = `
    INSERT INTO lead_tracking_stages (
      external_lead_id,
      stage_name,
      created_at
    )
    VALUES ($1, $2, NOW())
    ON CONFLICT (external_lead_id, stage_name) DO NOTHING
    RETURNING *;
  `;

  const result = await pool.query(query, [
    external_lead_id,
    stage_name
  ]);

  console.log("INSERT STAGE RES:", external_lead_id, stage_name, result.rows, result.rowCount);

  return result.rows[0];
};

export const getStagesByLeadQuery = async (
  leadId: number | string
) => {

  const result = await pool.query(
    `
    SELECT
      ARRAY_AGG(stage_name) AS completed_stages,
      CASE
        WHEN 'completed_assign_team' = ANY(ARRAY_AGG(stage_name)) THEN 'completed_assign_team'
        WHEN 'team_assignment'       = ANY(ARRAY_AGG(stage_name)) THEN 'team_assignment'
        WHEN 'creative_planning'     = ANY(ARRAY_AGG(stage_name)) THEN 'creative_planning'
        WHEN 'creative_confirmation' = ANY(ARRAY_AGG(stage_name)) THEN 'creative_confirmation'
        ELSE 'initial_client'
      END AS current_stage
    FROM lead_tracking_stages
    WHERE external_lead_id = $1
    `,
    [leadId]
  );

  return result.rows[0] || null;
};
