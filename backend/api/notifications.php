<?php
// ============================================
// NOTIFICATIONS API
// ============================================
require_once __DIR__ . '/../db.php';
setCorsHeaders();

$user = authenticateSession();
$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':
        listNotifications($user);
        break;
    case 'read':
        markRead($user);
        break;
    case 'read_all':
        markAllRead($user);
        break;
    default:
        jsonResponse(['success' => false, 'message' => 'Invalid action'], 400);
}

function listNotifications($user) {
    $db = getDB();
    $stmt = $db->prepare("SELECT uid as id, type, message, project_id as projectId, for_role as forRole, is_read as `read`, created_at as createdAt FROM notifications WHERE for_role = ? ORDER BY created_at DESC LIMIT 100");
    $stmt->execute([$user['role']]);
    jsonResponse(['success' => true, 'notifications' => $stmt->fetchAll()]);
}

function markRead($user) {
    $data = getJsonInput();
    $db = getDB();
    $db->prepare("UPDATE notifications SET is_read = 1 WHERE uid = ? AND for_role = ?")
       ->execute([$data['notificationId'], $user['role']]);
    jsonResponse(['success' => true, 'message' => 'Marked as read']);
}

function markAllRead($user) {
    $db = getDB();
    $db->prepare("UPDATE notifications SET is_read = 1 WHERE for_role = ? AND is_read = 0")
       ->execute([$user['role']]);
    jsonResponse(['success' => true, 'message' => 'All marked as read']);
}
