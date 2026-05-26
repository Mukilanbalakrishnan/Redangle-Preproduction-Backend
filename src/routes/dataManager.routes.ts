import { Router } from "express";
import { 
    getIncomingDataController, 
    verifyMediaController, 
    requestReuploadController, 
    getHardDiskClosureController, 
    saveHardDiskClosureController, 
    getHardDiskStatsController, 
    updateIncomingDataController, 
    deleteIncomingDataController, 
    markHardDiskReceivedController,
    crmVerifyController,
    saveVerificationDraftController,
    partialApproveMediaController,
    approveMediaController
} from "../controllers/dataManager.controller";

const router = Router();

router.get("/incoming", getIncomingDataController);
router.put("/incoming/:leadId", updateIncomingDataController);
router.delete("/incoming/:leadId", deleteIncomingDataController);
router.patch("/:leadId/verify", verifyMediaController);
router.patch("/:leadId/hard-disk-received", markHardDiskReceivedController);
router.patch("/:leadId/mark-harddisk-received", markHardDiskReceivedController);
router.patch("/:leadId/crm-verify", crmVerifyController);
router.patch("/:leadId/request-reupload", requestReuploadController);
router.patch("/:leadId/verification-draft", saveVerificationDraftController);
router.patch("/:leadId/partial-approve", partialApproveMediaController);
router.patch("/:leadId/approve", approveMediaController);

// Hard Disk Closure
router.get("/hard-disk-closure/:leadId", getHardDiskClosureController);
router.post("/hard-disk-closure/:leadId", saveHardDiskClosureController);
router.get("/hard-disk-stats", getHardDiskStatsController);

export default router;
