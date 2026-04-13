<?php
// ============================================
// AUTH API - Login, Signup, Session, Logout
// ============================================

require_once __DIR__ . '/../db.php';
setCorsHeaders();

$action = isset($_GET['action']) ? $_GET['action'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// ---- SESSION CHECK (GET) ----
if ($action === 'session') {
    $token = isset($_SERVER['HTTP_X_SESSION_TOKEN']) ? $_SERVER['HTTP_X_SESSION_TOKEN'] : '';
    if (empty($token) || $token === 'test') {
        echo json_encode(array('success' => false, 'error' => 'No session'));
        exit();
    }
    $db = getDB();
    // Check if sessions table exists
    $stmt = $db->prepare("SELECT u.uid AS id, u.name, u.email, u.role, u.active, u.approved FROM users u INNER JOIN sessions s ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > NOW() AND u.active = 1");
    $stmt->execute(array($token));
    $user = $stmt->fetch();
    if (!$user) {
        echo json_encode(array('success' => false, 'error' => 'Invalid or expired session'));
        exit();
    }
    echo json_encode(array('success' => true, 'user' => $user));
    exit();
}

// ---- LOGIN (POST) ----
if ($action === 'login' && $method === 'POST') {
    $data = getRequestBody();
    $email = isset($data['email']) ? trim($data['email']) : '';
    $password = isset($data['password']) ? $data['password'] : '';

    if (empty($email) || empty($password)) {
        jsonError('Email and password are required', 400);
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND active = 1");
    $stmt->execute(array($email));
    $user = $stmt->fetch();

    if (!$user) {
        jsonError('Invalid email or password', 401);
    }

    if (!password_verify($password, $user['password'])) {
        jsonError('Invalid email or password', 401);
    }

    if (!$user['approved']) {
        jsonError('Your account is pending admin approval', 403);
    }

    // Create session token
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+7 days'));
    $stmt2 = $db->prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt2->execute(array($user['id'], $token, $expires));

    // Update last login
    $stmt3 = $db->prepare("UPDATE users SET updated_at = NOW() WHERE id = ?");
    $stmt3->execute(array($user['id']));

    // Return uid as id so frontend uses uid consistently
    $userResponse = array(
        'id'       => $user['uid'],
        'name'     => $user['name'],
        'email'    => $user['email'],
        'role'     => $user['role'],
        'active'   => $user['active'],
        'approved' => $user['approved'],
    );
    echo json_encode(array(
        'success' => true,
        'token' => $token,
        'user' => $userResponse
    ));
    exit();
}

// ---- SIGNUP (POST) ----
if ($action === 'signup' && $method === 'POST') {
    $data = getRequestBody();
    $name = isset($data['name']) ? trim($data['name']) : '';
    $email = isset($data['email']) ? trim(strtolower($data['email'])) : '';
    $password = isset($data['password']) ? $data['password'] : '';
    $role = isset($data['role']) ? trim($data['role']) : 'Team Member';

    if (empty($name) || empty($email) || empty($password)) {
        jsonError('Name, email and password are required', 400);
    }

    if (strlen($password) < 6) {
        jsonError('Password must be at least 6 characters', 400);
    }

    $db = getDB();

    // Check if email exists
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute(array($email));
    if ($stmt->fetch()) {
        jsonError('Email already registered', 409);
    }

    // Generate unique uid
    $uid = 'USR' . strtoupper(substr(md5(uniqid()), 0, 8));
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $stmt2 = $db->prepare("INSERT INTO users (uid, name, email, password, role, active, approved, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, NOW())");
    $stmt2->execute(array($uid, $name, $email, $hashedPassword, $role));

    echo json_encode(array(
        'success' => true,
        'message' => 'Account request submitted. Waiting for admin approval.'
    ));
    exit();
}

// ---- LOGOUT (POST) ----
if ($action === 'logout' && $method === 'POST') {
    $token = isset($_SERVER['HTTP_X_SESSION_TOKEN']) ? $_SERVER['HTTP_X_SESSION_TOKEN'] : '';
    if (!empty($token)) {
        $db = getDB();
        $stmt = $db->prepare("DELETE FROM sessions WHERE token = ?");
        $stmt->execute(array($token));
    }
    echo json_encode(array('success' => true, 'message' => 'Logged out'));
    exit();
}

// ---- GET ALL USERS (Admin only) ----
if ($action === 'users' && $method === 'GET') {
    $user = authenticateSession(true);
    if ($user['role'] !== 'superadmin') {
        jsonError('Forbidden', 403);
    }
    $db = getDB();
    $stmt = $db->prepare("SELECT id, uid, name, email, role, active, approved, created_at FROM users ORDER BY created_at DESC");
    $stmt->execute();
    $users = $stmt->fetchAll();
    echo json_encode(array('success' => true, 'data' => $users));
    exit();
}

// ---- APPROVE USER (Admin only) ----
if ($action === 'approve' && $method === 'POST') {
    $user = authenticateSession(true);
    if ($user['role'] !== 'superadmin') {
        jsonError('Forbidden', 403);
    }
    $data = getRequestBody();
    $userId = isset($data['user_id']) ? intval($data['user_id']) : 0;
    if (!$userId) {
        jsonError('User ID required', 400);
    }
    $db = getDB();
    $stmt = $db->prepare("UPDATE users SET approved = 1, active = 1 WHERE id = ?");
    $stmt->execute(array($userId));
    echo json_encode(array('success' => true, 'message' => 'User approved'));
    exit();
}

// ---- Default ----
echo json_encode(array('success' => false, 'error' => 'Invalid action: ' . $action));