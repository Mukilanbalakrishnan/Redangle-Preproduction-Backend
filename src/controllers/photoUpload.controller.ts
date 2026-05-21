import { Request, Response } from 'express'
import { createPhotoUploadService , getPhotoUploadByLeadService } from '../services/photoUpload.service'

export const createPhotoUploadController = async (req: Request, res: Response) => {

  try {

    const {
      lead_id,
      client_name,
      event_type,
      drive_link,
      camera_used,
      num_images,
      upload_notes,
      uploaded_by
    } = req.body

    if (!lead_id || !drive_link) {
      return res.status(400).json({
        success: false,
        message: 'Lead ID and Drive link are required'
      })
    }

    const upload = await createPhotoUploadService({
      lead_id,
      client_name,
      event_type,
      drive_link,
      camera_used,
      num_images,
      upload_notes,
      uploaded_by
    })

    res.status(201).json({
      success: true,
      message: 'Photo upload details saved successfully',
      data: upload
    })

  } catch (error) {

    console.error('Photo upload controller error:', error)

    res.status(500).json({
      success: false,
      message: 'Failed to store photo upload'
    })
  }
}


export const getPhotoUploadByLeadController = async (req: Request, res: Response) => {

  try {

    const leadId = String(req.params.leadId)

    const data = await getPhotoUploadByLeadService(leadId)

    res.json({
      success: true,
      data
    })

  } catch (error) {

    console.error("Fetch upload error:", error)

    res.status(500).json({
      success: false,
      message: "Failed to fetch upload details"
    })
  }
}