-- Migration: Pre-production Sub-Phase Support
-- Purpose: Add pre_production_step column to support shoot → editing sub-phases
--          Phase 1 (shoot): Photographer + Videographer assignment
--          Phase 2 (editing): Save the Date, Save the Video, Retouch assignment
--          Client approval gates the transition from Phase 1 to Phase 2

-- ============================================================
-- 1. Add pre_production_step to external_leads
-- ============================================================
ALTER TABLE external_leads ADD COLUMN IF NOT EXISTS pre_production_step VARCHAR(20) DEFAULT 'shoot';

-- Valid values: 'shoot' (Phase 1) | 'editing' (Phase 2)
-- Flow:
--   - When flow_type is set, pre_production_step defaults to 'shoot'
--   - CRM assigns Photographer + Videographer in 'shoot' step
--   - Client approves shoot work → transitions to 'editing' step
--   - CRM assigns Save the Date, Save the Video, Retouch in 'editing' step
--   - CRM approves → phase advances to 'event' (pre_wedding) or 'post_production' (post_wedding)

-- ============================================================
-- 2. Update existing leads to have default step
-- ============================================================
UPDATE external_leads
SET pre_production_step = 'shoot'
WHERE current_phase = 'pre_production'
  AND pre_production_step IS NULL;

-- ============================================================
-- 3. Add creative_confirmations enhancement for shoot approval
-- ============================================================
-- The existing client_approved column on creative_confirmations will be used
-- for Phase 1 (shoot) client approval trigger