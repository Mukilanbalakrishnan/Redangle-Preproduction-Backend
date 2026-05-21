-- Migration: Add roles TEXT[] array column to users and employees tables
-- Purpose: Support multiple roles per user while keeping backward compatibility

-- Step 1: Add roles column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';

-- Step 2: Backfill from existing role column
UPDATE users SET roles = ARRAY[role] WHERE roles = '{}' OR roles IS NULL;

-- Step 3: Set NOT NULL constraint
ALTER TABLE users ALTER COLUMN roles SET NOT NULL;
ALTER TABLE users ALTER COLUMN roles SET DEFAULT '{}';

-- Step 4: Add roles column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';

-- Step 5: Backfill from existing role column
UPDATE employees SET roles = ARRAY[role] WHERE roles = '{}' OR roles IS NULL;

-- Step 6: Set NOT NULL constraint
ALTER TABLE employees ALTER COLUMN roles SET NOT NULL;
ALTER TABLE employees ALTER COLUMN roles SET DEFAULT '{}';
