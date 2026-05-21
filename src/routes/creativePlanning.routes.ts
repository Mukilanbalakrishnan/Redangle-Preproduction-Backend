import { Router } from "express";

import {
  saveCreativePlanningController,
  getCreativePlanningController
} from "../controllers/creativePlanning.controller";

const router = Router();


router.post(
  "/creative-planning",
  saveCreativePlanningController
);

router.get(
  "/creative-planning/:external_lead_id",
  getCreativePlanningController
);

export default router;