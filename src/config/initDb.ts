import { Client } from "pg";
import dotenv from "dotenv";
import { refreshPools } from "./db";

dotenv.config();

const dbHost = process.env.DB_HOST || "localhost";
const dbPort = Number(process.env.DB_PORT) || 6000;
const dbUser = process.env.DB_USER || "postgres";
const dbName = process.env.DB_NAME || "Redangle-Preproduction";

async function getAuthenticatedClient(database: string): Promise<Client> {
  const passwordsToTry = [
    process.env.DB_PASSWORD || "password",
    "tns7142006",
    "password",
    "1234",
    ""
  ];
  
  const uniquePasswords = Array.from(new Set(passwordsToTry));
  
  for (let i = 0; i < uniquePasswords.length; i++) {
    const pw = uniquePasswords[i];
    const client = new Client({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: pw,
      database: database
    });
    
    try {
      await client.connect();
      if (pw !== process.env.DB_PASSWORD) {
        console.log(`🔑 Connected to PostgreSQL using fallback password: "${pw}"`);
        process.env.DB_PASSWORD = pw;
        refreshPools();
      }
      return client;
    } catch (err: any) {
      if (err.code === "28P01") {
        // Password authorization failed, try next password
        continue;
      } else {
        // Connection refused, database does not exist, etc.
        throw err;
      }
    }
  }
  
  throw new Error("Could not connect to PostgreSQL: All passwords failed.");
}

