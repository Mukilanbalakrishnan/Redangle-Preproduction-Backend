ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_employee_id VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_stage VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_notifications_target_employee ON notifications(target_employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_source_stage ON notifications(source_stage);
