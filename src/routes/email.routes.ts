import { Router } from "express";
import { sendEmail } from "../controllers/email.controller";
import { upload } from "../config/multer";

const router = Router();

router.post(
  "/email/send",
  upload.array("attachments"),
  sendEmail
);

export default router;