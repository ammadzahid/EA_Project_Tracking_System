<?php
// ============================================
// TODOS API - Add, Toggle, Delete
// ============================================
require_once __DIR__ . '/../db.php';
setCorsHeaders();

$user = authenticateSession(true);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'add':
        addTodo($user);
        break;
    case 'toggle':
        toggleTodo($user);
        break;
    case 'delete':
        deleteTodo($user);
        break;
    default:
        jsonError('Invalid action: ' . $action, 400);
}

function addTodo($user) {
    $data      = getJsonInput();
    $projectId = $data['projectId'] ?? '';
    $text      = trim($data['text'] ?? '');
    $priority  = $data['priority'] ?? 'medium';

    if (empty($projectId) || empty($text)) {
        jsonError('projectId and text are required', 400);
    }

    if (!in_array($priority, array('low', 'medium', 'high'))) {
        $priority = 'medium';
    }

    $uid = generateUID('td');
    $db  = getDB();

    $stmt = $db->prepare("INSERT INTO todo_items (uid, project_id, user_id, text, completed, priority, created_at) VALUES (?, ?, ?, ?, 0, ?, NOW())");
    $stmt->execute(array($uid, $projectId, $user['uid'], $text, $priority));

    echo json_encode(array(
        'success' => true,
        'message' => 'Todo added',
        'todo' => array(
            'id'        => $uid,
            'text'      => $text,
            'completed' => false,
            'priority'  => $priority,
            'projectId' => $projectId,
        )
    ));
    exit();
}

function toggleTodo($user) {
    $data   = getJsonInput();
    $todoId = $data['todoId'] ?? '';

    if (empty($todoId)) {
        jsonError('todoId required', 400);
    }

    $db = getDB();
    $db->prepare("UPDATE todo_items SET completed = IF(completed = 1, 0, 1) WHERE uid = ?")->execute(array($todoId));

    echo json_encode(array('success' => true, 'message' => 'Todo toggled'));
    exit();
}

function deleteTodo($user) {
    $data   = getJsonInput();
    $todoId = $data['todoId'] ?? '';

    if (empty($todoId)) {
        jsonError('todoId required', 400);
    }

    $db = getDB();
    $db->prepare("DELETE FROM todo_items WHERE uid = ?")->execute(array($todoId));

    echo json_encode(array('success' => true, 'message' => 'Todo deleted'));
    exit();
}
