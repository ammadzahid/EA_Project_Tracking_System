<?php
// ============================================
// USERS API - List, Create, Update, Approve, Toggle, Delete
// ============================================
require_once __DIR__ . '/../db.php';
setCorsHeaders();

$user = authenticateSession(true);

$action = $_GET['action'] ?? '';

// Planning role can only fetch leaders list
if ($user['role'] !== 'superadmin') {
    if ($action === 'leaders') {
        listLeaders();
        exit();
    }
    jsonError('Forbidden', 403);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'list':
        listUsers();
        break;
    case 'leaders':
        listLeaders();
        break;
    case 'create':
        createUser();
        break;
    case 'update':
        updateUser();
        break;
    case 'approve':
        approveUser();
        break;
    case 'toggle':
        toggleUser();
        break;
    case 'delete':
        deleteUser();
        break;
    default:
        jsonError('Invalid action: ' . $action, 400);
}

function listUsers() {
    $db = getDB();
    $stmt = $db->prepare("SELECT uid AS id, name, email, role, active, approved, created_at FROM users ORDER BY created_at DESC");
    $stmt->execute();
    $users = $stmt->fetchAll();
    echo json_encode(array('success' => true, 'users' => $users));
    exit();
}

function listLeaders() {
    $db = getDB();
    $stmt = $db->prepare("SELECT uid AS id, name, email, role FROM users WHERE role = 'teamleader' AND active = 1 AND approved = 1 ORDER BY name");
    $stmt->execute();
    $leaders = $stmt->fetchAll();
    echo json_encode(array('success' => true, 'leaders' => $leaders));
    exit();
}

function createUser() {
    $data = getJsonInput();
    $name     = trim($data['name'] ?? '');
    $email    = trim(strtolower($data['email'] ?? ''));
    $password = $data['password'] ?? '';
    $role     = $data['role'] ?? 'selling';

    if (empty($name) || empty($email) || empty($password)) {
        jsonError('Name, email and password are required', 400);
    }

    if (strlen($password) < 6) {
        jsonError('Password must be at least 6 characters', 400);
    }

    $db = getDB();

    $check = $db->prepare("SELECT id FROM users WHERE email = ?");
    $check->execute(array($email));
    if ($check->fetch()) {
        jsonError('Email already registered', 409);
    }

    $uid = 'USR' . strtoupper(substr(md5(uniqid()), 0, 8));
    $hashed = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare("INSERT INTO users (uid, name, email, password, role, active, approved, created_at) VALUES (?, ?, ?, ?, ?, 1, 1, NOW())");
    $stmt->execute(array($uid, $name, $email, $hashed, $role));

    echo json_encode(array('success' => true, 'message' => 'User created successfully', 'uid' => $uid));
    exit();
}

function updateUser() {
    $data = getJsonInput();
    $userId   = $data['id'] ?? '';
    $name     = trim($data['name'] ?? '');
    $email    = trim(strtolower($data['email'] ?? ''));
    $role     = $data['role'] ?? '';
    $password = $data['password'] ?? '';

    if (empty($userId) || empty($name) || empty($email)) {
        jsonError('User ID, name and email are required', 400);
    }

    $db = getDB();

    // Check email not taken by another user
    $check = $db->prepare("SELECT id FROM users WHERE email = ? AND uid != ?");
    $check->execute(array($email, $userId));
    if ($check->fetch()) {
        jsonError('Email already in use by another user', 409);
    }

    if (!empty($password)) {
        if (strlen($password) < 6) {
            jsonError('Password must be at least 6 characters', 400);
        }
        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE users SET name = ?, email = ?, role = ?, password = ? WHERE uid = ?");
        $stmt->execute(array($name, $email, $role, $hashed, $userId));
    } else {
        $stmt = $db->prepare("UPDATE users SET name = ?, email = ?, role = ? WHERE uid = ?");
        $stmt->execute(array($name, $email, $role, $userId));
    }

    echo json_encode(array('success' => true, 'message' => 'User updated successfully'));
    exit();
}

function approveUser() {
    $data = getJsonInput();
    $userId = $data['userId'] ?? '';

    if (empty($userId)) {
        jsonError('User ID required', 400);
    }

    $db = getDB();
    $stmt = $db->prepare("UPDATE users SET approved = 1, active = 1 WHERE uid = ?");
    $stmt->execute(array($userId));

    echo json_encode(array('success' => true, 'message' => 'User approved'));
    exit();
}

function toggleUser() {
    $data = getJsonInput();
    $userId = $data['userId'] ?? '';

    if (empty($userId)) {
        jsonError('User ID required', 400);
    }

    $db = getDB();
    $stmt = $db->prepare("UPDATE users SET active = IF(active = 1, 0, 1) WHERE uid = ?");
    $stmt->execute(array($userId));

    echo json_encode(array('success' => true, 'message' => 'User status toggled'));
    exit();
}

function deleteUser() {
    $data = getJsonInput();
    $userId = $data['userId'] ?? '';

    if (empty($userId)) {
        jsonError('User ID required', 400);
    }

    $db = getDB();
    // Delete sessions first
    $db->prepare("DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE uid = ?)")->execute(array($userId));
    $stmt = $db->prepare("DELETE FROM users WHERE uid = ?");
    $stmt->execute(array($userId));

    echo json_encode(array('success' => true, 'message' => 'User deleted'));
    exit();
}
