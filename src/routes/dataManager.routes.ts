import { Router } from "express";
import { getIncomingDataController, verifyMediaController, requestReuploadController, getHardDiskClosureController, saveHardDiskClosureController, getHardDiskStatsController, updateIncomingDataController, deleteIncomingDataController, markHardDiskReceivedController } from "../controllers/dataManager.controller";

const router = Router();

router.get("/incoming", getIncomingDataController);
router.put("/incoming/:leadId", updateIncomingDataController);
router.delete("/incoming/:leadId", deleteIncomingDataController);
router.patch("/:leadId/verify", verifyMediaController);
router.patch("/:leadId/hard-disk-received", markHardDiskReceivedController);
router.patch("/:leadId/mark-harddisk-received", markHardDiskReceivedController);
router.patch("/:leadId/crm-verify", require("../controllers/dataManager.controller").crmVerifyController);
router.patch("/:leadId/request-reupload", requestReuploadController);
router.patch("/:leadId/approve", require("../controllers/dataManager.controller").approveMediaController);

// Hard Disk Closure
router.get("/hard-disk-closure/:leadId", getHardDiskClosureController);
router.post("/hard-disk-closure/:leadId", saveHardDiskClosureController);
router.get("/hard-disk-stats", getHardDiskStatsController);

export default router;
