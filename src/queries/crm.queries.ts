import { pool, salesPool } from "../config/db";
import { ensureAssignTeamColumnsQuery } from "./assignTeam.query";

// CRM Attendance: all employees' attendance for a given date (default today)
export const getCrmAttendanceQuery = async (date?: string) => {
    const targetDate = date || "CURRENT_DATE";
    const dateClause = date ? `ea.date = $1` : `ea.date = CURRENT_DATE`;
    const params = date ? [date] : [];

    const result = await pool.query(
        `SELECT
            ea.attendance_id,
            ea.employee_id,
            CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
            e.role,
            ea.check_in AS login,
            ea.check_out AS logout,
            ea.status
        FROM employees_attendance ea
        LEFT JOIN employees e ON ea.employee_id = CAST(REPLACE(e.employee_id, 'EMP-', '') AS INTEGER)
        WHERE ${dateClause}
        ORDER BY e.first_name ASC`,
        params
    );
    return result.rows;
};

// CRM Work Tracking: all assigned tasks across employees
export const getCrmWorkTrackingQuery = async () => {
    const result = await pool.query(
        `SELECT
            le.lead_employee_id,
            le.lead_id,
            CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS emp,
            le.task_name AS task,
            le.priority AS status,
            TO_CHAR(le.created_at, 'DD-MM-YYYY') AS start,
            CASE WHEN le.deadline IS NOT NULL THEN TO_CHAR(le.deadline, 'DD-MM-YYYY') ELSE '—' END AS "end"
        FROM lead_employee le
        LEFT JOIN employees e ON le.employee_id = e.employee_id
        ORDER BY le.created_at DESC`
    );
    return result.rows;
};

// CRM Leave Management: all leave requests across employees
export const getCrmLeaveManagementQuery = async () => {
    const result = await pool.query(
        `SELECT
            elr.leave_request_id,
            elr.employee_id,
            CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS emp,
            e.role,
            elr.leave_type AS type,
            elr.from_date,
            elr.to_date,
            elr.no_of_days,
            elr.status,
            elr.reason,
            elr.created_at
        FROM employee_leave_requests elr
        LEFT JOIN employees e ON elr.employee_id = e.employee_id
        ORDER BY elr.created_at DESC`
    );
    return result.rows;
};

// CRM: Approve or reject a leave request
export const updateLeaveStatusQuery = async (leaveRequestId: number, status: string) => {
    const result = await pool.query(
        `UPDATE employee_leave_requests
         SET status = $2, updated_at = NOW()
         WHERE leave_request_id = $1
         RETURNING *`,
        [leaveRequestId, status]
    );
    return result.rows[0];
};

const normalizeLeadLookup = (leadId: string | number) =>
    String(leadId || '').replace(/^CRM-/i, '').trim();

const estimateRawDataSizeGb = (row: any) => {
    const images = Number(row?.num_images || 0) + Number(row?.drone_num_images || 0);
    const videos = Number(row?.num_videos || 0) + Number(row?.drone_num_videos || 0);
    return Number(((images * 0.05) + (videos * 0.5)).toFixed(1));
};

