export interface CreateNotificationDTO {
    type: 'query' | 'assignment_accepted' | 'leave_request' | 'raw_data_uploaded' | string;
    title: string;
    detail?: string;
    lead_id?: number;
    from_role?: string;
    from_name?: string;
    target_roles: string[];
    target_employee_id?: string;
    source_stage?: string;
}

export interface Notification {
    id?: number;
    notification_id?: number;
    type: string;
    title: string;
    detail: string | null;
    lead_id: number | null;
    from_role: string | null;
    from_name: string | null;
    target_roles: string[];
    target_employee_id: string | null;
    source_stage: string | null;
    is_read: boolean;
    created_at: Date;
}
