import express from 'express'
import { createPhotoUploadController , getPhotoUploadByLeadController} from '../controllers/photoUpload.controller'

const router = express.Router()

router.post('/photo-upload', createPhotoUploadController)

router.get('/photo-upload/:leadId', getPhotoUploadByLeadController)

export default router