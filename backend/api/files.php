<?php
// ============================================
// FILES API - Download and Inline View
// ============================================
require_once __DIR__ . '/../db.php';

// No JSON content-type here — we serve binary files
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: " . $origin);
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Session-Token, Authorization");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action  = $_GET['action'] ?? 'view';
$fileId  = $_GET['id'] ?? '';
$token   = $_GET['token'] ?? $_SERVER['HTTP_X_SESSION_TOKEN'] ?? '';

// Authenticate
if (empty($token) || $token === 'test') {
    http_response_code(401);
    die('Unauthorized');
}

$db   = getDB();
$auth = $db->prepare("SELECT u.* FROM users u INNER JOIN sessions s ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > NOW() AND u.active = 1");
$auth->execute(array($token));
$user = $auth->fetch();

if (!$user) {
    http_response_code(401);
    die('Unauthorized - Invalid session');
}

if (empty($fileId)) {
    http_response_code(400);
    die('File ID required');
}

// Look in project_files first, then boq_documents
$file = null;

$stmt = $db->prepare("SELECT * FROM project_files WHERE uid = ?");
$stmt->execute(array($fileId));
$file = $stmt->fetch();

if (!$file) {
    $stmt2 = $db->prepare("SELECT uid, name as file_name, file_path, type as file_type, size as file_size FROM boq_documents WHERE uid = ?");
    $stmt2->execute(array($fileId));
    $file = $stmt2->fetch();
}

if (!$file) {
    http_response_code(404);
    die('File not found');
}

$filePath = __DIR__ . '/../' . $file['file_path'];

if (!file_exists($filePath)) {
    http_response_code(404);
    die('File not found on server');
}

$mimeType = $file['file_type'] ?: mime_content_type($filePath) ?: 'application/octet-stream';
$fileName = $file['file_name'] ?: basename($filePath);
$fileSize = filesize($filePath);

header('Content-Type: ' . $mimeType);
header('Content-Length: ' . $fileSize);
header('Cache-Control: private, max-age=3600');

if ($action === 'download') {
    header('Content-Disposition: attachment; filename="' . addslashes($fileName) . '"');
} else {
    // Inline view - browser renders it
    header('Content-Disposition: inline; filename="' . addslashes($fileName) . '"');
}

readfile($filePath);
exit();
