export interface CreateCreativeConfirmationDTO {
  external_lead_id: number;

  costume_type?: string;
  color_preferences?: string[];
  costume_requirements?: string;

  event_theme?: string;
  mood_description?: string;

  reference_images?: string[];

  location_name?: string;
  location_type?: string;
  google_map_link?: string;

  client_approved?: boolean;
}

export interface CreativeConfirmation
  extends CreateCreativeConfirmationDTO {
  id: number;
  created_at: Date;
  updated_at: Date;
}