import { pool } from "../config/db";
import {
  CreateCreativeConfirmationDTO,
  CreativeConfirmation
} from "../types/creativeConfirmation.types";

export const upsertCreativeConfirmationQuery = async (
  data: CreateCreativeConfirmationDTO
): Promise<CreativeConfirmation> => {

  const query = `
  INSERT INTO creative_confirmations (
    external_lead_id,
    costume_type,
    color_preferences,
    costume_requirements,
    event_theme,
    mood_description,
    reference_images,
    location_name,
    location_type,
    google_map_link,
    client_approved
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)

  ON CONFLICT (external_lead_id)
  DO UPDATE SET
    costume_type = EXCLUDED.costume_type,
    color_preferences = EXCLUDED.color_preferences,
    costume_requirements = EXCLUDED.costume_requirements,
    event_theme = EXCLUDED.event_theme,
    mood_description = EXCLUDED.mood_description,
    reference_images = EXCLUDED.reference_images,
    location_name = EXCLUDED.location_name,
    location_type = EXCLUDED.location_type,
    google_map_link = EXCLUDED.google_map_link,
    client_approved = EXCLUDED.client_approved,
    updated_at = NOW()

  RETURNING *;
  `;

  const values = [
    data.external_lead_id,
    data.costume_type,
    data.color_preferences ?? [],
    data.costume_requirements,
    data.event_theme,
    data.mood_description,
    data.reference_images ?? [],
    data.location_name,
    data.location_type,
    data.google_map_link,
    data.client_approved ?? false
  ];

  const result = await pool.query<CreativeConfirmation>(query, values);

  return result.rows[0];
};

export const getCreativeConfirmationService = async (
  external_lead_id: number | string
) => {

  const result = await pool.query(
    `
    SELECT *
    FROM creative_confirmations
    WHERE external_lead_id = $1
    LIMIT 1
    `,
    [external_lead_id]
  );

  return result.rows[0];
};
