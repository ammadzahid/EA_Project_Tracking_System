<?php
// ============================================
// STEPS API - Upload files, Complete steps, Mechanical checklist
// ============================================
require_once __DIR__ . '/../db.php';
setCorsHeaders();

$user = authenticateSession();
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'upload':
        uploadStepFile($user);
        break;
    case 'complete':
        completeStep($user);
        break;
    case 'mechanical':
        updateMechanical($user);
        break;
    case 'approve':
        approveStepFile($user);
        break;
    case 'set_deadline':
        setStepDeadline($user);
        break;
    case 'set_delay_reason':
        setDelayReason($user);
        break;
    default:
        jsonResponse(['success' => false, 'message' => 'Invalid action'], 400);
}

// ============================================
// UPLOAD FILE FOR A STEP (Team Leader)
// ============================================
function uploadStepFile($user) {
    if ($user['role'] !== 'teamleader') {
        jsonResponse(['success' => false, 'message' => 'Only Team Leader can upload step files'], 403);
    }

    $projectId = $_POST['projectId'] ?? '';
    $stepNumber = (int)($_POST['stepNumber'] ?? 0);
    $description = $_POST['description'] ?? '';

    if (empty($projectId) || $stepNumber < 1 || $stepNumber > 16) {
        jsonResponse(['success' => false, 'message' => 'Project ID and valid step number (1-16) required'], 400);
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'message' => 'File upload required'], 400);
    }

    $db = getDB();

    // Check project belongs to this leader
    $projStmt = $db->prepare("SELECT * FROM projects WHERE uid = ? AND assigned_leader = ? AND status IN ('accepted', 'in_progress')");
    $projStmt->execute([$projectId, $user['uid']]);
    if (!$projStmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Project not found or not assigned to you'], 404);
    }

    // Check step is not locked/completed
    $stepStmt = $db->prepare("SELECT * FROM project_steps WHERE project_id = ? AND step_number = ?");
    $stepStmt->execute([$projectId, $stepNumber]);
    $step = $stepStmt->fetch();

    if (!$step) {
        jsonResponse(['success' => false, 'message' => 'Step not found'], 404);
    }
    if ($step['status'] === 'completed' || $step['status'] === 'approved') {
        jsonResponse(['success' => false, 'message' => 'This step is already completed and locked.'], 403);
    }
    if ($step['is_locked'] && $step['status'] === 'pending') {
        // Check if previous step is done
        if ($stepNumber > 1) {
            $prevStmt = $db->prepare("SELECT status FROM project_steps WHERE project_id = ? AND step_number = ?");
            $prevStmt->execute([$projectId, $stepNumber - 1]);
            $prev = $prevStmt->fetch();
            if ($prev && !in_array($prev['status'], ['completed', 'approved'])) {
                jsonResponse(['success' => false, 'message' => 'Complete previous step first'], 403);
            }
        }
    }

    // Save file to disk
    $file = $_FILES['file'];
    if ($file['size'] > MAX_FILE_SIZE) {
        jsonResponse(['success' => false, 'message' => 'File too large (max 50MB)'], 400);
    }

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $safeExt = preg_replace('/[^a-zA-Z0-9]/', '', $ext);
    $fileName = "step{$stepNumber}_{$projectId}_" . time() . '.' . $safeExt;
    $filePath = 'uploads/step_files/' . $fileName;
    
    if (!move_uploaded_file($file['tmp_name'], __DIR__ . '/../' . $filePath)) {
        jsonResponse(['success' => false, 'message' => 'Failed to save file on server'], 500);
    }

    $fileUid = generateUID();
    $fileStmt = $db->prepare("
        INSERT INTO project_files (uid, project_id, file_name, file_path, file_type, file_size, file_category, step_number, approval_status, uploaded_by) 
        VALUES (?, ?, ?, ?, ?, ?, 'step_file', ?, 'pending', ?)
    ");
    $fileStmt->execute([$fileUid, $projectId, $file['name'], $filePath, $file['type'], $file['size'], $stepNumber, $user['uid']]);

    // Update step status
    $db->prepare("UPDATE project_steps SET status = 'in_progress', description = COALESCE(NULLIF(?, ''), description), is_locked = 0 WHERE project_id = ? AND step_number = ?")
       ->execute([$description, $projectId, $stepNumber]);

    // Update project status
    $db->prepare("UPDATE projects SET status = 'in_progress' WHERE uid = ? AND status IN ('accepted', 'in_progress')")
       ->execute([$projectId]);

    // Notification for planning
    $notifUid = generateUID();
    $projName = $db->prepare("SELECT name FROM projects WHERE uid = ?");
    $projName->execute([$projectId]);
    $pName = $projName->fetch()['name'] ?? 'Unknown';

    $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role) VALUES (?, 'step_completed', ?, ?, 'planning')")
       ->execute([$notifUid, "{$user['name']} uploaded file for \"{$pName}\" Step {$stepNumber}: {$step['step_name']}", $projectId]);

    jsonResponse(['success' => true, 'message' => 'File uploaded successfully', 'fileId' => $fileUid]);
}

