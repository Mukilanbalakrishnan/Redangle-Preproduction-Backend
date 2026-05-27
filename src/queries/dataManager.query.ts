import { pool } from "../config/db";
import { ensureEventUploadColumnsQuery } from "./eventDetails.query";
import { ensureAssignTeamColumnsQuery } from "./assignTeam.query";

export const getIncomingDataQuery = async () => {
  await ensureEventUploadColumnsQuery();
  await ensureAssignTeamColumnsQuery();
  // Ensure client_deliveries table exists so the query doesn't fail
  await pool.query(`
      CREATE TABLE IF NOT EXISTS client_deliveries (
          id SERIAL PRIMARY KEY,
          lead_id INTEGER NOT NULL,
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

  // Fetch events where at least one media upload exists
  const query = `
      SELECT
        ed.external_lead_id as id,
        ed.client_name as client,
        ed.event_type as title,
        ed.drive_link,
        ed.video_drive_link,
        ed.camera_used,
        ed.video_camera_used,
        ed.num_images,
        ed.num_videos,
        ed.upload_notes,
        ed.video_upload_notes,
        ed.photo_delivery_method,
        ed.photo_upload_phase,
        TO_CHAR(ed.photo_hard_disk_delivery_date, 'YYYY-MM-DD') AS photo_hard_disk_delivery_date,
        COALESCE(ed.photo_hard_disk_received, FALSE) AS photo_hard_disk_received,
        ed.video_delivery_method,
        ed.video_upload_phase,
        TO_CHAR(ed.video_hard_disk_delivery_date, 'YYYY-MM-DD') AS video_hard_disk_delivery_date,
        COALESCE(ed.video_hard_disk_received, FALSE) AS video_hard_disk_received,
        ed.save_the_date_drive_link,
        ed.save_the_date_upload_notes,
        ed.save_the_date_submission_status,
        ed.save_the_video_drive_link,
        ed.save_the_video_upload_notes,
        ed.save_the_video_submission_status,
        ed.retouch_drive_link,
        ed.retouch_upload_notes,
        ed.retouch_submission_status,
        ed.drone_photo_drive_link,
        ed.drone_video_drive_link,
        ed.drone_camera_used,
        ed.drone_video_camera_used,
        ed.drone_num_images,
        ed.drone_num_videos,
        ed.drone_upload_notes,
        ed.drone_video_upload_notes,
        ed.drone_delivery_method,
        ed.drone_upload_phase,
        TO_CHAR(ed.drone_hard_disk_delivery_date, 'YYYY-MM-DD') AS drone_hard_disk_delivery_date,
        COALESCE(ed.drone_hard_disk_received, FALSE) AS drone_hard_disk_received,
        COALESCE(ed.photo_approved, FALSE) AS photo_approved,
        COALESCE(ed.video_approved, FALSE) AS video_approved,
        ed.verification_draft,
        COALESCE(ed.media_status, 'Pending') as status,
        ed.priority_level,
        CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END AS photographer,
        CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END AS videographer,
        CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END AS drone,
        (SELECT CONCAT(first_name, ' ', last_name) FROM employees WHERE employee_id = CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_photographer ELSE at.photographer END) AS photographer_name,
        (SELECT CONCAT(first_name, ' ', last_name) FROM employees WHERE employee_id = CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_videographer ELSE at.videographer END) AS videographer_name,
        (SELECT CONCAT(first_name, ' ', last_name) FROM employees WHERE employee_id = CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_drone ELSE at.drone END) AS drone_name,
        CASE WHEN COALESCE(el.current_phase, '') = 'event' THEN at.event_assignment_date ELSE at.event_date END AS date,
        at.additional_staff,
        at.event_additional_staff,
        at.file_path,
        el.current_phase,
        COALESCE(el.pre_production_step, 'shoot') AS pre_production_step,
        el.phone,
        el.email,
        el.location,
        el.lead_serial_number,
        (
          SELECT status FROM client_deliveries cdx
          WHERE (
              cdx.lead_id::text = el.external_id::text 
              OR cdx.lead_id::text = el.lead_serial_number 
              OR cdx.lead_id::text = ed.external_lead_id
              OR cdx.lead_id = COALESCE(
                  CAST(NULLIF(SUBSTRING(el.lead_serial_number FROM '\\d+$'), '') AS INTEGER),
                  CAST(NULLIF(SUBSTRING(el.external_id::text FROM '\\d+$'), '') AS INTEGER),
                  CAST(NULLIF(SUBSTRING(ed.external_lead_id FROM '\\d+$'), '') AS INTEGER),
                  CASE WHEN el.external_id::text ~ '^\\d+$' THEN CAST(el.external_id::text AS INTEGER) ELSE NULL END,
                  CASE WHEN ed.external_lead_id ~ '^\\d+$' THEN CAST(ed.external_lead_id AS INTEGER) ELSE NULL END,
                  0
              )
          )
          AND cdx.delivery_type IN ('RAW_DATA', 'EVENT_RAW_DATA')
          ORDER BY cdx.created_at DESC
          LIMIT 1
        ) AS client_delivery_status
      FROM event_details ed
      LEFT JOIN external_leads el
        ON ed.external_lead_id = el.external_id::text
        OR ed.external_lead_id = el.lead_serial_number
      LEFT JOIN assign_teams at
        ON ed.external_lead_id = at.external_lead_id
        OR at.external_lead_id = el.external_id::text
        OR at.external_lead_id = el.lead_serial_number
      WHERE (
            (ed.drive_link IS NOT NULL AND ed.drive_link != '')
         OR (ed.video_drive_link IS NOT NULL AND ed.video_drive_link != '')
         OR (ed.drone_photo_drive_link IS NOT NULL AND ed.drone_photo_drive_link != '')
         OR (ed.drone_video_drive_link IS NOT NULL AND ed.drone_video_drive_link != '')
         OR (ed.photo_hard_disk_delivery_date IS NOT NULL AND ed.photo_upload_phase = COALESCE(el.current_phase, ''))
         OR (ed.video_hard_disk_delivery_date IS NOT NULL AND ed.video_upload_phase = COALESCE(el.current_phase, ''))
         OR (ed.drone_hard_disk_delivery_date IS NOT NULL AND ed.drone_upload_phase = COALESCE(el.current_phase, ''))
         OR (ed.save_the_date_drive_link IS NOT NULL AND ed.save_the_date_drive_link != '')
         OR (ed.save_the_video_drive_link IS NOT NULL AND ed.save_the_video_drive_link != '')
         OR (ed.retouch_drive_link IS NOT NULL AND ed.retouch_drive_link != '')
      )
        AND COALESCE(ed.media_status, 'Pending') NOT IN ('harddisk_closed')
      ORDER BY ed.updated_at DESC
    `;
  const result = await pool.query(query);
  return result.rows;
};

export const updateMediaStatusQuery = async (leadId: number | string, status: string) => {
  const query = `
      UPDATE event_details 
      SET media_status = $2, updated_at = NOW()
      WHERE external_lead_id = $1
      RETURNING *;
    `;
  const result = await pool.query(query, [leadId, status]);
  return result.rows[0];
};

export const saveVerificationDraftQuery = async (leadId: number | string, draft: any) => {
  const query = `
      UPDATE event_details 
      SET verification_draft = $2, updated_at = NOW()
      WHERE external_lead_id = $1
      RETURNING *;
    `;
  const result = await pool.query(query, [leadId, JSON.stringify(draft)]);
  return result.rows[0];
};

export const updatePartialApprovalQuery = async (leadId: number | string, role: string) => {
  let column = '';
  if (role === 'photographer') column = 'photo_approved';
  else if (role === 'videographer') column = 'video_approved';
  else if (role === 'drone') column = 'drone_approved';
  else throw new Error('Invalid role for partial approval');

  const query = `
      UPDATE event_details 
      SET ${column} = TRUE, updated_at = NOW()
      WHERE external_lead_id = $1
      RETURNING *;
    `;
  const result = await pool.query(query, [leadId]);
  return result.rows[0];
};

export const updateReuploadRemarksQuery = async (leadId: number | string, role: string, remarks: string) => {
  let column = '';
  if (role === 'photographer') column = 'photo_reupload_remarks';
  else if (role === 'videographer') column = 'video_reupload_remarks';
  else if (role === 'drone') column = 'drone_reupload_remarks';
  else throw new Error('Invalid role for reupload remarks');

  const query = `
      UPDATE event_details 
      SET ${column} = $2, media_status = 'Reupload_Requested', updated_at = NOW()
      WHERE external_lead_id = $1
      RETURNING *;
  `;
  const result = await pool.query(query, [leadId, remarks]);
  return result.rows[0];
};

export const createHardDiskClosureTableQuery = async () => {
  const query = `
      CREATE TABLE IF NOT EXISTS hard_disk_closures (
        id SERIAL PRIMARY KEY,
        external_lead_id VARCHAR(100) UNIQUE,
        handover_disk_number VARCHAR(100),
        handover_disk_label VARCHAR(100),
        handover_date DATE,
        handover_person VARCHAR(100),
        handover_notes TEXT,
        receive_disk_number VARCHAR(100),
        receive_disk_label VARCHAR(100),
        receive_date DATE,
        receive_person VARCHAR(100),
        receive_notes TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  await pool.query(query);
  await pool.query(`
    ALTER TABLE hard_disk_closures
    ALTER COLUMN external_lead_id TYPE VARCHAR(100)
    USING external_lead_id::text;
  `);
};

export const upsertHardDiskClosureQuery = async (leadId: number | string, data: any) => {
  await createHardDiskClosureTableQuery();
  const query = `
      INSERT INTO hard_disk_closures (
        external_lead_id, handover_disk_number, handover_disk_label, handover_date, handover_person, handover_notes,
        receive_disk_number, receive_disk_label, receive_date, receive_person, receive_notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (external_lead_id) DO UPDATE SET
        handover_disk_number = EXCLUDED.handover_disk_number,
        handover_disk_label = EXCLUDED.handover_disk_label,
        handover_date = EXCLUDED.handover_date,
        handover_person = EXCLUDED.handover_person,
        handover_notes = EXCLUDED.handover_notes,
        receive_disk_number = EXCLUDED.receive_disk_number,
        receive_disk_label = EXCLUDED.receive_disk_label,
        receive_date = EXCLUDED.receive_date,
        receive_person = EXCLUDED.receive_person,
        receive_notes = EXCLUDED.receive_notes,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
  const values = [
    leadId,
    data.handover_disk_number || null,
    data.handover_disk_label || null,
    data.handover_date || null,
    data.handover_person || null,
    data.handover_notes || null,
    data.receive_disk_number || null,
    data.receive_disk_label || null,
    data.receive_date || null,
    data.receive_person || null,
    data.receive_notes || null,
    data.status || 'Pending'
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const getHardDiskClosureQuery = async (leadId: number | string) => {
  await createHardDiskClosureTableQuery();
  const query = `SELECT * FROM hard_disk_closures WHERE external_lead_id = $1`;
  const result = await pool.query(query, [leadId]);
  return result.rows[0];
};

export const getHardDiskStatsQuery = async () => {
  await createHardDiskClosureTableQuery();
  const query = `
      SELECT 
        COUNT(handover_disk_number) as handover_count,
        COUNT(receive_disk_number) as receive_count,
        COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closure_count
      FROM hard_disk_closures;
    `;
  const result = await pool.query(query);
  return {
    handover_count: parseInt(result.rows[0].handover_count || '0', 10),
    receive_count: parseInt(result.rows[0].receive_count || '0', 10),
    closure_count: parseInt(result.rows[0].closure_count || '0', 10)
  };
};

export const updateIncomingDataQuery = async (leadId: number | string, data: any) => {
  await ensureEventUploadColumnsQuery();
  const query = `
    UPDATE event_details
    SET drive_link = COALESCE($2, drive_link),
        video_drive_link = COALESCE($3, video_drive_link),
        camera_used = COALESCE($4, camera_used),
        video_camera_used = COALESCE($5, video_camera_used),
        num_images = COALESCE($6, num_images),
        num_videos = COALESCE($7, num_videos),
        upload_notes = COALESCE($8, upload_notes),
        video_upload_notes = COALESCE($9, video_upload_notes),
        drone_photo_drive_link = COALESCE($10, drone_photo_drive_link),
        drone_video_drive_link = COALESCE($11, drone_video_drive_link),
        drone_camera_used = COALESCE($12, drone_camera_used),
        drone_video_camera_used = COALESCE($13, drone_video_camera_used),
        drone_num_images = COALESCE($14, drone_num_images),
        drone_num_videos = COALESCE($15, drone_num_videos),
        drone_upload_notes = COALESCE($16, drone_upload_notes),
        drone_video_upload_notes = COALESCE($17, drone_video_upload_notes),
        updated_at = NOW()
    WHERE external_lead_id = $1
    RETURNING *;
  `;
  const result = await pool.query(query, [
    leadId,
    data.drive_link,
    data.video_drive_link,
    data.camera_used,
    data.video_camera_used,
    data.num_images,
    data.num_videos,
    data.upload_notes,
    data.video_upload_notes,
    data.drone_photo_drive_link,
    data.drone_video_drive_link,
    data.drone_camera_used,
    data.drone_video_camera_used,
    data.drone_num_images,
    data.drone_num_videos,
    data.drone_upload_notes,
    data.drone_video_upload_notes
  ]);
  return result.rows[0];
};

export const deleteIncomingDataQuery = async (leadId: number | string) => {
  await ensureEventUploadColumnsQuery();
  const query = `
    UPDATE event_details
    SET drive_link = NULL,
        video_drive_link = NULL,
        camera_used = NULL,
        video_camera_used = NULL,
        num_images = NULL,
        num_videos = NULL,
        upload_notes = NULL,
        video_upload_notes = NULL,
        drone_photo_drive_link = NULL,
        drone_video_drive_link = NULL,
        drone_camera_used = NULL,
        drone_video_camera_used = NULL,
        drone_num_images = NULL,
        drone_num_videos = NULL,
        drone_upload_notes = NULL,
        drone_video_upload_notes = NULL,
        photo_delivery_method = NULL,
        photo_hard_disk_delivery_date = NULL,
        photo_hard_disk_received = FALSE,
        photo_upload_phase = NULL,
        video_delivery_method = NULL,
        video_hard_disk_delivery_date = NULL,
        video_hard_disk_received = FALSE,
        video_upload_phase = NULL,
        drone_delivery_method = NULL,
        drone_hard_disk_delivery_date = NULL,
        drone_hard_disk_received = FALSE,
        drone_upload_phase = NULL,
        updated_at = NOW()
    WHERE external_lead_id = $1
    RETURNING *;
  `;
  const result = await pool.query(query, [leadId]);
  return result.rows[0];
};

export const markHardDiskReceivedQuery = async (leadId: number | string) => {
  await ensureEventUploadColumnsQuery();
  const query = `
    UPDATE event_details
    SET photo_hard_disk_received = CASE
          WHEN photo_delivery_method = 'hard_disk' AND photo_hard_disk_delivery_date IS NOT NULL THEN TRUE
          ELSE photo_hard_disk_received
        END,
        video_hard_disk_received = CASE
          WHEN video_delivery_method = 'hard_disk' AND video_hard_disk_delivery_date IS NOT NULL THEN TRUE
          ELSE video_hard_disk_received
        END,
        drone_hard_disk_received = CASE
          WHEN drone_delivery_method = 'hard_disk' AND drone_hard_disk_delivery_date IS NOT NULL THEN TRUE
          ELSE drone_hard_disk_received
        END,
        updated_at = NOW()
    WHERE external_lead_id = $1
    RETURNING *;
  `;
  const result = await pool.query(query, [leadId]);
  return result.rows[0];
};
