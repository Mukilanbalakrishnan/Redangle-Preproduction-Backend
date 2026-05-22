import { Router } from "express";
import { submitPixofficeDataController, getPixofficeStatsController } from "../controllers/pixoffice.controller";

const router = Router();

router.post("/submit", submitPixofficeDataController);
router.get("/stats", getPixofficeStatsController);

export default router;
