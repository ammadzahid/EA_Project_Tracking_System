-- ============================================
-- SAFE MIGRATION — Existing Data Bachega
-- Purana data DELETE nahi hoga
-- Bas naye columns aur features add honge
-- ============================================

-- STEP 1: project_steps table mein naye columns add karo
ALTER TABLE project_steps 
  ADD COLUMN IF NOT EXISTS step_type ENUM('main','sub') DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS parent_step INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS step_deadline DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delay_reason TEXT DEFAULT NULL;

-- STEP 2: project_files mein quotation_planning category add karo
ALTER TABLE project_files 
  MODIFY COLUMN file_category ENUM('quotation','quotation_planning','voice_note','step_file') DEFAULT 'step_file';

-- STEP 3: Existing purane steps ko update karo (step names match karo)
-- Yeh sirf names update karta hai, data nahi chhuata
UPDATE project_steps SET step_name = 'Survey'             WHERE step_number = 1;
UPDATE project_steps SET step_name = 'Design'             WHERE step_number = 2;
UPDATE project_steps SET step_name = 'Material Demand'    WHERE step_number = 3;
UPDATE project_steps SET step_name = 'Purchase Order'     WHERE step_number = 4;
UPDATE project_steps SET step_name = 'Procurement'        WHERE step_number = 5;
UPDATE project_steps SET step_name = 'Material Dispatch'  WHERE step_number = 6;
UPDATE project_steps SET step_name = 'Material Delivered' WHERE step_number = 7;
UPDATE project_steps SET step_name = 'Execution'          WHERE step_number = 8;

-- STEP 4: Purane 9-11 steps ko naye sub-steps se replace karo
-- WARNING: Agar in steps mein koi files hain to pehle backup lo
-- Yeh sirf step names update karta hai existing rows ke liye
UPDATE project_steps SET step_name = 'Mechanical',              step_type = 'sub', parent_step = 8 WHERE step_number = 9;
UPDATE project_steps SET step_name = 'Civil',                   step_type = 'sub', parent_step = 8 WHERE step_number = 10;
UPDATE project_steps SET step_name = 'Electric',                step_type = 'sub', parent_step = 8 WHERE step_number = 11;

-- STEP 5: Har project mein naye sub-steps add karo (12-16) jo pehle nahi the
-- Yeh sirf naye rows insert karta hai, purana data touch nahi karta
-- is_locked = 1 (sirf tab unlock hoga jab step 7 complete ho)
INSERT IGNORE INTO project_steps (project_id, step_number, step_name, step_type, parent_step, status, is_locked)
SELECT p.uid, 12, 'Earthing',                  'sub', 8, 'pending', 1
FROM projects p
WHERE p.uid NOT IN (SELECT project_id FROM project_steps WHERE step_number = 12);

INSERT IGNORE INTO project_steps (project_id, step_number, step_name, step_type, parent_step, status, is_locked)
SELECT p.uid, 13, 'Load Distribution',         'sub', 8, 'pending', 1
FROM projects p
WHERE p.uid NOT IN (SELECT project_id FROM project_steps WHERE step_number = 13);

INSERT IGNORE INTO project_steps (project_id, step_number, step_name, step_type, parent_step, status, is_locked)
SELECT p.uid, 14, 'Commissioning & Testing',   'sub', 8, 'pending', 1
FROM projects p
WHERE p.uid NOT IN (SELECT project_id FROM project_steps WHERE step_number = 14);

INSERT IGNORE INTO project_steps (project_id, step_number, step_name, step_type, parent_step, status, is_locked)
SELECT p.uid, 15, 'User Training & Reviews',   'sub', 8, 'pending', 1
FROM projects p
WHERE p.uid NOT IN (SELECT project_id FROM project_steps WHERE step_number = 15);

INSERT IGNORE INTO project_steps (project_id, step_number, step_name, step_type, parent_step, status, is_locked)
SELECT p.uid, 16, 'Documentation',             'sub', 8, 'pending', 1
FROM projects p
WHERE p.uid NOT IN (SELECT project_id FROM project_steps WHERE step_number = 16);

-- STEP 5b: Agar kisi project mein step 7 pehle se complete hai to sub-steps unlock kar do
UPDATE project_steps 
SET is_locked = 0
WHERE step_number BETWEEN 9 AND 16
AND project_id IN (
  SELECT project_id FROM (
    SELECT project_id FROM project_steps 
    WHERE step_number = 7 AND status IN ('completed', 'approved')
  ) AS done7
);

-- STEP 6: Main steps (1-8) ka step_type update karo
UPDATE project_steps SET step_type = 'main', parent_step = NULL 
WHERE step_number BETWEEN 1 AND 8;

-- STEP 7: Verify karo
SELECT 
  step_number, step_name, step_type, 
  COUNT(DISTINCT project_id) as projects_count
FROM project_steps 
GROUP BY step_number, step_name, step_type
ORDER BY step_number;

SELECT 'Migration complete! Purana data safe hai.' as status;