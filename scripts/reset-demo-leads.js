require('dotenv').config();

const { Pool } = require('pg');

const CONFIRM_FLAG = '--confirm-reset-demo-leads';

if (!process.argv.includes(CONFIRM_FLAG)) {
  console.error(`Refusing to reset data. Re-run with ${CONFIRM_FLAG}.`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const leads = [
  {
    id: '9101',
    code: 'LD-ANIKA',
    name: 'Anika Rao',
    email: 'anika.rao@example.com',
    phone: '9876501001',
    location: 'Chennai',
    eventType: 'Wedding',
    date: '2026-12-05',
    priority: 'high',
    flowType: 'wedding',
    currentPhase: 'pre_production',
    phaseStatus: 'not_started',
    phaseOwner: 'pre-production-crm',
    preStep: 'shoot',
    mediaStatus: 'Pending',
    stages: ['completed_assign_team'],
    team: { photographer: 'EMP-12', videographer: 'EMP-13', drone: null, save_the_date: null, save_the_video: null, retouch: null },
  },
  {
    id: '9102',
    code: 'LD-KAVYA',
    name: 'Kavya Nair',
    email: 'kavya.nair@example.com',
    phone: '9876501002',
    location: 'Coimbatore',
    eventType: 'Pre-Wedding',
    date: '2026-12-09',
    priority: 'medium',
    flowType: 'pre_wedding',
    currentPhase: 'pre_production',
    phaseStatus: 'approved',
    phaseOwner: 'pre-production-crm',
    preStep: 'shoot',
    mediaStatus: 'Pending',
    stages: ['completed_assign_team', 'photographer_upload'],
    team: { photographer: 'EMP-23', videographer: 'EMP-21', drone: null, save_the_date: null, save_the_video: null, retouch: null },
    photoDeliveryMethod: 'hard_disk',
    photoHardDiskDate: '2026-12-10',
    numImages: 640,
    cameraUsed: 'Canon R5',
    uploadNotes: 'Outdoor shoot raw photos will arrive by hard disk.',
  },
  {
    id: '9103',
    code: 'LD-ROHAN',
    name: 'Rohan Mehta',
    email: 'rohan.mehta@example.com',
    phone: '9876501003',
    location: 'Bengaluru',
    eventType: 'Reception',
    date: '2026-12-12',
    priority: 'medium',
    flowType: 'pre_wedding',
    currentPhase: 'event',
    phaseStatus: 'approved',
    phaseOwner: 'post-production-crm',
    preStep: 'shoot',
    mediaStatus: 'Pending',
    eventStatus: 'started',
    stages: ['completed_assign_team', 'event_started'],
    team: { photographer: 'EMP-12', videographer: 'EMP-13', drone: 'EMP-14', save_the_date: null, save_the_video: null, retouch: null },
    driveLink: 'https://drive.google.com/drive/folders/demo-rohan-photos',
    videoDeliveryMethod: 'hard_disk',
    videoHardDiskDate: '2026-12-13',
    numImages: 420,
    numVideos: 18,
    cameraUsed: 'Canon R6',
    videoCameraUsed: 'Sony A7S III',
    videoUploadNotes: 'Reception videos will be delivered by hard disk.',
  },
  {
    id: '9104',
    code: 'LD-ISHA',
    name: 'Isha Menon',
    email: 'isha.menon@example.com',
    phone: '9876501004',
    location: 'Madurai',
    eventType: 'Birthday',
    date: '2026-12-16',
    priority: 'low',
    flowType: 'wedding',
    currentPhase: 'post_production',
    phaseStatus: 'submitted',
    phaseOwner: 'post-production-crm',
    preStep: 'shoot',
    mediaStatus: 'crm_verified',
    eventStatus: 'ended',
    stages: ['completed_assign_team', 'event_started', 'shoot_completed', 'photographer_upload', 'videographer_upload', 'data_manager_verification', 'crm_verified'],
    team: { photographer: 'EMP-12', videographer: 'EMP-13', drone: null, save_the_date: null, save_the_video: null, retouch: null },
    driveLink: 'https://drive.google.com/drive/folders/demo-isha-photos',
    videoDriveLink: 'https://drive.google.com/drive/folders/demo-isha-videos',
    numImages: 350,
    numVideos: 9,
    postProjects: true,
  },
  {
    id: '9105',
    code: 'LD-ARJUN',
    name: 'Arjun Varma',
    email: 'arjun.varma@example.com',
    phone: '9876501005',
    location: 'Pondicherry',
    eventType: 'Corporate Shoot',
    date: '2026-12-20',
    priority: 'high',
    flowType: 'wedding',
    currentPhase: 'post_production',
    phaseStatus: 'completed',
    phaseOwner: 'post-production-crm',
    preStep: 'shoot',
    mediaStatus: 'crm_verified',
    eventStatus: 'ended',
    stages: ['completed_assign_team', 'event_started', 'shoot_completed', 'photographer_upload', 'videographer_upload', 'data_manager_verification', 'crm_verified', 'harddisk_closed'],
    team: { photographer: 'EMP-23', videographer: 'EMP-23', drone: 'EMP-14', save_the_date: null, save_the_video: null, retouch: null },
    driveLink: 'https://drive.google.com/drive/folders/demo-arjun-photos',
    videoDriveLink: 'https://drive.google.com/drive/folders/demo-arjun-videos',
    dronePhotoDriveLink: 'https://drive.google.com/drive/folders/demo-arjun-drone-photos',
    droneVideoDriveLink: 'https://drive.google.com/drive/folders/demo-arjun-drone-videos',
    numImages: 780,
    numVideos: 22,
    droneNumImages: 120,
    droneNumVideos: 6,
    postProjects: true,
    postProjectsApproved: true,
  },
];

const acceptedAssignments = [
  '12:photography',
  '13:videography',
  '14:drone-coverage',
  '21:videography',
  '23:photography',
  '23:videography',
];

const ensureColumns = async (client) => {
  await client.query(`
    ALTER TABLE event_details
    ADD COLUMN IF NOT EXISTS photo_delivery_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS photo_hard_disk_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS photo_hard_disk_received BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS video_delivery_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS video_hard_disk_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS video_hard_disk_received BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS drone_delivery_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS drone_hard_disk_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS drone_hard_disk_received BOOLEAN DEFAULT FALSE
  `);
};

const deleteLeadData = async (client) => {
  const tables = [
    'lead_current_stage',
    'lead_stage_tracking',
    'lead_tracking_stages',
    'creative_confirmations',
    'creative_plannings',
    'approved_drive_links',
    'assigned_projects',
    'crm_final_approvals',
    'hard_disk_closures',
    'pixoffice_entries',
    'photo_upload',
    'assign_teams',
    'event_details',
  ];

  await client.query('DELETE FROM notifications WHERE lead_id IS NOT NULL');
  for (const table of tables) {
    await client.query(`DELETE FROM ${table}`);
  }
  await client.query('DELETE FROM external_leads');
};

const insertLead = async (client, lead) => {
  await client.query(
    `INSERT INTO external_leads (
      external_id, lead_serial_number, lead_name, email, phone, location,
      event_type, event_date, priority, status, flow_type, current_phase,
      phase_status, phase_owner, pre_production_step, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'new',$10,$11,$12,$13,$14,NOW(),NOW())`,
    [
      lead.id,
      lead.code,
      lead.name,
      lead.email,
      lead.phone,
      lead.location,
      lead.eventType,
      lead.date,
      lead.priority,
      lead.flowType,
      lead.currentPhase,
      lead.phaseStatus,
      lead.phaseOwner,
      lead.preStep,
    ]
  );

  await client.query(
    `INSERT INTO event_details (
      external_lead_id, client_name, email, phone, event_type, event_location,
      preferred_date, preferred_time, budget_range, services, deliverables,
      meeting_type, meeting_details, client_requirements, priority_level,
      drive_link, video_drive_link, camera_used, video_camera_used,
      num_images, num_videos, upload_notes, video_upload_notes, media_status,
      event_status, drone_photo_drive_link, drone_video_drive_link,
      drone_num_images, drone_num_videos, photo_delivery_method,
      photo_hard_disk_delivery_date, video_delivery_method,
      video_hard_disk_delivery_date, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,'10:00','100000-250000',
      ARRAY['Photography','Videography'], ARRAY['Raw Data','Edited Output'],
      'Online','Demo consultation completed','Demo client requirements',
      $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,NOW(),NOW()
    )`,
    [
      lead.id,
      lead.name,
      lead.email,
      lead.phone,
      lead.eventType,
      lead.location,
      lead.date,
      lead.priority,
      lead.driveLink || null,
      lead.videoDriveLink || null,
      lead.cameraUsed || null,
      lead.videoCameraUsed || null,
      lead.numImages || 0,
      lead.numVideos || 0,
      lead.uploadNotes || null,
      lead.videoUploadNotes || null,
      lead.mediaStatus,
      lead.eventStatus || 'not_started',
      lead.dronePhotoDriveLink || null,
      lead.droneVideoDriveLink || null,
      lead.droneNumImages || 0,
      lead.droneNumVideos || 0,
      lead.photoDeliveryMethod || (lead.driveLink ? 'drive_link' : null),
      lead.photoHardDiskDate || null,
      lead.videoDeliveryMethod || (lead.videoDriveLink ? 'drive_link' : null),
      lead.videoHardDiskDate || null,
    ]
  );

  await client.query(
    `INSERT INTO assign_teams (
      external_lead_id, photographer, videographer, drone, save_the_date,
      save_the_video, retouch, event_date, event_time, location, accepted,
      accepted_assignments, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'10:00',$9,TRUE,$10::jsonb,NOW(),NOW())`,
    [
      lead.id,
      lead.team.photographer,
      lead.team.videographer,
      lead.team.drone,
      lead.team.save_the_date,
      lead.team.save_the_video,
      lead.team.retouch,
      lead.date,
      lead.location,
      JSON.stringify(acceptedAssignments),
    ]
  );

  await client.query(
    `INSERT INTO creative_confirmations (
      external_lead_id, costume_type, color_preferences, costume_requirements,
      event_theme, mood_description, reference_images, location_name,
      location_type, google_map_link, client_approved, created_at, updated_at
    ) VALUES ($1,'Formal',ARRAY['Red','Gold'],'Demo costume notes',$2,'Elegant and clean',ARRAY[]::text[],$3,'Outdoor','https://maps.google.com',TRUE,NOW(),NOW())`,
    [lead.id, `${lead.eventType} theme`, lead.location]
  );

  await client.query(
    `INSERT INTO creative_plannings (
      external_lead_id, event_list, equipment_required, lighting_setup,
      props_required, special_notes, created_at, updated_at
    ) VALUES ($1,'Main shoot sequence',ARRAY['Camera','Lights'],ARRAY['Natural light'],ARRAY['Backdrop'],'Demo planning notes',NOW(),NOW())`,
    [lead.id]
  );

  for (const stage of lead.stages) {
    await client.query(
      `INSERT INTO lead_tracking_stages (external_lead_id, stage_name, created_at) VALUES ($1,$2,NOW())`,
      [lead.id, stage]
    );
  }

  if (lead.postProjects) {
    const projects = [
      ['Traditional Video Editing', 'EMP-25'],
      ['Traditional Photo Editing', 'EMP-26'],
      ['Album Design', 'EMP-26'],
      ['Candid Video Editing', 'EMP-27'],
    ];
    for (const [projectType, employeeId] of projects) {
      await client.query(
        `INSERT INTO assigned_projects (
          project_id, project_name, project_type, employee_id, status,
          upload_link, admin_notes, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'Demo post-production project',NOW(),NOW())`,
        [
          `CRM-${lead.id}`,
          `${lead.name} ${projectType}`,
          projectType,
          employeeId,
          lead.postProjectsApproved ? 'Approved' : 'Pending',
          lead.postProjectsApproved ? `https://drive.google.com/drive/folders/demo-${lead.id}-${projectType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : null,
        ]
      );
    }

    await client.query(
      `INSERT INTO pixoffice_entries (
        external_lead_id, event_name, sub_category, services, file_size,
        storage_path, qc_status, created_at
      ) VALUES ($1,$2,'Demo', $3::jsonb, '120GB', '/demo/storage', 'QC Completed', NOW())`,
      [lead.id, lead.name, JSON.stringify(['Photography', 'Videography'])]
    );
  }
};

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureColumns(client);
    await deleteLeadData(client);
    for (const lead of leads) {
      await insertLead(client, lead);
    }
    await client.query('COMMIT');
    console.log(`Reset complete. Inserted ${leads.length} demo leads.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reset failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
