export interface CreateEventDetailsDTO {
  external_lead_id: number;

  client_name: string;
  email: string;
  phone: string;

  contact_person_name?: string;
  contact_person_number?: string;

  event_type: string;
  event_location?: string;

  preferred_date: string;
  preferred_time: string;
  budget_range: string;

  services?: string[];
  deliverables?: string[];
  invoice_attached?: boolean;

  meeting_type: string;
  meeting_details: string;

  client_requirements: string;
  priority_level?: string;
}

export interface EventDetails extends CreateEventDetailsDTO {
  id: number;
  created_at: Date;
  updated_at: Date;
}