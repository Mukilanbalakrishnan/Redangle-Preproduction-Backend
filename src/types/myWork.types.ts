export interface MyWorkItem {
  lead_employee_id: number
  lead_id: number
  lead_code: string
  client: string
  type: string
  title: string
  priority: string
  deadline: string
  estimated_duration: string | null
  description: string | null
}