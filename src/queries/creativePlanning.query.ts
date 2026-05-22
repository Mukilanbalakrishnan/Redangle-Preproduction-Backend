import { pool } from "../config/db";
import {
  CreateCreativePlanningDTO,
  CreativePlanning
} from "../types/creativePlanning.types";

export const upsertCreativePlanningQuery = async (
  data: CreateCreativePlanningDTO
): Promise<CreativePlanning> => {

  const query = `
  INSERT INTO creative_plannings (
    external_lead_id,
    event_list,
    equipment_required,
    lighting_setup,
    props_required,
    special_notes
  )

  VALUES ($1,$2,$3,$4,$5,$6)

  ON CONFLICT (external_lead_id)

  DO UPDATE SET
    event_list = EXCLUDED.event_list,
    equipment_required = EXCLUDED.equipment_required,
    lighting_setup = EXCLUDED.lighting_setup,
    props_required = EXCLUDED.props_required,
    special_notes = EXCLUDED.special_notes,
    updated_at = NOW()

  RETURNING *;
  `;

  const values = [
    data.external_lead_id,
    data.event_list,
    data.equipment_required ?? [],
    data.lighting_setup ?? [],
    data.props_required ?? [],
    data.special_notes
  ];

  const result = await pool.query<CreativePlanning>(query, values);

  return result.rows[0];
};


export const getCreativePlanningQuery = async (
  external_lead_id: number | string
) => {

  const result = await pool.query(
    `
    SELECT *
    FROM creative_plannings
    WHERE external_lead_id = $1
    LIMIT 1
    `,
    [external_lead_id]
  );

  return result.rows[0];
};
