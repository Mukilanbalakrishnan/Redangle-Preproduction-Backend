import { Router } from "express";
import {
    createNotificationController,
    getNotificationsController,
    markNotificationReadController,
    markAllNotificationsReadController,
} from "../controllers/notification.controller";

const router = Router();

router.post("/", createNotificationController);
router.get("/", getNotificationsController);
router.patch("/:id/read", markNotificationReadController);
router.patch("/read-all", markAllNotificationsReadController);

export default router;
