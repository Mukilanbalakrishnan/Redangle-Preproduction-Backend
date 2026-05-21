import { Router } from "express";
import { createEventDetailsController, getEventDetailsByLeadIdController, updateUploadDetailsController }
  from "../controllers/eventDetails.controller";

const router = Router();

router.post("/", createEventDetailsController);
router.get("/:leadId", getEventDetailsByLeadIdController);
router.patch("/:leadId/upload", updateUploadDetailsController);

export default router;