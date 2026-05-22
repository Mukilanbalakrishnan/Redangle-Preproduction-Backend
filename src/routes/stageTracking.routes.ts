import { Router } from "express";
import { updateCurrentStageController,getStagesByLeadController }
from "../controllers/stageTracking.controller";

const router = Router();

router.post("/stage/update", updateCurrentStageController);
router.get("/stage/:leadId", getStagesByLeadController);

export default router;