-- ============================================
-- MIGRATION: Steps V2 - Run on existing DB
-- ============================================

-- 1. Add new columns to project_steps
ALTER TABLE project_steps 
  ADD COLUMN IF NOT EXISTS step_type ENUM('main','sub') DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS parent_step INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS step_deadline DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delay_reason TEXT DEFAULT NULL;

-- 2. Add quotation_planning to project_files file_category enum
ALTER TABLE project_files 
  MODIFY COLUMN file_category ENUM('quotation','quotation_planning','voice_note','step_file') DEFAULT 'step_file';

-- 3. Delete old steps for all projects (they will be recreated on next project creation)
--    WARNING: This removes old step data. Only run if you want a fresh start.
-- DELETE FROM project_steps;

-- 4. For existing projects: update step names and add new steps
--    Run this per project if needed, or let new projects use the new structure.

-- 5. Verify
SELECT 'Migration complete!' as status;
