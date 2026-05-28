export interface AssignTeamDTO {

  external_lead_id: string | number;
  assignment_phase?: 'pre_production' | 'event';
  assigned_by_name?: string;
  assigned_by_role?: string;

  photographer?: string;
  videographer?: string;
  drone?: string;
  save_the_date?: string;
  save_the_video?: string;
  retouch?: string;
  assistant?: string;
  editor?: string;

  secondary_photographer?: string[];
  secondary_videographer?: string[];
  secondary_drone?: string[];
  additional_staff?: string[];

  event_date?: string;
  event_time?: string;
  location?: string;
  shoot_locations?: any[];
}

export interface AssignTeam {

  id: number;

  external_lead_id: string;

  photographer: string;
  videographer: string;
  drone: string;
  save_the_date: string;
  save_the_video: string;
  retouch: string;
  assistant: string;
  editor: string;

  secondary_photographer: string[];
  secondary_videographer: string[];
  secondary_drone: string[];
  additional_staff: string[];

  event_date: string;
  event_time: string;
  location: string;
  shoot_locations?: any[];

  created_at: string;
  updated_at: string;
}