export const ensureDatabaseExists = async () => {
  let adminClient: Client | null = null;
  try {
    console.log(`Connecting to PostgreSQL to check database "${dbName}"...`);
    adminClient = await getAuthenticatedClient("postgres");
    
    const res = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    
    if (res.rows.length === 0) {
      console.log(`Database "${dbName}" does not exist. Creating it...`);
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully!`);
    } else {
      console.log(`✅ Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error("Error ensuring database exists:", err);
    throw err;
  } finally {
    if (adminClient) {
      await adminClient.end();
    }
  }
};

export const ensureTablesExist = async () => {
  let client: Client | null = null;
  try {
    client = await getAuthenticatedClient(dbName);
    console.log(`Checking and creating schemas in database "${dbName}"...`);
    
    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(100),
        roles TEXT[] DEFAULT '{}'::text[],
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        employee_id INTEGER
      )
    `);
    
    // 2. Employees Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        contact_number VARCHAR(50),
        dob DATE,
        address TEXT,
        work_location VARCHAR(255),
        role VARCHAR(100),
        roles TEXT[] DEFAULT '{}'::text[],
        experience VARCHAR(100),
        date_of_join DATE,
        description TEXT,
        created_by VARCHAR(100),
        profile_image TEXT,
        identity_document TEXT,
        status VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        employee_code VARCHAR(100)
      )
    `);
    
    // 3. External Leads Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS external_leads (
        id SERIAL PRIMARY KEY,
        external_id VARCHAR(100) UNIQUE NOT NULL,
        lead_serial_number VARCHAR(100),
        lead_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        location VARCHAR(255),
        event_type VARCHAR(100),
        event_date DATE,
        priority VARCHAR(50),
        invoice_id INTEGER,
        discount NUMERIC,
        invoice_total NUMERIC,
        invoice_paid NUMERIC,
        invoice_balance NUMERIC,
        invoice_data JSONB,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        flow_type VARCHAR(20),
        current_phase VARCHAR(30) DEFAULT 'not_started',
        phase_status VARCHAR(20) DEFAULT 'not_started',
        phase_owner VARCHAR(30),
        pre_production_step VARCHAR(20) DEFAULT 'shoot'
      )
    `);
    
    // 4. Event Details Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_details (
        id SERIAL PRIMARY KEY,
        external_lead_id VARCHAR(100) UNIQUE NOT NULL,
        client_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        contact_person_name VARCHAR(255),
        contact_person_number VARCHAR(50),
        event_type VARCHAR(255),
        event_location TEXT,
        preferred_date DATE,
        preferred_time TIME,
        budget_range VARCHAR(255),
        services TEXT,
        deliverables TEXT,
        invoice_attached TEXT,
        meeting_type VARCHAR(100),
        meeting_details TEXT,
        client_requirements TEXT,
        priority_level VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        drive_link TEXT,
        video_drive_link TEXT,
        drone_photo_drive_link TEXT,
        drone_video_drive_link TEXT,
        drone_camera_used TEXT,
        drone_video_camera_used TEXT,
        drone_num_images INTEGER,
        drone_num_videos INTEGER,
        drone_upload_notes TEXT,
        drone_video_upload_notes TEXT,
        save_the_date_drive_link TEXT,
        save_the_date_upload_notes TEXT,
        save_the_date_submission_status VARCHAR(50),
        save_the_video_drive_link TEXT,
        save_the_video_upload_notes TEXT,
        save_the_video_submission_status VARCHAR(50),
        retouch_drive_link TEXT,
        retouch_upload_notes TEXT,
        retouch_submission_status VARCHAR(50),
        photo_delivery_method VARCHAR(20),
        photo_hard_disk_delivery_date DATE,
        photo_hard_disk_received BOOLEAN DEFAULT FALSE,
        photo_upload_phase VARCHAR(30),
        video_delivery_method VARCHAR(20),
        video_hard_disk_delivery_date DATE,
        video_hard_disk_received BOOLEAN DEFAULT FALSE,
        video_upload_phase VARCHAR(30),
        drone_delivery_method VARCHAR(20),
        drone_hard_disk_delivery_date DATE,
        drone_hard_disk_received BOOLEAN DEFAULT FALSE,
        drone_upload_phase VARCHAR(30),
        media_status VARCHAR(50) DEFAULT 'Pending',
        event_status VARCHAR(20) DEFAULT 'not_started',
        event_started_at TIMESTAMP,
        event_paused_at TIMESTAMP,
        event_ended_at TIMESTAMP,
        event_started_by VARCHAR(100),
        video_camera_used TEXT,
        num_images INTEGER DEFAULT 0,
        num_videos INTEGER DEFAULT 0,
        upload_notes TEXT,
        camera_used VARCHAR(255)
      )
    `);
    
    // 5. Assign Teams Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assign_teams (
        id SERIAL PRIMARY KEY,
        external_lead_id VARCHAR(100) UNIQUE NOT NULL,
        photographer VARCHAR(100),
        videographer VARCHAR(100),
        drone VARCHAR(100),
        save_the_date VARCHAR(100),
        save_the_video VARCHAR(100),
        retouch VARCHAR(100),
        assistant VARCHAR(100),
        editor VARCHAR(100),
        secondary_photographer JSONB DEFAULT '[]'::jsonb,
        secondary_videographer JSONB DEFAULT '[]'::jsonb,
        secondary_drone JSONB DEFAULT '[]'::jsonb,
        event_photographer VARCHAR(100),
        event_videographer VARCHAR(100),
        event_drone VARCHAR(100),
        event_secondary_photographer JSONB DEFAULT '[]'::jsonb,
        event_secondary_videographer JSONB DEFAULT '[]'::jsonb,
        event_secondary_drone JSONB DEFAULT '[]'::jsonb,
        event_additional_staff JSONB DEFAULT '[]'::jsonb,
        event_assignment_date DATE,
        event_assignment_time TIME,
        event_assignment_location TEXT,
        additional_staff JSONB DEFAULT '[]'::jsonb,
        event_date DATE,
        event_time TIME,
        location TEXT,
        accepted_by_employees JSONB DEFAULT '[]'::jsonb,
        accepted_assignments JSONB DEFAULT '[]'::jsonb,
        shoot_locations JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        accepted BOOLEAN DEFAULT FALSE
      )
    `);
    
    // 6. Lead Tracking Stages Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_tracking_stages (
        external_lead_id VARCHAR(100) NOT NULL,
        stage_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (external_lead_id, stage_name)
      )
    `);
    
    // 7. Assigned Projects Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assigned_projects (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(100) NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        project_type VARCHAR(100),
        employee_id VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        upload_link TEXT,
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 8. Employee Work Runtime Sessions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_work_runtime_sessions (
        id SERIAL PRIMARY KEY,
        assigned_project_id INTEGER NOT NULL,
        project_id VARCHAR(100) NOT NULL,
        employee_id VARCHAR(100) NOT NULL,
        project_type VARCHAR(100),
        work_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'not_started',
        started_at TIMESTAMP,
        paused_at TIMESTAMP,
        ended_at TIMESTAMP,
        accumulated_seconds INTEGER NOT NULL DEFAULT 0,
        started_by VARCHAR(100),
        ended_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (assigned_project_id, work_date)
      )
    `);
    
    // 9. Approved Drive Links Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS approved_drive_links (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(100) NOT NULL,
        project_type VARCHAR(100) NOT NULL,
        upload_link TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 10. CRM Final Approvals Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_final_approvals (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 11. Pixoffice Entries Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pixoffice_entries (
        id SERIAL PRIMARY KEY,
        client_name VARCHAR(255),
        event_date DATE,
        selected_photos INTEGER DEFAULT 0,
        total_photos INTEGER DEFAULT 0,
        selected_videos INTEGER DEFAULT 0,
        total_videos INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 12. Password Reset OTPs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(6) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE
      )
    `);
    
    // 13. Employee Leave Requests Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_leave_requests (
        leave_request_id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        no_of_days INTEGER,
        status VARCHAR(20) DEFAULT 'Pending',
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 14. Event Runtime Sessions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_runtime_sessions (
        id SERIAL PRIMARY KEY,
        external_lead_id VARCHAR(100) NOT NULL,
        work_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'not_started',
        started_at TIMESTAMP,
        paused_at TIMESTAMP,
        ended_at TIMESTAMP,
        accumulated_seconds INTEGER NOT NULL DEFAULT 0,
        started_by VARCHAR(100),
        ended_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (external_lead_id, work_date)
      )
    `);
    
    // 15. Hard Disk Closures Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hard_disk_closures (
        id SERIAL PRIMARY KEY,
        external_lead_id VARCHAR(100) NOT NULL,
        employee_id VARCHAR(100) NOT NULL,
        media_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        received_by VARCHAR(100),
        received_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (external_lead_id, employee_id, media_type)
      )
    `);
    
    // 16. Client Deliveries Table
    await client.query(`
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
    
    // 17. Attendance Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        login_time TIME,
        logout_time TIME,
        status VARCHAR(20) DEFAULT 'Present',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, date)
      )
    `);
    
    console.log(`✅ All tables verified & created successfully in "${dbName}".`);
  } catch (err) {
    console.error("Error ensuring tables exist:", err);
    throw err;
  } finally {
    if (client) {
      await client.end();
    }
  }
};

export const initializeDatabase = async () => {
  try {
    await ensureDatabaseExists();
    await ensureTablesExist();
    console.log("🚀 Database initialization complete and ready.");
  } catch (err) {
    console.error("❌ Database initialization encountered a critical error:", err);
    throw err;
  }
};
