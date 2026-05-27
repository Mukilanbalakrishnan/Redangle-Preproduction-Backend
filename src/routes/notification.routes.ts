import { Router } from "express";
import {
    createNotificationController,
    getNotificationsController,
    markNotificationReadController,
    markAllNotificationsReadController,
    clearNotificationsController,
} from "../controllers/notification.controller";

const router = Router();

router.post("/", createNotificationController);
router.get("/", getNotificationsController);
router.patch("/read-all", markAllNotificationsReadController);
router.delete("/clear", clearNotificationsController);
router.patch("/:id/read", markNotificationReadController);

export default router;
