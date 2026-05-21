import { Request, Response } from "express";
import { pool } from "../config/db";
import { reconcileLeadPhasesService } from "../services/phaseTracking.service";
import { ensureAssignTeamColumnsQuery } from "../queries/assignTeam.query";

export const getDashboardLeads = async (
  req: Request,
  res: Response
) => {
  try {
    await reconcileLeadPhasesService();
    await ensureAssignTeamColumnsQuery();

    const result = await pool.query(`
      SELECT
        e.external_id AS id,
        e.lead_serial_number AS "serialNumber",
        e.lead_name AS "leadName",
        e.email,
        e.phone,
        e.location,
        e.event_type AS "eventType",
        e.flow_type AS "flowType",
        e.current_phase AS "currentPhase",
        e.phase_status AS "phaseStatus",
        e.phase_owner AS "phaseOwner",
        e.pre_production_step AS "preProductionStep",
        e.status,
        e.created_at AS "createdAt",
        COALESCE(ed.preferred_date, e.event_date) AS "eventDate",
        CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END AS photographer,
        CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END AS videographer,
        CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END AS drone,
        CASE
          WHEN at.external_lead_id IS NOT NULL AND (
            (CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END) IS NOT NULL
            OR (CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END) IS NOT NULL
            OR (CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END) IS NOT NULL
          ) THEN COALESCE(
            NULLIF(
              CONCAT_WS(
                ', ',
                CASE WHEN (CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END) IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END) END,
                CASE WHEN (CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END) IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', v.first_name, v.last_name)), ''), CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END) END,
                CASE WHEN (CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END) IS NOT NULL THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.first_name, d.last_name)), ''), CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END) END
              ),
              ''
            ),
            'Team Assigned'
          )
          ELSE 'Unassigned'
        END AS "assignedTo"
      FROM (
        SELECT DISTINCT ON (COALESCE(lead_serial_number, external_id::text)) *
        FROM external_leads
        ORDER BY COALESCE(lead_serial_number, external_id::text), created_at DESC, id DESC
      ) e
      LEFT JOIN event_details ed
        ON ed.external_lead_id = e.external_id::text
        OR ed.external_lead_id = e.lead_serial_number
      LEFT JOIN assign_teams at
        ON at.external_lead_id = e.external_id::text
        OR at.external_lead_id = e.lead_serial_number
      LEFT JOIN employees p
        ON p.employee_id = CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END
      LEFT JOIN employees v
        ON v.employee_id = CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END
      LEFT JOIN employees d
        ON d.employee_id = CASE WHEN COALESCE(e.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END
      ORDER BY e.created_at DESC, e.id DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard leads",
    });
  }
};

export const getAdminDashboardStats = async (
  req: Request,
  res: Response
) => {
  try {
    // Run all stats queries in parallel
    const [totalResult, pendingResult, completedResult, revenueResult, recentResult] =
      await Promise.all([
        pool.query(`SELECT COUNT(*) AS count FROM external_leads`),
        pool.query(`SELECT COUNT(*) AS count FROM external_leads WHERE status NOT IN ('completed', 'cancelled')`),
        pool.query(`SELECT COUNT(*) AS count FROM external_leads WHERE status = 'completed'`),
        pool.query(`SELECT COALESCE(SUM(invoice_paid), 0) AS total FROM external_leads`),
        pool.query(`
          SELECT external_id, lead_name, status, created_at
          FROM external_leads
          ORDER BY created_at DESC, id DESC
          LIMIT 5
        `),
      ]);

    const totalClients = parseInt(totalResult.rows[0].count, 10);
    const pendingClients = parseInt(pendingResult.rows[0].count, 10);
    const completedClients = parseInt(completedResult.rows[0].count, 10);
    const totalRevenue = parseFloat(revenueResult.rows[0].total);

    res.json({
      success: true,
      data: {
        totalClients,
        pendingClients,
        completedClients,
        totalRevenue,
        recentActivity: recentResult.rows,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard stats",
    });
  }
};
