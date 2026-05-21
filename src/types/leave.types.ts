export interface CreateLeaveRequestDTO {
  employee_id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  no_of_days: number;
  reason: string;
}

export interface UpdateLeaveStatusDTO {
  status: 'Approved' | 'Accepted' | 'Rejected' | 'Pending';
}

export interface LeaveRecord {
  leave_request_id: number;
  employee_id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  no_of_days: number;
  reason: string;
  status: string;
  created_at?: string;
  updated_at?: string;

  // Joins
  employee_name?: string;
  role?: string;
}
