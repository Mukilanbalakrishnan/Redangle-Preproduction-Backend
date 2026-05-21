export interface DashboardStats {
  assigned: number
  pending: number
  submitted: number
  approved: number
}

export interface RecentProject {
  lead_id: number
  name: string
  type: string
  deadline: string
  task_name: string
  priority: string
}

export interface EmployeeDashboardResponse {
  stats: DashboardStats
  recentProjects: RecentProject[]
}