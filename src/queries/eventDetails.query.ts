import {pool} from "../config/db";
import { CreateEventDetailsDTO, EventDetails } 
  from "../types/eventDetails.types";

export const ensureEventUploadColumnsQuery = async () => {
  await pool.query(`
    ALTER TABLE event_details
    ADD COLUMN IF NOT EXISTS drone_photo_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS drone_video_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS drone_camera_used TEXT,
    ADD COLUMN IF NOT EXISTS drone_video_camera_used TEXT,
    ADD COLUMN IF NOT EXISTS drone_num_images INTEGER,
    ADD COLUMN IF NOT EXISTS drone_num_videos INTEGER,
    ADD COLUMN IF NOT EXISTS drone_upload_notes TEXT,
    ADD COLUMN IF NOT EXISTS drone_video_upload_notes TEXT,
    ADD COLUMN IF NOT EXISTS save_the_date_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS save_the_date_upload_notes TEXT,
    ADD COLUMN IF NOT EXISTS save_the_date_submission_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS save_the_date_reupload_remarks TEXT,
    ADD COLUMN IF NOT EXISTS save_the_video_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS save_the_video_upload_notes TEXT,
    ADD COLUMN IF NOT EXISTS save_the_video_submission_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS save_the_video_reupload_remarks TEXT,
    ADD COLUMN IF NOT EXISTS retouch_drive_link TEXT,
    ADD COLUMN IF NOT EXISTS retouch_upload_notes TEXT,
    ADD COLUMN IF NOT EXISTS retouch_submission_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS retouch_reupload_remarks TEXT,
    ADD COLUMN IF NOT EXISTS photo_delivery_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS photo_hard_disk_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS photo_hard_disk_received BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS photo_upload_phase VARCHAR(30),
    ADD COLUMN IF NOT EXISTS video_delivery_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS video_hard_disk_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS video_hard_disk_received BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS video_upload_phase VARCHAR(30),
    ADD COLUMN IF NOT EXISTS drone_delivery_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS drone_hard_disk_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS drone_hard_disk_received BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS drone_upload_phase VARCHAR(30),
    ADD COLUMN IF NOT EXISTS media_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS event_started_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS event_paused_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS event_ended_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS event_started_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS photo_reupload_remarks TEXT,
    ADD COLUMN IF NOT EXISTS video_reupload_remarks TEXT,
    ADD COLUMN IF NOT EXISTS drone_reupload_remarks TEXT
  `);
};

const normalizeUploaderRole = (role: string) =>
  role.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export const createEventDetailsQuery = async (
  data: CreateEventDetailsDTO
): Promise<EventDetails> => {

  const query = `
INSERT INTO event_details (
  external_lead_id,
  client_name,
  email,
  phone,
  contact_person_name,
  contact_person_number,
  event_type,
  event_location,
  preferred_date,
  preferred_time,
  budget_range,
  services,
  deliverables,
  invoice_attached,
  meeting_type,
  meeting_details,
  client_requirements,
  priority_level
)
VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
)

ON CONFLICT (external_lead_id)
DO UPDATE SET
  client_name = EXCLUDED.client_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  contact_person_name = EXCLUDED.contact_person_name,
  contact_person_number = EXCLUDED.contact_person_number,
  event_type = EXCLUDED.event_type,
  event_location = EXCLUDED.event_location,
  preferred_date = EXCLUDED.preferred_date,
  preferred_time = EXCLUDED.preferred_time,
  budget_range = EXCLUDED.budget_range,
  services = EXCLUDED.services,
  deliverables = EXCLUDED.deliverables,
  invoice_attached = EXCLUDED.invoice_attached,
  meeting_type = EXCLUDED.meeting_type,
  meeting_details = EXCLUDED.meeting_details,
  client_requirements = EXCLUDED.client_requirements,
  priority_level = EXCLUDED.priority_level

RETURNING *;
`;

  const values = [
  data.external_lead_id,
  data.client_name,
  data.email,
  data.phone,
  data.contact_person_name,
  data.contact_person_number,
  data.event_type,
  data.event_location,
  data.preferred_date,
  data.preferred_time,
  data.budget_range,
  data.services,
  data.deliverables,
  data.invoice_attached,
  data.meeting_type,
  data.meeting_details,
  data.client_requirements,
  data.priority_level
];

  const result = await pool.query<EventDetails>(query, values);

  return result.rows[0];
};

