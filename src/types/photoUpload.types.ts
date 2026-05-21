export interface PhotoUploadInput {
  lead_id: number
  client_name: string
  event_type: string
  drive_link: string
  camera_used?: string
  num_images?: number
  upload_notes?: string
  uploaded_by?: number
}

export interface PhotoUploadResponse {
  success: boolean
  message: string
}