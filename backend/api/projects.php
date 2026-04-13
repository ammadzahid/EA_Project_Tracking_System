<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);



// ============================================
// PROJECTS API - CRUD + Status Management
// ============================================
require_once __DIR__ . '/../db.php';
setCorsHeaders();

$user = authenticateSession(true);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

switch ($method) {
    case 'GET':
        if ($action === 'list') listProjects($user);
        elseif ($action === 'get') getProject($user);
        break;
    case 'POST':
        if ($action === 'create') createProject($user);
        elseif ($action === 'approve') approveProject($user);
        elseif ($action === 'reject') rejectProject($user);
        elseif ($action === 'assign') assignProject($user);
        elseif ($action === 'accept') acceptProject($user);
        elseif ($action === 'reject_leader') rejectByLeader($user);
        elseif ($action === 'edit') editProject($user);
        elseif ($action === 'assign_worker') assignWorker($user);
        elseif ($action === 'delete') deleteProject($user);
        break;
    default:
        jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
}

// ============================================
// LIST ALL PROJECTS (filtered by role)
// ============================================
function listProjects($user) {
    $db = getDB();

    $query = "SELECT p.*, 
              (SELECT COUNT(*) FROM project_steps WHERE project_id = p.uid AND (status = 'completed' OR status = 'approved')) as completed_steps
              FROM projects p";
    $params = [];

    if ($user['role'] === 'selling') {
        $query .= " WHERE p.created_by = ?";
        $params[] = $user['uid'];
    } elseif ($user['role'] === 'teamleader') {
        $query .= " WHERE p.assigned_leader = ?";
        $params[] = $user['uid'];
    }

    $query .= " ORDER BY p.created_at DESC";
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $projects = $stmt->fetchAll();

    // Enrich with related data
    $result = [];
    foreach ($projects as $p) {
        $project = formatProject($p, $user);
        $result[] = $project;
    }

    jsonResponse(['success' => true, 'projects' => $result]);
}

