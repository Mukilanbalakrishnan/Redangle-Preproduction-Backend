import { Router } from "express";

import {
  saveAssignTeamController,
  getAssignTeamController,
  acceptAssignmentController,
  getAssignmentStatusController
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

export default router;