const tableExists = async (db: any, tableName: string) => {
    const result = await db.query(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = $1
        ) AS exists`,
        [tableName]
    );
    return Boolean(result.rows[0]?.exists);
};

type DeliveryStore = { db: any; hasLeadsDetail: boolean; name: 'sales' | 'crm' };

const deliveryStoreCandidates = async (): Promise<DeliveryStore[]> => {
    const candidates: DeliveryStore[] = [];

    try {
        if (await tableExists(salesPool, 'leads_detail')) {
            candidates.push({ db: salesPool, hasLeadsDetail: true, name: 'sales' });
        }
    } catch {
        // Continue probing optional stores.
    }

    try {
        if (await tableExists(pool, 'leads_detail')) {
            candidates.push({ db: pool, hasLeadsDetail: true, name: 'crm' });
        }
    } catch {
        // Fall back below when the CRM store is unavailable or does not contain sales leads.
    }

    return candidates;
};

const getFallbackLeadId = (row: any) => {
    const raw = String(row?.external_id || row?.lead_serial_number || row?.event_detail_lead_id || '0');
    const trailingNumber = raw.match(/(\d+)$/)?.[1];
    return Number(trailingNumber || raw) || 0;
};

const getExternalLeadRow = async (leadId: string | number) => {
    const lookup = normalizeLeadLookup(leadId);
    const result = await pool.query(
        `SELECT *
         FROM external_leads
         WHERE external_id::text = $1 OR lead_serial_number = $1
         LIMIT 1`,
        [lookup]
    );
    return result.rows[0] || null;
};

export const getClientDeliveryLeadContextQuery = async (leadId: string | number) => {
    return getExternalLeadRow(leadId);
};

const getStoreLeadRow = async (store: { db: any; hasLeadsDetail: boolean }, row: any) => {
    if (!store.hasLeadsDetail) {
        return {
            sales_lead_id: getFallbackLeadId(row),
            sales_lead_serial_number: row.lead_serial_number || row.external_id,
        };
    }

    const result = await store.db.query(
        `SELECT lead_id AS sales_lead_id, lead_serial_number AS sales_lead_serial_number
         FROM leads_detail
         WHERE lead_serial_number = $1
            OR lead_serial_number = $2
            OR lead_id::text = $1
            OR lead_id::text = $2
         LIMIT 1`,
        [row.external_id, row.lead_serial_number]
    );
    return result.rows[0] || null;
};

const getDeliveryStore = async (row?: any): Promise<DeliveryStore> => {
    const candidates = await deliveryStoreCandidates();

    if (row) {
        for (const candidate of candidates) {
            const matchedLead = await getStoreLeadRow(candidate, row);
            if (matchedLead?.sales_lead_id) {
                return candidate;
            }
        }
    }

    return candidates[0] || { db: pool, hasLeadsDetail: false, name: 'crm' };
};

const normalizeProjectLeadId = (projectId: string) =>
    String(projectId || '').replace(/^CRM-/i, '').trim();

const isVideoProjectType = (type?: string | null) => {
    const normalized = String(type || '').toLowerCase();
    return normalized.includes('video') || normalized.includes('film') || normalized.includes('candid');
};

export const ensureClientDeliveriesQuery = async (db: any = pool, withLeadForeignKey = false) => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS client_deliveries (
            id SERIAL PRIMARY KEY,
            lead_id INTEGER NOT NULL${withLeadForeignKey ? ' REFERENCES leads_detail(lead_id) ON DELETE CASCADE' : ''},
            delivery_type VARCHAR(50) NOT NULL,
            drive_link TEXT,
            video_drive_link TEXT,
            drone_photo_drive_link TEXT,
            drone_video_drive_link TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            notes TEXT,
            query_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

export const getRawDataDeliverySummaryQuery = async (leadId: string | number) => {
    await ensureAssignTeamColumnsQuery();
    const lookup = normalizeLeadLookup(leadId);
    const result = await pool.query(
        `
        SELECT
            el.external_id::text AS external_id,
            el.lead_serial_number,
            el.lead_name,
            el.email,
            el.phone,
            el.location,
            el.event_type,
            TO_CHAR(el.event_date, 'DD/MM/YYYY') AS event_date,
            COALESCE(el.current_phase, 'pre_production') AS current_phase,
            ed.external_lead_id AS event_detail_lead_id,
            ed.drive_link,
            ed.video_drive_link,
            ed.drone_photo_drive_link,
            ed.drone_video_drive_link,
            COALESCE(ed.num_images, 0) AS num_images,
            COALESCE(ed.num_videos, 0) AS num_videos,
            COALESCE(ed.drone_num_images, 0) AS drone_num_images,
            COALESCE(ed.drone_num_videos, 0) AS drone_num_videos,
            COALESCE(ed.media_status, 'Pending') AS media_status,
            ed.photo_hard_disk_delivery_date,
            ed.video_hard_disk_delivery_date,
            ed.drone_hard_disk_delivery_date,
            CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END AS photographer,
            CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END AS videographer,
            CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END AS drone,
            CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_assignment_date ELSE at.event_date END AS assigned_event_date
        FROM external_leads el
        LEFT JOIN event_details ed
            ON ed.external_lead_id = el.external_id::text
            OR ed.external_lead_id = el.lead_serial_number
        LEFT JOIN assign_teams at
            ON at.external_lead_id = el.external_id::text
            OR at.external_lead_id = el.lead_serial_number
        WHERE el.external_id::text = $1
           OR el.lead_serial_number = $1
        ORDER BY ed.updated_at DESC NULLS LAST
        LIMIT 1
        `,
        [lookup]
    );

    const row = result.rows[0];
    if (!row) return null;

    const deliveryStore = await getDeliveryStore(row);
    await ensureClientDeliveriesQuery(deliveryStore.db, deliveryStore.hasLeadsDetail);

    const currentPhase = String(row.current_phase || 'pre_production').toLowerCase();
    const isEventPhase = currentPhase === 'event';
    const deliveryType = isEventPhase ? 'EVENT_RAW_DATA' : 'RAW_DATA';
    let salesRow: any = {};

    if (deliveryStore.hasLeadsDetail) {
        const salesResult = await deliveryStore.db.query(
            `
            SELECT
                ld.lead_id AS sales_lead_id,
                ld.lead_serial_number AS sales_lead_serial_number,
                cd.id AS client_delivery_id,
                cd.delivery_type AS client_delivery_type,
                cd.status AS client_delivery_status,
                cd.created_at AS client_delivery_created_at
            FROM leads_detail ld
            LEFT JOIN LATERAL (
                SELECT *
                FROM client_deliveries cdx
                WHERE cdx.lead_id = ld.lead_id
                  AND cdx.delivery_type IN ('RAW_DATA', 'EVENT_RAW_DATA')
                ORDER BY cdx.created_at DESC
                LIMIT 1
            ) cd ON TRUE
            WHERE ld.lead_serial_number = $1
               OR ld.lead_serial_number = $2
               OR ld.lead_id::text = $1
               OR ld.lead_id::text = $2
            LIMIT 1
            `,
            [row.external_id, row.lead_serial_number]
        );
        salesRow = salesResult.rows[0];
    }

    if (!salesRow || !salesRow.sales_lead_id) {
        const fallbackLeadId = getFallbackLeadId(row);
        const deliveryResult = await deliveryStore.db.query(
            `
            SELECT
                id AS client_delivery_id,
                delivery_type AS client_delivery_type,
                status AS client_delivery_status,
                created_at AS client_delivery_created_at
            FROM client_deliveries
            WHERE lead_id = $1
              AND delivery_type IN ('RAW_DATA', 'EVENT_RAW_DATA')
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [fallbackLeadId]
        );
        salesRow = {
            ...(deliveryResult.rows[0] || {}),
            sales_lead_id: fallbackLeadId,
            sales_lead_serial_number: row.lead_serial_number || row.external_id,
        };
    }

    const totalImages = Number(row.num_images || 0) + (isEventPhase ? Number(row.drone_num_images || 0) : 0);
    const totalVideos = Number(row.num_videos || 0) + (isEventPhase ? Number(row.drone_num_videos || 0) : 0);
    const portalLead = salesRow.sales_lead_serial_number || row.lead_serial_number || row.external_id;

    return {
        ...row,
        ...salesRow,
        lookup_id: lookup,
        display_id: row.lead_serial_number || row.external_id,
        client_name: row.lead_name || 'Unknown Client',
        project_phase: isEventPhase ? 'Event' : 'Pre Production',
        delivery_type: deliveryType,
        delivery_store: deliveryStore.name,
        total_images: totalImages,
        total_videos: totalVideos,
        estimated_size_gb: estimateRawDataSizeGb(row),
        client_portal_url: `https://portal.redangle.com/client/${portalLead}`,
    };
};

