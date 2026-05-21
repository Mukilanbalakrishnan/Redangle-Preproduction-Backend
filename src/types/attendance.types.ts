export interface ClockInDTO {
  employee_id: string;
}

export interface ClockOutDTO {
  employee_id: string;
}

export interface AttendanceRecord {
  id: number;
  employee_id: string;
  date: string;
  login_time: string | null;
  logout_time: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}
