export interface CreateEmployeeDTO {
  employee_id: string
  first_name: string
  last_name?: string
  email: string
  contact_number?: string
  dob?: string
  address?: string
  work_location?: string
  role: string
  roles?: string[]
  experience?: string
  date_of_join?: string
  description?: string
  created_by?: string
  profile_image?: string
  identity_document?: string
  password?: string
}