export const getEventDetailsByLeadIdQuery = async (leadId: string): Promise<EventDetails | null> => {
  await ensureEventUploadColumnsQuery();
  const result = await pool.query<EventDetails>(
    `SELECT *,
      TO_CHAR(photo_hard_disk_delivery_date, 'YYYY-MM-DD') AS photo_hard_disk_delivery_date,
      TO_CHAR(video_hard_disk_delivery_date, 'YYYY-MM-DD') AS video_hard_disk_delivery_date,
      TO_CHAR(drone_hard_disk_delivery_date, 'YYYY-MM-DD') AS drone_hard_disk_delivery_date,
      el.current_phase
     FROM event_details ed
     LEFT JOIN external_leads el
       ON ed.external_lead_id = el.external_id::text
       OR ed.external_lead_id = el.lead_serial_number
     WHERE ed.external_lead_id = $1`,
    [leadId]
  );
  return result.rows[0] || null;
};

export const updateUploadDetailsQuery = async (
  leadId: string,
  driveLink: string,
  videoDriveLink: string,
  cameraUsed: string,
  videoCameraUsed: string,
  numImages: number,
  numVideos: number,
  uploadNotes: string,
  videoUploadNotes: string,
  uploaderRole: string,
  deliveryMethod: string = 'drive_link',
  hardDiskDeliveryDate: string = '',
  uploadPhase: string = ''
) => {
  await ensureEventUploadColumnsQuery();

  const normalizedUploaderRole = normalizeUploaderRole(uploaderRole);
  const normalizedDeliveryMethod = deliveryMethod === 'hard_disk' ? 'hard_disk' : 'drive_link';
  const hardDiskDate = normalizedDeliveryMethod === 'hard_disk' && hardDiskDeliveryDate ? hardDiskDeliveryDate : null;
  const isDroneUpload = normalizedUploaderRole === 'drone';
  const isSaveTheDateUpload = normalizedUploaderRole === 'save the date';
  const isSaveTheVideoUpload = normalizedUploaderRole === 'save the video';
  const isRetouchUpload = normalizedUploaderRole === 'retouch';
  const query = `
    UPDATE event_details
    SET
      drive_link = CASE
        WHEN $11::boolean OR $12::boolean OR $13::boolean OR $14::boolean THEN drive_link
        WHEN $9 = 'photographer' AND $15 = 'hard_disk' THEN NULL
        WHEN $2::text <> '' THEN $2
        ELSE drive_link
      END,
      video_drive_link = CASE
        WHEN $11::boolean OR $12::boolean OR $13::boolean OR $14::boolean THEN video_drive_link
        WHEN $9 = 'videographer' AND $15 = 'hard_disk' THEN NULL
        WHEN $3::text <> '' THEN $3
        ELSE video_drive_link
      END,
      camera_used = CASE
        WHEN $11::boolean OR $12::boolean OR $13::boolean OR $14::boolean THEN camera_used
        WHEN $4::text <> '' THEN $4
        ELSE camera_used
      END,
      video_camera_used = CASE
        WHEN $11::boolean OR $12::boolean OR $13::boolean OR $14::boolean THEN video_camera_used
        WHEN $5::text <> '' THEN $5
        ELSE video_camera_used
      END,
      num_images = CASE
        WHEN $11::boolean OR $12::boolean OR $13::boolean OR $14::boolean THEN num_images
        WHEN $9 IN ('photographer', 'drone', 'multi-role') THEN $6
        ELSE num_images
      END,
      num_videos = CASE
        WHEN $11::boolean OR $12::boolean OR $13::boolean OR $14::boolean THEN num_videos
        WHEN $9 IN ('videographer', 'drone', 'multi-role') THEN $7
        ELSE num_videos
      END,
      upload_notes = CASE
        WHEN $11::boolean OR $12::boolean OR $13::boolean OR $14::boolean THEN upload_notes
        WHEN $8::text <> '' THEN $8
        ELSE upload_notes
      END,
      video_upload_notes = CASE
        WHEN $11::boolean OR $12::boolean OR $13::boolean OR $14::boolean THEN video_upload_notes
        WHEN $10::text <> '' THEN $10
        ELSE video_upload_notes
      END,
      drone_photo_drive_link = CASE
        WHEN $11::boolean AND $15 = 'hard_disk' THEN NULL
        WHEN $11::boolean AND $2::text <> '' THEN $2
        ELSE drone_photo_drive_link
      END,
      drone_video_drive_link = CASE
        WHEN $11::boolean AND $15 = 'hard_disk' THEN NULL
        WHEN $11::boolean AND $3::text <> '' THEN $3
        ELSE drone_video_drive_link
      END,
      drone_camera_used = CASE
        WHEN $11::boolean AND $4::text <> '' THEN $4
        ELSE drone_camera_used
      END,
      drone_video_camera_used = CASE
        WHEN $11::boolean AND $5::text <> '' THEN $5
        ELSE drone_video_camera_used
      END,
      drone_num_images = CASE
        WHEN $11::boolean THEN $6
        ELSE drone_num_images
      END,
      drone_num_videos = CASE
        WHEN $11::boolean THEN $7
        ELSE drone_num_videos
      END,
      drone_upload_notes = CASE
        WHEN $11::boolean AND $8::text <> '' THEN $8
        ELSE drone_upload_notes
      END,
      drone_video_upload_notes = CASE
        WHEN $11::boolean AND $10::text <> '' THEN $10
        ELSE drone_video_upload_notes
      END,
      save_the_date_drive_link = CASE
        WHEN $12::boolean AND $2::text <> '' THEN $2
        ELSE save_the_date_drive_link
      END,
      photo_reupload_remarks = CASE
        WHEN $9 = 'photographer' THEN NULL
        ELSE photo_reupload_remarks
      END,
      video_reupload_remarks = CASE
        WHEN $9 = 'videographer' THEN NULL
        ELSE video_reupload_remarks
      END,
      drone_reupload_remarks = CASE
        WHEN $11::boolean THEN NULL
        ELSE drone_reupload_remarks
      END,
      save_the_date_upload_notes = CASE
        WHEN $12::boolean AND $8::text <> '' THEN $8
        ELSE save_the_date_upload_notes
      END,
      save_the_date_submission_status = CASE
        WHEN $12::boolean AND $2::text <> '' THEN 'Submitted'
        ELSE save_the_date_submission_status
      END,
      save_the_date_reupload_remarks = CASE
        WHEN $12::boolean AND $2::text <> '' THEN NULL
        ELSE save_the_date_reupload_remarks
      END,
      save_the_video_drive_link = CASE
        WHEN $13::boolean AND COALESCE(NULLIF($3::text, ''), NULLIF($2::text, '')) IS NOT NULL
          THEN COALESCE(NULLIF($3::text, ''), NULLIF($2::text, ''))
        ELSE save_the_video_drive_link
      END,
      save_the_video_upload_notes = CASE
        WHEN $13::boolean AND COALESCE(NULLIF($10::text, ''), NULLIF($8::text, '')) IS NOT NULL
          THEN COALESCE(NULLIF($10::text, ''), NULLIF($8::text, ''))
        ELSE save_the_video_upload_notes
      END,
      save_the_video_submission_status = CASE
        WHEN $13::boolean AND COALESCE(NULLIF($3::text, ''), NULLIF($2::text, '')) IS NOT NULL THEN 'Submitted'
        ELSE save_the_video_submission_status
      END,
      save_the_video_reupload_remarks = CASE
        WHEN $13::boolean AND COALESCE(NULLIF($3::text, ''), NULLIF($2::text, '')) IS NOT NULL THEN NULL
        ELSE save_the_video_reupload_remarks
      END,
      retouch_drive_link = CASE
        WHEN $14::boolean AND $2::text <> '' THEN $2
        ELSE retouch_drive_link
      END,
      retouch_upload_notes = CASE
        WHEN $14::boolean AND $8::text <> '' THEN $8
        ELSE retouch_upload_notes
      END,
      retouch_submission_status = CASE
        WHEN $14::boolean AND $2::text <> '' THEN 'Submitted'
        ELSE retouch_submission_status
      END,
      retouch_reupload_remarks = CASE
        WHEN $14::boolean AND $2::text <> '' THEN NULL
        ELSE retouch_reupload_remarks
      END,
      photo_delivery_method = CASE
        WHEN $9 = 'photographer' THEN $15
        ELSE photo_delivery_method
      END,
      photo_upload_phase = CASE
        WHEN $9 = 'photographer' THEN NULLIF($17::text, '')
        ELSE photo_upload_phase
      END,
      photo_hard_disk_delivery_date = CASE
        WHEN $9 = 'photographer' AND $15 = 'hard_disk' THEN $16::date
        WHEN $9 = 'photographer' AND $15 = 'drive_link' THEN NULL
        ELSE photo_hard_disk_delivery_date
      END,
      photo_hard_disk_received = CASE
        WHEN $9 = 'photographer' THEN FALSE
        ELSE photo_hard_disk_received
      END,
      video_delivery_method = CASE
        WHEN $9 = 'videographer' THEN $15
        ELSE video_delivery_method
      END,
      video_upload_phase = CASE
        WHEN $9 = 'videographer' THEN NULLIF($17::text, '')
        ELSE video_upload_phase
      END,
      video_hard_disk_delivery_date = CASE
        WHEN $9 = 'videographer' AND $15 = 'hard_disk' THEN $16::date
        WHEN $9 = 'videographer' AND $15 = 'drive_link' THEN NULL
        ELSE video_hard_disk_delivery_date
      END,
      video_hard_disk_received = CASE
        WHEN $9 = 'videographer' THEN FALSE
        ELSE video_hard_disk_received
      END,
      drone_delivery_method = CASE
        WHEN $11::boolean THEN $15
        ELSE drone_delivery_method
      END,
      drone_upload_phase = CASE
        WHEN $11::boolean THEN NULLIF($17::text, '')
        ELSE drone_upload_phase
      END,
      drone_hard_disk_delivery_date = CASE
        WHEN $11::boolean AND $15 = 'hard_disk' THEN $16::date
        WHEN $11::boolean AND $15 = 'drive_link' THEN NULL
        ELSE drone_hard_disk_delivery_date
      END,
      drone_hard_disk_received = CASE
        WHEN $11::boolean THEN FALSE
        ELSE drone_hard_disk_received
      END,
      media_status = CASE
        WHEN NOT ($12::boolean OR $13::boolean OR $14::boolean)
          AND (
            COALESCE(NULLIF($2::text, ''), NULLIF($3::text, '')) IS NOT NULL
            OR ($15 = 'hard_disk' AND $16::date IS NOT NULL)
          )
          THEN 'Pending'
        ELSE media_status
      END,
      updated_at = NOW()
    WHERE external_lead_id = $1
    RETURNING *;
  `;

  const values = [
    leadId,
    driveLink,
    videoDriveLink,
    cameraUsed,
    videoCameraUsed,
    numImages,
    numVideos,
    uploadNotes,
    normalizedUploaderRole,
    videoUploadNotes,
    isDroneUpload,
    isSaveTheDateUpload,
    isSaveTheVideoUpload,
    isRetouchUpload,
    normalizedDeliveryMethod,
    hardDiskDate,
    uploadPhase
  ];

  const result = await pool.query(query, values);

  if (isSaveTheDateUpload || isSaveTheVideoUpload || isRetouchUpload) {
    const projectType = isSaveTheDateUpload ? 'Save the Date'
      : isSaveTheVideoUpload ? 'Save the Video'
      : 'Retouching';
    const link = isSaveTheVideoUpload ? (videoDriveLink || driveLink) : driveLink;
    if (link && String(link).trim() !== '') {
      const leadRes = await pool.query(
        `SELECT external_id::text AS external_id, lead_serial_number FROM external_leads
         WHERE external_id::text = $1 OR lead_serial_number = $1 LIMIT 1`,
        [leadId]
      );
      const lead = leadRes.rows[0];
      const projectIdCandidates = [
        lead?.lead_serial_number ? `CRM-${lead.lead_serial_number}` : null,
        lead?.external_id ? `CRM-${lead.external_id}` : null,
        `CRM-${leadId}`,
      ].filter(Boolean);
      await pool.query(
        `UPDATE assigned_projects
            SET upload_link = $1,
                status = CASE WHEN status IN ('Approved') THEN status ELSE 'Completed' END,
                updated_at = NOW()
          WHERE project_type = $2
            AND project_id = ANY($3::text[])`,
        [link, projectType, projectIdCandidates]
      );
    }
  }

  return result.rows[0] || null;
};
