import {
    createNotificationQuery,
    getNotificationsByRoleQuery,
    getNotificationsByRolesQuery,
    markNotificationReadQuery,
    markAllNotificationsReadQuery,
    markAllNotificationsReadByRolesQuery,
} from "../queries/notification.queries";
import { CreateNotificationDTO } from "../types/notification.types";

export const createNotificationService = async (data: CreateNotificationDTO) => {
    return createNotificationQuery(data);
};

export const getNotificationsService = async (role: string) => {
    return getNotificationsByRoleQuery(role);
};

export const getNotificationsByRolesService = async (roles: string[]) => {
    return getNotificationsByRolesQuery(roles);
};

export const markNotificationReadService = async (id: number) => {
    return markNotificationReadQuery(id);
};

export const markAllNotificationsReadService = async (role: string) => {
    return markAllNotificationsReadQuery(role);
};

export const markAllNotificationsReadByRolesService = async (roles: string[]) => {
    return markAllNotificationsReadByRolesQuery(roles);
};