export const sendRawDataToClientQuery = async (leadId: string | number, notes?: string) => {
    const summary = await getRawDataDeliverySummaryQuery(leadId);
    if (!summary) return null;
    if (!summary.sales_lead_id) {
        throw new Error('Matching sales/client lead was not found for this raw data record');
    }
    const deliveryStore = summary.delivery_store === 'sales'
        ? { db: salesPool, hasLeadsDetail: true }
        : { db: pool, hasLeadsDetail: false };
    await ensureClientDeliveriesQuery(deliveryStore.db, deliveryStore.hasLeadsDetail);

    const deliveryNotes = notes || (
        summary.delivery_type === 'EVENT_RAW_DATA'
            ? 'Event raw files are ready for client review.'
            : 'Pre-production raw files are ready for client review.'
    );

    const existing = await deliveryStore.db.query(
        `
        SELECT id
        FROM client_deliveries
        WHERE lead_id = $1
          AND delivery_type = $2
          AND status IN ('pending', 'query_raised')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [summary.sales_lead_id, summary.delivery_type]
    );

    if (existing.rows[0]?.id) {
        const updated = await deliveryStore.db.query(
            `
            UPDATE client_deliveries
            SET drive_link = $2,
                video_drive_link = $3,
                drone_photo_drive_link = $4,
                drone_video_drive_link = $5,
                status = 'pending',
                notes = $6,
                created_at = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [
                existing.rows[0].id,
                summary.drive_link || null,
                summary.video_drive_link || null,
                summary.drone_photo_drive_link || null,
                summary.drone_video_drive_link || null,
                deliveryNotes,
            ]
        );
        return updated.rows[0];
    }

    const inserted = await deliveryStore.db.query(
        `
        INSERT INTO client_deliveries (
            lead_id,
            delivery_type,
            drive_link,
            video_drive_link,
            drone_photo_drive_link,
            drone_video_drive_link,
            status,
            notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING *
        `,
        [
            summary.sales_lead_id,
            summary.delivery_type,
            summary.drive_link || null,
            summary.video_drive_link || null,
            summary.drone_photo_drive_link || null,
            summary.drone_video_drive_link || null,
            deliveryNotes,
        ]
    );

    return inserted.rows[0];
};

