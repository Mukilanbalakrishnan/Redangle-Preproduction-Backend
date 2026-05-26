import { Router } from "express";

import {
  saveAssignTeamController,
  getAssignTeamController,
  acceptAssignmentController,
  getAssignmentStatusController,
  updateResourcesController
} from "../controllers/assignTeam.controller";

const router = Router();


router.post(
  "/assign-team",
  saveAssignTeamController
);


router.get(
  "/assign-team/:external_lead_id",
  getAssignTeamController
);

router.patch(
  "/assign-team/:external_lead_id/accept",
  acceptAssignmentController
);

router.get(
  "/assign-team/:external_lead_id/status",
  getAssignmentStatusController
);

router.patch(
  "/assign-team/:external_lead_id/resources",
  updateResourcesController
);

export default router;