// ============================================
// GET SINGLE PROJECT
// ============================================
function getProject($user) {
    $projectId = $_GET['id'] ?? '';
    if (empty($projectId)) {
        jsonResponse(['success' => false, 'message' => 'Project ID required'], 400);
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM projects WHERE uid = ?");
    $stmt->execute([$projectId]);
    $p = $stmt->fetch();

    if (!$p) {
        jsonResponse(['success' => false, 'message' => 'Project not found'], 404);
    }

    $project = formatProject($p, $user);
    jsonResponse(['success' => true, 'project' => $project]);
}

// ============================================
// CREATE NEW PROJECT (Selling Dept)
// ============================================
function createProject($user) {
    if (!in_array($user['role'], ['selling', 'superadmin'])) {
        jsonResponse(['success' => false, 'message' => 'Only Selling department can create projects'], 403);
    }

    $name = trim($_POST['name'] ?? '');
    $location = trim($_POST['location'] ?? '');
    $city = trim($_POST['city'] ?? '');
    $budget = floatval($_POST['budget'] ?? 0);
    $capacity = trim($_POST['capacity'] ?? '');
    $projectType = $_POST['projectType'] ?? 'Residential';
    $deadline = $_POST['deadline'] ?? '';
    $description = trim($_POST['description'] ?? '');

    // Validation
    if (empty($name) || empty($location) || empty($city) || $budget <= 0 || empty($capacity) || empty($deadline) || empty($description)) {
        jsonResponse(['success' => false, 'message' => 'All fields are required'], 400);
    }

    // Quotation for Admin is mandatory
    if (!isset($_FILES['quotation_admin']) || $_FILES['quotation_admin']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'message' => 'Quotation for Admin is mandatory!'], 400);
    }

    $db = getDB();
    $projectUid = generateUID();

    // Save Quotation for Admin
    $quotationAdminFile = $_FILES['quotation_admin'];
    if ($quotationAdminFile['size'] > MAX_FILE_SIZE) {
        jsonResponse(['success' => false, 'message' => 'Admin quotation file size must be under 50MB'], 400);
    }
    $ext = pathinfo($quotationAdminFile['name'], PATHINFO_EXTENSION);
    $quotationAdminFileName = 'quotation_' . $projectUid . '_' . time() . '.' . $ext;
    $quotationAdminPath = 'uploads/quotations/' . $quotationAdminFileName;
    move_uploaded_file($quotationAdminFile['tmp_name'], __DIR__ . '/../' . $quotationAdminPath);

    $fileUid = generateUID();
    $fileStmt = $db->prepare("
        INSERT INTO project_files (uid, project_id, file_name, file_path, file_type, file_size, file_category, uploaded_by) 
        VALUES (?, ?, ?, ?, ?, ?, 'quotation', ?)
    ");
    $fileStmt->execute([$fileUid, $projectUid, $quotationAdminFile['name'], $quotationAdminPath, $quotationAdminFile['type'], $quotationAdminFile['size'], $user['uid']]);

    // Save Quotation for Planning Team (optional)
    if (isset($_FILES['quotation_planning']) && $_FILES['quotation_planning']['error'] === UPLOAD_ERR_OK) {
        $quotationPlanningFile = $_FILES['quotation_planning'];
        if ($quotationPlanningFile['size'] > MAX_FILE_SIZE) {
            jsonResponse(['success' => false, 'message' => 'Planning quotation file size must be under 50MB'], 400);
        }
        $extP = pathinfo($quotationPlanningFile['name'], PATHINFO_EXTENSION);
        $quotationPlanningFileName = 'quotation_planning_' . $projectUid . '_' . time() . '.' . $extP;
        $quotationPlanningPath = 'uploads/quotations/' . $quotationPlanningFileName;
        move_uploaded_file($quotationPlanningFile['tmp_name'], __DIR__ . '/../' . $quotationPlanningPath);

        $filePlanningUid = generateUID();
        $filePlanningStmt = $db->prepare("
            INSERT INTO project_files (uid, project_id, file_name, file_path, file_type, file_size, file_category, uploaded_by) 
            VALUES (?, ?, ?, ?, ?, ?, 'quotation_planning', ?)
        ");
        $filePlanningStmt->execute([$filePlanningUid, $projectUid, $quotationPlanningFile['name'], $quotationPlanningPath, $quotationPlanningFile['type'], $quotationPlanningFile['size'], $user['uid']]);
    }

    // Save voice note if provided
    if (isset($_FILES['voiceNote']) && $_FILES['voiceNote']['error'] === UPLOAD_ERR_OK) {
        $voiceFile = $_FILES['voiceNote'];
        $voiceFileName = 'voice_' . $projectUid . '_' . time() . '.webm';
        $voicePath = 'uploads/voice_notes/' . $voiceFileName;
        move_uploaded_file($voiceFile['tmp_name'], __DIR__ . '/../' . $voicePath);

        $voiceUid = generateUID();
        $voiceStmt = $db->prepare("
            INSERT INTO project_files (uid, project_id, file_name, file_path, file_type, file_size, file_category, uploaded_by) 
            VALUES (?, ?, ?, ?, ?, ?, 'voice_note', ?)
        ");
        $voiceStmt->execute([$voiceUid, $projectUid, $voiceFile['name'] ?: 'voice_note.webm', $voicePath, 'audio/webm', $voiceFile['size'], $user['uid']]);
    }

    // Insert project
    $stmt = $db->prepare("
        INSERT INTO projects (uid, name, location, city, budget, capacity, project_type, deadline, description, status, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
    ");
    $stmt->execute([$projectUid, $name, $location, $city, $budget, $capacity, $projectType, $deadline, $description, $user['uid']]);

    // Create 16 steps (7 main + Execution parent + 8 sub-steps)
    $steps = [
        [1,  'Survey',                  'main', null],
        [2,  'Design',                  'main', null],
        [3,  'Material Demand',          'main', null],
        [4,  'Purchase Order',           'main', null],
        [5,  'Procurement',              'main', null],
        [6,  'Material Dispatch',        'main', null],
        [7,  'Material Delivered',       'main', null],
        [8,  'Execution',                'main', null],
        [9,  'Mechanical',               'sub',  8],
        [10, 'Civil',                    'sub',  8],
        [11, 'Electric',                 'sub',  8],
        [12, 'Earthing',                 'sub',  8],
        [13, 'Load Distribution',        'sub',  8],
        [14, 'Commissioning & Testing',  'sub',  8],
        [15, 'User Training & Reviews',  'sub',  8],
        [16, 'Documentation',            'sub',  8],
    ];

    $stepStmt = $db->prepare("INSERT INTO project_steps (project_id, step_number, step_name, step_type, parent_step, is_locked) VALUES (?, ?, ?, ?, ?, ?)");
    foreach ($steps as $i => $step) {
        // Step 1 unlocked, Execution (8) locked until step 7 done, sub-steps locked until Execution starts
        $locked = ($i === 0) ? 0 : 1;
        $stepStmt->execute([$projectUid, $step[0], $step[1], $step[2], $step[3], $locked]);
    }

    // Create mechanical checklist entry
    $db->prepare("INSERT INTO mechanical_checklist (project_id) VALUES (?)")->execute([$projectUid]);

    // Notify SuperAdmin of new project submission
    $notifUid = generateUID();
    $notifMsg = "📋 New Project Submitted — {$name} | City: {$city} | Capacity: {$capacity} | Type: {$projectType} | Budget: PKR " . number_format($budget) . " | Deadline: " . date('d M Y', strtotime($deadline)) . " | By: {$user['name']}";
    $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role, is_read, created_at) VALUES (?, 'new_project', ?, ?, 'superadmin', 0, NOW())")
       ->execute([$notifUid, $notifMsg, $projectUid]);

    jsonResponse(['success' => true, 'message' => 'Project created successfully', 'projectId' => $projectUid], 201);
}

// ============================================
// APPROVE PROJECT (Super Admin)
// ============================================
function approveProject($user) {
    if ($user['role'] !== 'superadmin') {
        jsonResponse(['success' => false, 'message' => 'Only Super Admin can approve'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';

    $db = getDB();
    $wo = generateWorkOrderNumber();

    $stmt = $db->prepare("UPDATE projects SET status = 'approved', approved_by = ?, approved_at = NOW(), work_order_number = ? WHERE uid = ? AND status = 'new'");
    $stmt->execute([$user['uid'], $wo, $projectId]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['success' => false, 'message' => 'Project not found or already processed'], 404);
    }

    // Get project details for notification
    $projStmt = $db->prepare("SELECT p.*, u.name as creator_name FROM projects p LEFT JOIN users u ON u.uid = p.created_by WHERE p.uid = ?");
    $projStmt->execute([$projectId]);
    $project = $projStmt->fetch();

    // Get planning quotation file if exists
    $planFileStmt = $db->prepare("SELECT * FROM project_files WHERE project_id = ? AND file_category = 'quotation_planning' LIMIT 1");
    $planFileStmt->execute([$projectId]);
    $planFile = $planFileStmt->fetch();

    // Build notification message with full detail
    $msg = "✅ New Project Approved — {$project['name']} | ";
    $msg .= "WO: {$wo} | ";
    $msg .= "City: {$project['city']} | ";
    $msg .= "Capacity: {$project['capacity']} | ";
    $msg .= "Type: {$project['project_type']} | ";
    $msg .= "Budget: PKR " . number_format($project['budget']) . " | ";
    $msg .= "Deadline: " . date('d M Y', strtotime($project['deadline']));
    if ($planFile) {
        $msg .= " | 📎 Planning Quotation: {$planFile['file_name']}";
    }

    // Save notification for planning role
    $notifUid = generateUID();
    $notifStmt = $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role, is_read, created_at) VALUES (?, 'approval_needed', ?, ?, 'planning', 0, NOW())");
    $notifStmt->execute([$notifUid, $msg, $projectId]);

    jsonResponse(['success' => true, 'message' => 'Project approved', 'workOrderNumber' => $wo]);
}

// ============================================
// REJECT PROJECT (Super Admin) — Reason saved
// ============================================
function rejectProject($user) {
    if ($user['role'] !== 'superadmin') {
        jsonResponse(['success' => false, 'message' => 'Only Super Admin can reject'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $reason = trim($data['reason'] ?? '');

    $db = getDB();
    $stmt = $db->prepare("UPDATE projects SET status = 'rejected', rejected_reason = ? WHERE uid = ? AND status = 'new'");
    $stmt->execute([$reason, $projectId]);

    // Notification
    $notifUid = generateUID();
    $projStmt = $db->prepare("SELECT name FROM projects WHERE uid = ?");
    $projStmt->execute([$projectId]);
    $proj = $projStmt->fetch();
    $projName = $proj ? $proj['name'] : 'Unknown';

    $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role) VALUES (?, 'project_accepted', ?, ?, 'selling')")
       ->execute([$notifUid, "Project \"{$projName}\" was rejected by Super Admin. Reason: {$reason}", $projectId]);

    jsonResponse(['success' => true, 'message' => 'Project rejected']);
}

// ============================================
// EDIT PROJECT (Super Admin — can edit even after approval)
// ============================================
function editProject($user) {
    if ($user['role'] !== 'superadmin') {
        jsonResponse(['success' => false, 'message' => 'Only Super Admin can edit projects'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $name = trim($data['name'] ?? '');
    $location = trim($data['location'] ?? '');
    $city = trim($data['city'] ?? '');
    $budget = floatval($data['budget'] ?? 0);
    $capacity = trim($data['capacity'] ?? '');
    $projectType = $data['projectType'] ?? 'Residential';
    $deadline = $data['deadline'] ?? '';
    $description = trim($data['description'] ?? '');

    if (empty($projectId) || empty($name)) {
        jsonResponse(['success' => false, 'message' => 'Project ID and name are required'], 400);
    }

    $db = getDB();

    // First check if project exists
    $check = $db->prepare("SELECT id FROM projects WHERE uid = ?");
    $check->execute([$projectId]);
    if (!$check->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Project not found'], 404);
        return;
    }

    $stmt = $db->prepare("UPDATE projects SET name = ?, location = ?, city = ?, budget = ?, capacity = ?, project_type = ?, deadline = ?, description = ? WHERE uid = ?");
    $stmt->execute([$name, $location, $city, $budget, $capacity, $projectType, $deadline, $description, $projectId]);

    jsonResponse(['success' => true, 'message' => 'Project updated successfully']);
}

// ============================================
// ASSIGN TEAM LEADER (Planning)
// ============================================
function assignProject($user) {
    if ($user['role'] !== 'planning') {
        jsonResponse(['success' => false, 'message' => 'Only Planning team can assign'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $leaderId = $data['leaderId'] ?? '';

    $db = getDB();

    // Get leader name
    $leaderStmt = $db->prepare("SELECT name FROM users WHERE uid = ? AND role = 'teamleader'");
    $leaderStmt->execute([$leaderId]);
    $leader = $leaderStmt->fetch();

    if (!$leader) {
        jsonResponse(['success' => false, 'message' => 'Team Leader not found'], 404);
    }

    $stmt = $db->prepare("UPDATE projects SET status = 'assigned', assigned_leader = ?, assigned_team = ?, assigned_at = NOW() WHERE uid = ? AND status = 'approved'");
    $stmt->execute([$leaderId, $leader['name'], $projectId]);

    // Notification for team leader
    $notifUid = generateUID();
    $projStmt = $db->prepare("SELECT name FROM projects WHERE uid = ?");
    $projStmt->execute([$projectId]);
    $proj = $projStmt->fetch();

    $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role) VALUES (?, 'project_assigned', ?, ?, 'teamleader')")
       ->execute([$notifUid, "New project assigned: \"{$proj['name']}\" - Please accept or reject.", $projectId]);

    jsonResponse(['success' => true, 'message' => 'Team Leader assigned']);
}

// ============================================
// ACCEPT PROJECT (Team Leader)
// ============================================
function acceptProject($user) {
    if ($user['role'] !== 'teamleader') {
        jsonResponse(['success' => false, 'message' => 'Only Team Leader can accept'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';

    $db = getDB();
    $stmt = $db->prepare("UPDATE projects SET status = 'accepted', accepted_at = NOW() WHERE uid = ? AND assigned_leader = ? AND status = 'assigned'");
    $stmt->execute([$projectId, $user['uid']]);

    // Notification for planning
    $notifUid = generateUID();
    $projStmt = $db->prepare("SELECT name FROM projects WHERE uid = ?");
    $projStmt->execute([$projectId]);
    $proj = $projStmt->fetch();

    $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role) VALUES (?, 'project_accepted', ?, ?, 'planning')")
       ->execute([$notifUid, "Team Leader {$user['name']} accepted \"{$proj['name']}\" at " . date('d M Y h:i A'), $projectId]);

    jsonResponse(['success' => true, 'message' => 'Project accepted']);
}

// ============================================
// REJECT BY TEAM LEADER
// ============================================
function rejectByLeader($user) {
    if ($user['role'] !== 'teamleader') {
        jsonResponse(['success' => false, 'message' => 'Only Team Leader can reject'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $reason = $data['reason'] ?? 'Not feasible';

    $db = getDB();
    $stmt = $db->prepare("UPDATE projects SET status = 'rejected', rejected_reason = ? WHERE uid = ? AND assigned_leader = ? AND status = 'assigned'");
    $stmt->execute([$reason, $projectId, $user['uid']]);

    // Notification
    $notifUid = generateUID();
    $projStmt = $db->prepare("SELECT name FROM projects WHERE uid = ?");
    $projStmt->execute([$projectId]);
    $proj = $projStmt->fetch();

    $db->prepare("INSERT INTO notifications (uid, type, message, project_id, for_role) VALUES (?, 'project_accepted', ?, ?, 'planning')")
       ->execute([$notifUid, "Team Leader {$user['name']} REJECTED \"{$proj['name']}\". Reason: $reason", $projectId]);

    jsonResponse(['success' => true, 'message' => 'Project rejected']);
}

// ============================================
// ASSIGN WORKER (Planning or Super Admin)
// ============================================
function assignWorker($user) {
    if (!in_array($user['role'], ['planning', 'superadmin'])) {
        jsonResponse(['success' => false, 'message' => 'Only Planning or Super Admin can assign workers'], 403);
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $workerId  = $data['workerId'] ?? '';

    if (empty($projectId) || empty($workerId)) {
        jsonResponse(['success' => false, 'message' => 'projectId and workerId are required'], 400);
    }

    $db = getDB();

    // Get worker name
    $workerStmt = $db->prepare("SELECT name FROM users WHERE uid = ? AND active = 1");
    $workerStmt->execute([$workerId]);
    $worker = $workerStmt->fetch();

    if (!$worker) {
        jsonResponse(['success' => false, 'message' => 'Worker not found'], 404);
    }

    $stmt = $db->prepare("UPDATE projects SET assigned_team = ? WHERE uid = ?");
    $stmt->execute([$worker['name'], $projectId]);

    jsonResponse(['success' => true, 'message' => 'Worker assigned: ' . $worker['name']]);
}

// ============================================
// FORMAT PROJECT WITH ALL RELATED DATA
// ============================================
function formatProject($p, $user) {
    $db = getDB();

    // Get steps
    $stepsStmt = $db->prepare("SELECT * FROM project_steps WHERE project_id = ? ORDER BY step_number");
    $stepsStmt->execute([$p['uid']]);
    $steps = $stepsStmt->fetchAll();

    // Get files
    $filesStmt = $db->prepare("SELECT * FROM project_files WHERE project_id = ? ORDER BY uploaded_at");
    $filesStmt->execute([$p['uid']]);
    $allFiles = $filesStmt->fetchAll();

    // Get BOQ
    $boqStmt = $db->prepare("SELECT * FROM boq_items WHERE project_id = ? ORDER BY id");
    $boqStmt->execute([$p['uid']]);
    $boqItems = $boqStmt->fetchAll();

    // Get BOQ Documents
    $boqDocsArr = [];
    try {
        $boqDocStmt = $db->prepare("SELECT * FROM boq_documents WHERE project_id = ? ORDER BY uploaded_at DESC");
        $boqDocStmt->execute([$p['uid']]);
        $boqDocsArr = $boqDocStmt->fetchAll();
    } catch (Exception $e) {
        // Table may not exist yet
        $boqDocsArr = [];
    }

    // Get todos
    $todoStmt = $db->prepare("SELECT * FROM todo_items WHERE project_id = ? ORDER BY created_at DESC");
    $todoStmt->execute([$p['uid']]);
    $todos = $todoStmt->fetchAll();

    // Get mechanical checklist
    $mechStmt = $db->prepare("SELECT * FROM mechanical_checklist WHERE project_id = ?");
    $mechStmt->execute([$p['uid']]);
    $mech = $mechStmt->fetch();

    // Format quotation for Admin (hidden from planning role)
    $quotationFile = null;
    if ($user['role'] !== 'planning') {
        foreach ($allFiles as $f) {
            if ($f['file_category'] === 'quotation') {
                $quotationFile = [
                    'id' => $f['uid'],
                    'name' => $f['file_name'],
                    'path' => $f['file_path'],
                    'type' => $f['file_type'],
                    'size' => (int)$f['file_size'],
                    'uploadedAt' => $f['uploaded_at'],
                ];
                break;
            }
        }
    }

    // Format quotation for Planning Team
    $quotationPlanningFile = null;
    foreach ($allFiles as $f) {
        if ($f['file_category'] === 'quotation_planning') {
            $quotationPlanningFile = [
                'id' => $f['uid'],
                'name' => $f['file_name'],
                'path' => $f['file_path'],
                'type' => $f['file_type'],
                'size' => (int)$f['file_size'],
                'uploadedAt' => $f['uploaded_at'],
            ];
            break;
        }
    }

    // Format voice note
    $voiceNote = null;
    foreach ($allFiles as $f) {
        if ($f['file_category'] === 'voice_note') {
            $voiceNote = [
                'id' => $f['uid'],
                'path' => $f['file_path'],
                'uploadedAt' => $f['uploaded_at'],
            ];
            break;
        }
    }

    // Format steps with their files
    $formattedSteps = [];
    foreach ($steps as $s) {
        $stepFiles = array_values(array_filter($allFiles, function($f) use ($s) {
            return $f['file_category'] === 'step_file' && (int)$f['step_number'] === (int)$s['step_number'];
        }));

        $formattedSteps[] = [
            'step' => (int)$s['step_number'],
            'name' => $s['step_name'],
            'type' => $s['step_type'] ?? 'main',
            'parentStep' => $s['parent_step'] ? (int)$s['parent_step'] : null,
            'status' => $s['status'],
            'description' => $s['description'],
            'notes' => $s['notes'],
            'locked' => (bool)$s['is_locked'],
            'completedAt' => $s['completed_at'],
            'stepDeadline' => $s['step_deadline'] ?? null,
            'delayReason' => $s['delay_reason'] ?? null,
            'files' => array_map(function($f) {
                return [
                    'id' => $f['uid'],
                    'name' => $f['file_name'],
                    'path' => $f['file_path'],
                    'type' => $f['file_type'],
                    'size' => (int)$f['file_size'],
                    'uploadedAt' => $f['uploaded_at'],
                    'approvalStatus' => $f['approval_status'],
                    'approvalNote' => $f['approval_note'],
                    'approvedAt' => $f['approved_at'],
                ];
            }, $stepFiles),
            'mechanicalChecklist' => (int)$s['step_number'] === 9 && $mech ? [
                'basePlatesInstalled' => (bool)$mech['base_plates_installed'],
                'uChannelInstalled' => (bool)$mech['u_channel_installed'],
                'panelsInstalled' => (bool)$mech['panels_installed'],
                'paintCivilComplete' => (bool)$mech['paint_civil_complete'],
                'completedBy' => $mech['completed_by'],
                'completedAt' => $mech['completed_at'],
            ] : null,
        ];
    }

    return [
        'id' => $p['uid'],
        'name' => $p['name'],
        'location' => $p['location'],
        'city' => $p['city'],
        'budget' => (float)$p['budget'],
        'capacity' => $p['capacity'],
        'projectType' => $p['project_type'],
        'deadline' => $p['deadline'],
        'description' => $p['description'],
        'status' => $p['status'],
        'createdBy' => $p['created_by'],
        'createdAt' => $p['created_at'],
        'approvedBy' => $p['approved_by'],
        'approvedAt' => $p['approved_at'],
        'assignedLeader' => $p['assigned_leader'],
        'assignedTeam' => $p['assigned_team'],
        'assignedAt' => $p['assigned_at'],
        'acceptedAt' => $p['accepted_at'],
        'rejectedReason' => $p['rejected_reason'],
        'workOrderNumber' => $p['work_order_number'],
        'quotationFile' => $quotationFile,
        'quotationPlanningFile' => $quotationPlanningFile,
        'voiceNote' => $voiceNote,
        'boq' => array_map(function($b) {
            return [
                'id' => $b['uid'],
                'description' => $b['description'],
                'unit' => $b['unit'],
                'quantity' => (float)$b['quantity'],
                'rate' => (float)$b['rate'],
                'amount' => (float)$b['amount'],
            ];
        }, $boqItems),
        'boqDocuments' => array_map(function($d) {
            return [
                'id' => $d['uid'],
                'name' => $d['name'],
                'type' => $d['type'] ?? '',
                'size' => (int)($d['size'] ?? 0),
                'uploadedAt' => $d['uploaded_at'],
                'uploadedBy' => $d['uploaded_by'],
                'uploadedByName' => $d['uploaded_by_name'] ?? '',
                'comment' => $d['comment'] ?? '',
            ];
        }, $boqDocsArr),
        'steps' => $formattedSteps,
        'todos' => array_map(function($t) {
            return [
                'id' => $t['uid'],
                'text' => $t['text'],
                'completed' => (bool)$t['completed'],
                'priority' => $t['priority'],
                'projectId' => $t['project_id'],
                'createdAt' => $t['created_at'],
            ];
        }, $todos),
        'completedSteps' => (int)($p['completed_steps'] ?? 0),
    ];
}

// ============================================
// DELETE PROJECT (superadmin only)
// ============================================
function deleteProject($user) {
    if ($user['role'] !== 'superadmin') {
        jsonResponse(['success' => false, 'message' => 'Forbidden'], 403);
        return;
    }

    $data = getJsonInput();
    $projectId = $data['projectId'] ?? '';

    if (empty($projectId)) {
        jsonResponse(['success' => false, 'message' => 'Project ID required'], 400);
        return;
    }

    $db = getDB();

    // Delete physical files from uploads folder
    $files = $db->prepare("SELECT file_path FROM project_files WHERE project_id = ?");
    $files->execute([$projectId]);
    foreach ($files->fetchAll() as $f) {
        if (!empty($f['file_path']) && file_exists($f['file_path'])) {
            @unlink($f['file_path']);
        }
    }

    // Delete BOQ document files too
    $boqFiles = $db->prepare("SELECT file_path FROM boq_documents WHERE project_id = ?");
    $boqFiles->execute([$projectId]);
    foreach ($boqFiles->fetchAll() as $f) {
        if (!empty($f['file_path']) && file_exists($f['file_path'])) {
            @unlink($f['file_path']);
        }
    }

    // Delete all related records (all project_id columns are VARCHAR storing uid)
    $db->prepare("DELETE FROM project_files WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM project_steps WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM mechanical_checklist WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM boq_items WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM boq_documents WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM todo_items WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM notifications WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM projects WHERE uid = ?")->execute([$projectId]);

    jsonResponse(['success' => true, 'message' => 'Project deleted successfully']);
}