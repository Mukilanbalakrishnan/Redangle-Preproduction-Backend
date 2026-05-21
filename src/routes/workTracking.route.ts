import express from "express"
import { getWorkTrackingController, updateWorkTrackingController, deleteWorkTrackingController } from "../controllers/workTracking.controller"

const router = express.Router()

router.get("/work-tracking", getWorkTrackingController)
router.put("/work-tracking/:id", updateWorkTrackingController)
router.delete("/work-tracking/:id", deleteWorkTrackingController)

export default router