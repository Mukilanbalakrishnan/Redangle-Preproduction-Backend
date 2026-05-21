export interface UpdateStageDTO {
  external_lead_id: number;
  stage_name: string;
  is_completed: boolean;
}

export interface LeadStageTracking extends UpdateStageDTO {
  id: number;
  completed_at: Date | null;
  created_at: Date;
}