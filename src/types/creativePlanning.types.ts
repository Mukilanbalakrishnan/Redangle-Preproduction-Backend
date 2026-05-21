export interface CreativePlanning {
  id: number;
  external_lead_id: number;

  event_list: string;

  equipment_required: string[];
  lighting_setup: string[];
  props_required: string[];

  special_notes: string;

  created_at: Date;
  updated_at: Date;
}

export interface CreateCreativePlanningDTO {
  external_lead_id: number;

  event_list: string;

  equipment_required: string[];
  lighting_setup: string[];
  props_required: string[];

  special_notes: string;
}