// ============================================
// COMPLETE STEP - Lock it permanently
// ============================================
function completeStep($user) {
    if ($user['role'] !== 'teamleader') {
        jsonResponse(['success' => false, 'message' => 'Only Team Leader can complete steps'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $stepNumber = (int)($data['stepNumber'] ?? 0);

    $db = getDB();

    // Verify files exist for this step
    $fileCount = $db->prepare("SELECT COUNT(*) as cnt FROM project_files WHERE project_id = ? AND step_number = ? AND file_category = 'step_file'");
    $fileCount->execute([$projectId, $stepNumber]);
    if ($fileCount->fetch()['cnt'] == 0) {
        jsonResponse(['success' => false, 'message' => 'Upload at least one file before completing this step'], 400);
    }

    // Get step info
    $stepStmt = $db->prepare("SELECT * FROM project_steps WHERE project_id = ? AND step_number = ?");
    $stepStmt->execute([$projectId, $stepNumber]);
    $step = $stepStmt->fetch();
    if (!$step) jsonResponse(['success' => false, 'message' => 'Step not found'], 404);

    // Complete and lock
    $db->prepare("UPDATE project_steps SET status = 'completed', completed_at = NOW(), is_locked = 1 WHERE project_id = ? AND step_number = ?")
       ->execute([$projectId, $stepNumber]);

    // --- Unlock next step logic ---
    if ($step['step_type'] === 'main' && $stepNumber < 8) {
        // Main steps 1-7: unlock next main step
        $db->prepare("UPDATE project_steps SET is_locked = 0 WHERE project_id = ? AND step_number = ?")
           ->execute([$projectId, $stepNumber + 1]);
    } elseif ($stepNumber === 7) {
        // Step 7 done: unlock Execution (8) AND all sub-steps (9-16)
        $db->prepare("UPDATE project_steps SET is_locked = 0 WHERE project_id = ? AND step_number >= 8 AND step_number <= 16")
           ->execute([$projectId]);
    } elseif ($step['step_type'] === 'sub') {
        // Sub-step done: check if ALL sub-steps (9-16) are completed
        $doneSubStmt = $db->prepare("SELECT COUNT(*) as cnt FROM project_steps WHERE project_id = ? AND step_number BETWEEN 9 AND 16 AND status IN ('completed','approved')");
        $doneSubStmt->execute([$projectId]);
        if ($doneSubStmt->fetch()['cnt'] >= 8) {
            // All sub-steps done: mark Execution (8) as completed
            $db->prepare("UPDATE project_steps SET status = 'completed', completed_at = NOW() WHERE project_id = ? AND step_number = 8")
               ->execute([$projectId]);
            // Mark project complete
            $db->prepare("UPDATE projects SET status = 'completed' WHERE uid = ?")->execute([$projectId]);
        }
    }

    // Check if ALL 16 steps are done
    $doneAll = $db->prepare("SELECT COUNT(*) as cnt FROM project_steps WHERE project_id = ? AND status IN ('completed','approved')");
    $doneAll->execute([$projectId]);
    if ($doneAll->fetch()['cnt'] >= 16) {
        $db->prepare("UPDATE projects SET status = 'completed' WHERE uid = ?")->execute([$projectId]);
    }

    // Notification for planning
    $notifUid = generateUID();
    $projName = $db->prepare("SELECT name FROM projects WHERE uid = ?");
    $projName->execute([$projectId]);
    $pName = $projName->fetch()['name'] ?? 'Unknown';

    $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role) VALUES (?, 'step_completed', ?, ?, 'planning')")
       ->execute([$notifUid, "{$user['name']} completed Step {$stepNumber}: {$step['step_name']} for \"{$pName}\" — needs approval", $projectId]);

    jsonResponse(['success' => true, 'message' => 'Step completed and locked']);
}

// ============================================
// UPDATE MECHANICAL CHECKLIST (Step 4)
// ============================================
function updateMechanical($user) {
    if ($user['role'] !== 'teamleader') {
        jsonResponse(['success' => false, 'message' => 'Only Team Leader can update checklist'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $field = $data['field'] ?? '';
    $value = (bool)($data['value'] ?? false);

    // Map camelCase (frontend) to snake_case (database)
    $fieldMap = [
        'basePlatesInstalled' => 'base_plates_installed',
        'uChannelInstalled' => 'u_channel_installed',
        'panelsInstalled' => 'panels_installed',
        'paintCivilComplete' => 'paint_civil_complete',
        // Also accept snake_case directly
        'base_plates_installed' => 'base_plates_installed',
        'u_channel_installed' => 'u_channel_installed',
        'panels_installed' => 'panels_installed',
        'paint_civil_complete' => 'paint_civil_complete',
    ];

    if (!isset($fieldMap[$field])) {
        jsonResponse(['success' => false, 'message' => 'Invalid checklist field: ' . $field], 400);
    }

    $dbField = $fieldMap[$field];

    // Check Mechanical step (9) is not completed
    $db = getDB();
    $stepStmt = $db->prepare("SELECT status FROM project_steps WHERE project_id = ? AND step_number = 9");
    $stepStmt->execute([$projectId]);
    $step = $stepStmt->fetch();

    if ($step && in_array($step['status'], ['completed', 'approved'])) {
        jsonResponse(['success' => false, 'message' => 'Mechanical checklist is locked after step completion'], 403);
    }

    // Insert or update
    $exists = $db->prepare("SELECT id FROM mechanical_checklist WHERE project_id = ?");
    $exists->execute([$projectId]);
    
    if ($exists->fetch()) {
        $db->prepare("UPDATE mechanical_checklist SET `{$dbField}` = ?, completed_by = ?, completed_at = NOW() WHERE project_id = ?")
           ->execute([$value ? 1 : 0, $user['name'], $projectId]);
    } else {
        $db->prepare("INSERT INTO mechanical_checklist (project_id, `{$dbField}`, completed_by, completed_at) VALUES (?, ?, ?, NOW())")
           ->execute([$projectId, $value ? 1 : 0, $user['name']]);
    }

    jsonResponse(['success' => true, 'message' => 'Checklist updated']);
}

// ============================================
// APPROVE/REJECT STEP FILE (Planning)
// ============================================
function approveStepFile($user) {
    if ($user['role'] !== 'planning') {
        jsonResponse(['success' => false, 'message' => 'Only Planning team can approve/reject files'], 403);
    }

    $data = getJsonInput();
    $fileId = $data['fileId'] ?? '';
    $approved = (bool)($data['approved'] ?? false);
    $note = $data['note'] ?? '';

    $db = getDB();
    $status = $approved ? 'approved' : 'rejected';

    $db->prepare("UPDATE project_files SET approval_status = ?, approval_note = ?, approved_at = NOW() WHERE uid = ?")
       ->execute([$status, $note, $fileId]);

    // Get file info to update step status
    $fileStmt = $db->prepare("SELECT * FROM project_files WHERE uid = ?");
    $fileStmt->execute([$fileId]);
    $file = $fileStmt->fetch();

    if ($file) {
        $stepStatus = $approved ? 'approved' : 'rejected';
        $db->prepare("UPDATE project_steps SET status = ? WHERE project_id = ? AND step_number = ?")
           ->execute([$stepStatus, $file['project_id'], $file['step_number']]);

        // If rejected, unlock step so team leader can redo
        if (!$approved) {
            $db->prepare("UPDATE project_steps SET is_locked = 0 WHERE project_id = ? AND step_number = ?")
               ->execute([$file['project_id'], $file['step_number']]);
        }

        // Notification for team leader
        $notifUid = generateUID();
        $projName = $db->prepare("SELECT name FROM projects WHERE uid = ?");
        $projName->execute([$file['project_id']]);
        $pName = $projName->fetch()['name'] ?? '';

        $msg = $approved 
            ? "Step {$file['step_number']} file approved for \"{$pName}\"" 
            : "Step {$file['step_number']} file REJECTED for \"{$pName}\": {$note}";

        $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role) VALUES (?, 'approval_needed', ?, ?, 'teamleader')")
           ->execute([$notifUid, $msg, $file['project_id']]);
    }

    jsonResponse(['success' => true, 'message' => "File {$status}"]);
}

// ============================================
// SET STEP DEADLINE (Planning Team)
// ============================================
function setStepDeadline($user) {
    if (!in_array($user['role'], ['planning', 'superadmin'])) {
        jsonResponse(['success' => false, 'message' => 'Only Planning team can set step deadlines'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $stepNumber = (int)($data['stepNumber'] ?? 0);
    $deadline = $data['deadline'] ?? '';

    if (empty($projectId) || $stepNumber < 1 || empty($deadline)) {
        jsonResponse(['success' => false, 'message' => 'projectId, stepNumber and deadline required'], 400);
    }

    // Validate date format
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $deadline)) {
        jsonResponse(['success' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD'], 400);
    }

    $db = getDB();

    // Check step exists
    $check = $db->prepare("SELECT id FROM project_steps WHERE project_id = ? AND step_number = ?");
    $check->execute([$projectId, $stepNumber]);
    if (!$check->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Step not found'], 404);
    }

    $stmt = $db->prepare("UPDATE project_steps SET step_deadline = ? WHERE project_id = ? AND step_number = ?");
    $stmt->execute([$deadline, $projectId, $stepNumber]);

    jsonResponse(['success' => true, 'message' => 'Step deadline updated']);
}

// ============================================
// SET DELAY REASON (Team Leader)
// ============================================
function setDelayReason($user) {
    if ($user['role'] !== 'teamleader') {
        jsonResponse(['success' => false, 'message' => 'Only Team Leader can set delay reason'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $stepNumber = (int)($data['stepNumber'] ?? 0);
    $reason = trim($data['reason'] ?? '');

    if (empty($projectId) || $stepNumber < 1 || empty($reason)) {
        jsonResponse(['success' => false, 'message' => 'projectId, stepNumber and reason required'], 400);
    }

    $db = getDB();
    $stmt = $db->prepare("UPDATE project_steps SET delay_reason = ? WHERE project_id = ? AND step_number = ?");
    $stmt->execute([$reason, $projectId, $stepNumber]);

    // Notify planning team
    $projStmt = $db->prepare("SELECT name FROM projects WHERE uid = ?");
    $projStmt->execute([$projectId]);
    $pName = $projStmt->fetch()['name'] ?? '';
    $stepStmt = $db->prepare("SELECT step_name FROM project_steps WHERE project_id = ? AND step_number = ?");
    $stepStmt->execute([$projectId, $stepNumber]);
    $sName = $stepStmt->fetch()['step_name'] ?? '';

    $notifUid = generateUID();
    $msg = "⚠️ Delay reported for \"{$pName}\" — Step {$stepNumber} ({$sName}): {$reason}";
    $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role) VALUES (?, 'deadline_warning', ?, ?, 'planning')")
       ->execute([$notifUid, $msg, $projectId]);

    jsonResponse(['success' => true, 'message' => 'Delay reason saved']);
}