export const getFinalDeliverySummaryQuery = async (projectId: string) => {
    const leadId = normalizeProjectLeadId(projectId);
    const lead = await getExternalLeadRow(leadId);
    if (!lead) return null;

    const deliveryStore = await getDeliveryStore(lead);
    await ensureClientDeliveriesQuery(deliveryStore.db, deliveryStore.hasLeadsDetail);
    let storeLead = await getStoreLeadRow(deliveryStore, lead);

    const linksResult = await pool.query(
        `SELECT *
         FROM approved_drive_links
         WHERE project_id IN ($1, $2, $3)
         ORDER BY created_at DESC`,
        [projectId, `CRM-${lead.external_id}`, `CRM-${lead.lead_serial_number}`]
    );
    const links = linksResult.rows;
    const photoLink = links.find((link: any) => !isVideoProjectType(link.project_type))?.upload_link || links[0]?.upload_link || null;
    const videoLink = links.find((link: any) => isVideoProjectType(link.project_type))?.upload_link || null;

    let deliveryRow: any = {};
    let salesLeadId = storeLead?.sales_lead_id;

    if (!salesLeadId) {
        salesLeadId = getFallbackLeadId(lead);
        storeLead = {
            sales_lead_id: salesLeadId,
            sales_lead_serial_number: lead.lead_serial_number || lead.external_id,
        };
    }

    if (salesLeadId) {
        const deliveryResult = await deliveryStore.db.query(
            `SELECT id AS client_delivery_id,
                    delivery_type AS client_delivery_type,
                    status AS client_delivery_status,
                    created_at AS client_delivery_created_at
             FROM client_deliveries
             WHERE lead_id = $1 AND delivery_type = 'FINAL_DELIVERABLES'
             ORDER BY created_at DESC
             LIMIT 1`,
            [salesLeadId]
        );
        deliveryRow = deliveryResult.rows[0] || {};
    }

    return {
        ...lead,
        ...storeLead,
        ...deliveryRow,
        project_id: projectId,
        lookup_id: leadId,
        display_id: lead.lead_serial_number || lead.external_id,
        client_name: lead.lead_name || 'Unknown Client',
        project_phase: String(lead.current_phase || 'post_production') === 'pre_production' ? 'Pre Production Editing' : 'Post Production',
        delivery_type: 'FINAL_DELIVERABLES',
        delivery_store: deliveryStore.name,
        drive_link: photoLink,
        video_drive_link: videoLink,
        approved_links: links,
        total_images: 0,
        total_videos: links.filter((link: any) => isVideoProjectType(link.project_type)).length,
        estimated_size_gb: Math.max(1, links.length) * 2.5,
        client_portal_url: `https://portal.redangle.com/client/${storeLead?.sales_lead_serial_number || lead.lead_serial_number || lead.external_id}`,
    };
};

