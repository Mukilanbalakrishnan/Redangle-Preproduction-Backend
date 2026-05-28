import {
    createNotificationQuery,
    getNotificationsByRoleQuery,
    getNotificationsByRolesQuery,
    getNotificationsFilteredQuery,
    clearNotificationsQuery,
    markNotificationReadQuery,
    markAllNotificationsReadQuery,
    markAllNotificationsReadByRolesQuery,
    NotificationFilters,
} from "../queries/notification.queries";
import { CreateNotificationDTO } from "../types/notification.types";

export const createNotificationService = async (data: CreateNotificationDTO) => {
    return createNotificationQuery(data);
};

export const getNotificationsService = async (role: string, employee_id?: string) => {
    return getNotificationsByRoleQuery(role, employee_id);
};

export const getNotificationsByRolesService = async (roles: string[], employee_id?: string) => {
    return getNotificationsByRolesQuery(roles, employee_id);
};

export const getNotificationsFilteredService = async (filters: NotificationFilters) => {
    return getNotificationsFilteredQuery(filters);
};

export const clearNotificationsService = async (filters: { roles?: string[]; employee_id?: string }) => {
    return clearNotificationsQuery(filters);
};

export const markNotificationReadService = async (id: number) => {
    return markNotificationReadQuery(id);
};

export const markAllNotificationsReadService = async (role: string, employee_id?: string) => {
    return markAllNotificationsReadQuery(role, employee_id);
};

export const markAllNotificationsReadByRolesService = async (roles: string[], employee_id?: string) => {
    return markAllNotificationsReadByRolesQuery(roles, employee_id);
};
