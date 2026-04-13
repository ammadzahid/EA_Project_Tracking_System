<?php
// ============================================
// BOQ API - Add, Update, Remove Items + Documents
// ============================================
require_once __DIR__ . '/../db.php';
setCorsHeaders();

$user = authenticateSession(true);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'add':
        addItem($user);
        break;
    case 'update':
        updateItem($user);
        break;
    case 'remove':
        removeItem($user);
        break;
    case 'upload_doc':
        uploadDocument($user);
        break;
    case 'update_doc':
        updateDocument($user);
        break;
    case 'remove_doc':
        removeDocument($user);
        break;
    default:
        jsonError('Invalid action: ' . $action, 400);
}

function addItem($user) {
    if (!in_array($user['role'], ['planning', 'superadmin'])) {
        jsonError('Only Planning or Super Admin can add BOQ items', 403);
    }

    $data = getJsonInput();
    $projectId   = $data['projectId'] ?? '';
    $description = trim($data['description'] ?? '');
    $unit        = trim($data['unit'] ?? 'pcs');
    $quantity    = floatval($data['quantity'] ?? 0);
    $rate        = floatval($data['rate'] ?? 0);

    if (empty($projectId) || empty($description) || $quantity <= 0 || $rate < 0) {
        jsonError('projectId, description, quantity and rate are required', 400);
    }

    $amount = $quantity * $rate;
    $uid = generateUID('b');

    $db = getDB();
    $stmt = $db->prepare("INSERT INTO boq_items (uid, project_id, description, unit, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute(array($uid, $projectId, $description, $unit, $quantity, $rate, $amount));

    echo json_encode(array('success' => true, 'message' => 'BOQ item added', 'id' => $uid, 'amount' => $amount));
    exit();
}

function updateItem($user) {
    if (!in_array($user['role'], ['planning', 'superadmin'])) {
        jsonError('Only Planning or Super Admin can update BOQ items', 403);
    }

    $data = getJsonInput();
    $itemId      = $data['itemId'] ?? '';
    $description = trim($data['description'] ?? '');
    $unit        = trim($data['unit'] ?? 'pcs');
    $quantity    = floatval($data['quantity'] ?? 0);
    $rate        = floatval($data['rate'] ?? 0);

    if (empty($itemId) || empty($description)) {
        jsonError('itemId and description are required', 400);
    }

    $amount = $quantity * $rate;

    $db = getDB();
    $stmt = $db->prepare("UPDATE boq_items SET description = ?, unit = ?, quantity = ?, rate = ?, amount = ? WHERE uid = ?");
    $stmt->execute(array($description, $unit, $quantity, $rate, $amount, $itemId));

    echo json_encode(array('success' => true, 'message' => 'BOQ item updated', 'amount' => $amount));
    exit();
}

function removeItem($user) {
    if (!in_array($user['role'], ['planning', 'superadmin'])) {
        jsonError('Only Planning or Super Admin can remove BOQ items', 403);
    }

    $data = getJsonInput();
    $itemId = $data['itemId'] ?? '';

    if (empty($itemId)) {
        jsonError('itemId required', 400);
    }

    $db = getDB();
    $db->prepare("DELETE FROM boq_items WHERE uid = ?")->execute(array($itemId));

    echo json_encode(array('success' => true, 'message' => 'BOQ item removed'));
    exit();
}

function uploadDocument($user) {
    if (!in_array($user['role'], ['planning', 'superadmin'])) {
        jsonError('Only Planning or Super Admin can upload BOQ documents', 403);
    }

    $projectId = $_POST['projectId'] ?? '';
    $comment   = $_POST['comment'] ?? '';

    if (empty($projectId)) {
        jsonError('projectId required', 400);
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        jsonError('File upload required', 400);
    }

    $file = $_FILES['file'];
    if ($file['size'] > MAX_FILE_SIZE) {
        jsonError('File too large (max 50MB)', 400);
    }

    // Ensure boq_documents upload directory exists
    $boqDir = UPLOAD_DIR . 'boq_documents/';
    if (!file_exists($boqDir)) {
        @mkdir($boqDir, 0777, true);
    }

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $safeExt = preg_replace('/[^a-zA-Z0-9]/', '', $ext);
    $uid = generateUID('d');
    $fileName = 'boq_' . $uid . '_' . time() . '.' . $safeExt;
    $filePath = 'uploads/boq_documents/' . $fileName;

    if (!move_uploaded_file($file['tmp_name'], __DIR__ . '/../' . $filePath)) {
        jsonError('Failed to save file on server', 500);
    }

    $db = getDB();
    $stmt = $db->prepare("INSERT INTO boq_documents (uid, project_id, name, file_path, type, size, uploaded_by, uploaded_by_name, comment, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute(array($uid, $projectId, $file['name'], $filePath, $file['type'], $file['size'], $user['uid'], $user['name'], $comment));

    echo json_encode(array(
        'success' => true,
        'message' => 'Document uploaded',
        'doc' => array(
            'id'             => $uid,
            'name'           => $file['name'],
            'type'           => $file['type'],
            'size'           => (int)$file['size'],
            'comment'        => $comment,
            'uploadedBy'     => $user['uid'],
            'uploadedByName' => $user['name'],
        )
    ));
    exit();
}

function updateDocument($user) {
    if (!in_array($user['role'], ['planning', 'superadmin'])) {
        jsonError('Only Planning or Super Admin can update BOQ documents', 403);
    }

    $data    = getJsonInput();
    $docId   = $data['docId'] ?? '';
    $comment = $data['comment'] ?? '';

    if (empty($docId)) {
        jsonError('docId required', 400);
    }

    $db = getDB();
    $db->prepare("UPDATE boq_documents SET comment = ? WHERE uid = ?")->execute(array($comment, $docId));

    echo json_encode(array('success' => true, 'message' => 'Document updated'));
    exit();
}

function removeDocument($user) {
    if (!in_array($user['role'], ['planning', 'superadmin'])) {
        jsonError('Only Planning or Super Admin can remove BOQ documents', 403);
    }

    $data  = getJsonInput();
    $docId = $data['docId'] ?? '';

    if (empty($docId)) {
        jsonError('docId required', 400);
    }

    $db = getDB();

    // Get file path to delete from disk
    $stmt = $db->prepare("SELECT file_path FROM boq_documents WHERE uid = ?");
    $stmt->execute(array($docId));
    $doc = $stmt->fetch();

    if ($doc) {
        $fullPath = __DIR__ . '/../' . $doc['file_path'];
        if (file_exists($fullPath)) {
            @unlink($fullPath);
        }
    }

    $db->prepare("DELETE FROM boq_documents WHERE uid = ?")->execute(array($docId));

    echo json_encode(array('success' => true, 'message' => 'Document removed'));
    exit();
}
