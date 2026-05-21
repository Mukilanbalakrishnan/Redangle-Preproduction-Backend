-- Migration: Red Angle Structure Update
-- Purpose: Add flow types, phase tracking, event runtime status, drone support,
--          consolidate data-management into data-manager, remove Candid (employee-3)

-- ============================================================
-- 1. Add flow_type and phase tracking columns to external_leads
-- ============================================================
ALTER TABLE external_leads ADD COLUMN IF NOT EXISTS flow_type VARCHAR(20);
ALTER TABLE external_leads ADD COLUMN IF NOT EXISTS current_phase VARCHAR(30) DEFAULT 'not_started';
ALTER TABLE external_leads ADD COLUMN IF NOT EXISTS phase_status VARCHAR(20) DEFAULT 'not_started';
ALTER TABLE external_leads ADD COLUMN IF NOT EXISTS phase_owner VARCHAR(30);

-- ============================================================
-- 2. Add event runtime status columns to event_details
-- ============================================================
ALTER TABLE event_details ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) DEFAULT 'not_started';
ALTER TABLE event_details ADD COLUMN IF NOT EXISTS event_started_at TIMESTAMP;
ALTER TABLE event_details ADD COLUMN IF NOT EXISTS event_paused_at TIMESTAMP;
ALTER TABLE event_details ADD COLUMN IF NOT EXISTS event_ended_at TIMESTAMP;
ALTER TABLE event_details ADD COLUMN IF NOT EXISTS event_started_by VARCHAR(100);

-- ============================================================
-- 3. Add drone assignment columns to assign_teams
-- ============================================================
ALTER TABLE assign_teams ADD COLUMN IF NOT EXISTS drone VARCHAR(100);
ALTER TABLE assign_teams ADD COLUMN IF NOT EXISTS secondary_drone JSONB DEFAULT '[]'::jsonb;
ALTER TABLE assign_teams ADD COLUMN IF NOT EXISTS save_the_date VARCHAR(100);
ALTER TABLE assign_teams ADD COLUMN IF NOT EXISTS save_the_video VARCHAR(100);
ALTER TABLE assign_teams ADD COLUMN IF NOT EXISTS retouch VARCHAR(100);

-- ============================================================
-- 4. Consolidate data-management role into data-manager
-- ============================================================
UPDATE users SET role = 'data-manager' WHERE role = 'data-management';
UPDATE users SET roles = array_replace(roles, 'data-management', 'data-manager') WHERE 'data-management' = ANY(roles);
UPDATE employees SET role = 'Data Manager' WHERE role = 'Data Management';
UPDATE employees SET roles = array_replace(roles, 'Data Management', 'Data Manager') WHERE 'Data Management' = ANY(roles);

-- ============================================================
-- 5. Remove Candid (employee-3) role from users
-- ============================================================
UPDATE users SET roles = array_remove(roles, 'employee-3') WHERE 'employee-3' = ANY(roles);
UPDATE users SET role = COALESCE(roles[1], 'employee-1') WHERE role = 'employee-3';
UPDATE employees SET role = 'Retouch Photo' WHERE role = 'Candid Photo';
UPDATE employees SET roles = array_replace(roles, 'Candid Photo', 'Retouch Photo') WHERE 'Candid Photo' = ANY(roles);
