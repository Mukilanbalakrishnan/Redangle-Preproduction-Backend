import { Router } from "express";
import { createEventDetailsController, getEventDetailsByLeadIdController, updateUploadDetailsController }
  from "../controllers/eventDetails.controller";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const router = Router();

router.post("/", createEventDetailsController);
router.get("/:leadId", getEventDetailsByLeadIdController);
router.patch("/:leadId/upload", upload.fields([{ name: 'firstClipFile' }, { name: 'lastClipFile' }]), updateUploadDetailsController);

export default router;