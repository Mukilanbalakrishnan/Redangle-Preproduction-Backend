import { Request, Response } from "express";
import {
    createNotificationService,
    getNotificationsService,
    getNotificationsByRolesService,
    markNotificationReadService,
    markAllNotificationsReadService,
    markAllNotificationsReadByRolesService,
} from "../services/notification.service";

export const createNotificationController = async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const notification = await createNotificationService({
            type: data.type,
            title: data.title,
            detail: data.detail,
            lead_id: data.lead_id,
            from_role: data.from_role,
            from_name: data.from_name,
            target_roles: data.target_roles || ["admin"], // Default to admin if missing
        });
        return res.status(201).json({ success: true, data: notification });
    } catch (error: any) {
        console.error("Error creating notification:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getNotificationsController = async (req: Request, res: Response) => {
    try {
        const rolesParam = req.query.roles as string | undefined;
        const role = (req.query.role as string) || "admin";

        let notifications;
        if (rolesParam) {
            const rolesArray = rolesParam.split(",").map(r => r.trim()).filter(Boolean);
            notifications = await getNotificationsByRolesService(rolesArray);
        } else {
            notifications = await getNotificationsService(role);
        }

        return res.status(200).json({ success: true, data: notifications });
    } catch (error: any) {
        console.error("Error getting notifications:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const markNotificationReadController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const notification = await markNotificationReadService(Number(id));
        return res.status(200).json({ success: true, data: notification });
    } catch (error: any) {
        console.error("Error marking notification read:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const markAllNotificationsReadController = async (req: Request, res: Response) => {
    try {
        const roles = req.body.roles as string[] | undefined;
        const role = (req.body.role as string) || "admin";

        if (roles && Array.isArray(roles) && roles.length > 0) {
            await markAllNotificationsReadByRolesService(roles);
        } else {
            await markAllNotificationsReadService(role);
        }

        return res.status(200).json({ success: true, message: "All notifications marked as read" });
    } catch (error: any) {
        console.error("Error marking all notifications read:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
