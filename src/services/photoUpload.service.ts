import {pool} from '../config/db'
import { insertPhotoUploadQuery , getPhotoUploadByLeadQuery } from '../queries/photoUpload.query'
import { PhotoUploadInput } from '../types/photoUpload.types'

export const createPhotoUploadService = async (data: PhotoUploadInput) => {

  const values = [
    data.lead_id,
    data.client_name,
    data.event_type,
    data.drive_link,
    data.camera_used,
    data.num_images || 0,
    data.upload_notes,
    data.uploaded_by || null
  ]

  const result = await pool.query(insertPhotoUploadQuery, values)

  return result.rows[0]
}

export const getPhotoUploadByLeadService = async (leadId: number | string) => {

  const result = await pool.query(getPhotoUploadByLeadQuery, [leadId])

  return result.rows[0] || null
}