export const sendFinalDeliveryToClientQuery = async (projectId: string, notes?: string) => {
    const summary = await getFinalDeliverySummaryQuery(projectId);
    if (!summary) return null;
    if (!summary.sales_lead_id) {
        throw new Error('Matching sales/client lead was not found for this final delivery');
    }
    if (!summary.drive_link && !summary.video_drive_link) {
        throw new Error('No approved editor links are available to send to the client');
    }

    const deliveryStore = summary.delivery_store === 'sales'
        ? { db: salesPool, hasLeadsDetail: true }
        : { db: pool, hasLeadsDetail: await tableExists(pool, 'leads_detail') };
    await ensureClientDeliveriesQuery(deliveryStore.db, deliveryStore.hasLeadsDetail);

    const deliveryNotes = notes || 'Final deliverables are ready for client review.';
    const existing = await deliveryStore.db.query(
        `SELECT id
         FROM client_deliveries
         WHERE lead_id = $1
           AND delivery_type = 'FINAL_DELIVERABLES'
           AND status IN ('pending', 'query_raised')
         ORDER BY created_at DESC
         LIMIT 1`,
        [summary.sales_lead_id]
    );

    if (existing.rows[0]?.id) {
        const updated = await deliveryStore.db.query(
            `UPDATE client_deliveries
             SET drive_link = $2,
                 video_drive_link = $3,
                 status = 'pending',
                 notes = $4,
                 created_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [existing.rows[0].id, summary.drive_link || null, summary.video_drive_link || null, deliveryNotes]
        );
        return updated.rows[0];
    }

    const inserted = await deliveryStore.db.query(
        `INSERT INTO client_deliveries (
            lead_id, delivery_type, drive_link, video_drive_link, status, notes
         )
         VALUES ($1, 'FINAL_DELIVERABLES', $2, $3, 'pending', $4)
         RETURNING *`,
        [summary.sales_lead_id, summary.drive_link || null, summary.video_drive_link || null, deliveryNotes]
    );
    return inserted.rows[0];
};

export const markClientDeliveryApprovedForLeadQuery = async (
    leadId: string | number,
    deliveryType?: string,
    deliveryId?: string | number
) => {
    const lead = await getExternalLeadRow(leadId);
    if (!lead) return null;

    const deliveryStore = await getDeliveryStore(lead);
    await ensureClientDeliveriesQuery(deliveryStore.db, deliveryStore.hasLeadsDetail);
    const storeLead = await getStoreLeadRow(deliveryStore, lead);
    if (!storeLead?.sales_lead_id) {
        throw new Error('Matching sales/client lead was not found for this delivery approval');
    }

    const normalizedType = String(deliveryType || '').trim();
    const params: any[] = [storeLead.sales_lead_id];
    let where = `lead_id = $1`;

    if (deliveryId) {
        params.push(Number(deliveryId));
        where += ` AND id = $${params.length}`;
    }

    if (normalizedType) {
        params.push(normalizedType);
        where += ` AND delivery_type = $${params.length}`;
    }

    const result = await deliveryStore.db.query(
        `UPDATE client_deliveries
         SET status = 'client_approved'
         WHERE id = (
           SELECT id
           FROM client_deliveries
           WHERE ${where}
             AND delivery_type IN ('RAW_DATA', 'EVENT_RAW_DATA', 'FINAL_DELIVERABLES')
           ORDER BY created_at DESC
           LIMIT 1
         )
         RETURNING *`,
        params
    );

    return {
        lead,
        delivery: result.rows[0] || null,
        storeLead,
    };
};

// CRM Raw Data: all lead-employee assignments with client info (raw file uploads)
export const getCrmRawDataQuery = async () => {
    const result = await pool.query(
        `SELECT
            le.lead_employee_id,
            le.lead_id,
            ld."leadCode" AS lead_code,
            CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS emp,
            e.role,
            CONCAT(ld.first_name, ' ', ld.last_name) AS client,
            CASE WHEN ld.event_date IS NOT NULL THEN TO_CHAR(ld.event_date, 'DD-MM-YYYY') ELSE '—' END AS date,
            le.priority AS status
        FROM lead_employee le
        LEFT JOIN employees e ON le.employee_id = e.employee_id
        LEFT JOIN leads_detail ld ON le.lead_id = ld.lead_id
        ORDER BY le.created_at DESC`
    );
    return result.rows;
};

// CRM Reports: aggregated stats
export const getCrmReportsQuery = async () => {
    // Total revenue from payments
    const revenueResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_revenue FROM payments WHERE status != 'Cancelled'`
    );

    // Active employees
    const activeEmpResult = await pool.query(
        `SELECT COUNT(*) AS active_employees FROM employees`
    );

    // On-leave employees today
    const onLeaveResult = await pool.query(
        `SELECT COUNT(*) AS on_leave FROM employee_leave_requests
         WHERE status = 'Approved' AND from_date <= CURRENT_DATE AND to_date >= CURRENT_DATE`
    );

    // Total projects (leads assigned)
    const projectsResult = await pool.query(
        `SELECT COUNT(DISTINCT lead_id) AS total_projects FROM lead_employee`
    );

    // Monthly revenue for area chart (last 6 months)
    const monthlyRevenueResult = await pool.query(
        `SELECT
            TO_CHAR(payment_date, 'Mon') AS month,
            SUM(amount) AS revenue
        FROM payments
        WHERE payment_date >= CURRENT_DATE - INTERVAL '6 months' AND status != 'Cancelled'
        GROUP BY DATE_TRUNC('month', payment_date), TO_CHAR(payment_date, 'Mon')
        ORDER BY DATE_TRUNC('month', payment_date) ASC`
    );

    // Monthly lead conversion (last 6 months)
    const conversionResult = await pool.query(
        `SELECT
            TO_CHAR(created_time, 'Mon') AS month,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'Converted' OR status = 'Won') AS converted
        FROM leads_detail
        WHERE created_time >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_time), TO_CHAR(created_time, 'Mon')
        ORDER BY DATE_TRUNC('month', created_time) ASC`
    );

    // Employee performance (tasks per employee, top 5)
    const performanceResult = await pool.query(
        `SELECT
            CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
            COUNT(*) AS value
        FROM lead_employee le
        LEFT JOIN employees e ON le.employee_id = e.employee_id
        GROUP BY e.first_name, e.last_name
        ORDER BY value DESC
        LIMIT 5`
    );

    // Project distribution by event type
    const distributionResult = await pool.query(
        `SELECT
            COALESCE(ld.event_type, 'Others') AS name,
            COUNT(*) AS value
        FROM lead_employee le
        LEFT JOIN leads_detail ld ON le.lead_id = ld.lead_id
        GROUP BY ld.event_type
        ORDER BY value DESC`
    );

    return {
        stats: {
            totalRevenue: parseFloat(revenueResult.rows[0].total_revenue) || 0,
            activeEmployees: parseInt(activeEmpResult.rows[0].active_employees) || 0,
            onLeave: parseInt(onLeaveResult.rows[0].on_leave) || 0,
            totalProjects: parseInt(projectsResult.rows[0].total_projects) || 0,
        },
        monthlyRevenue: monthlyRevenueResult.rows,
        conversion: conversionResult.rows,
        performance: performanceResult.rows,
        distribution: distributionResult.rows,
    };
};
