<?php
// ============================================
// DATABASE CONNECTION & HELPER FUNCTIONS
// ============================================

require_once __DIR__ . '/config.php';

// Set Pakistan timezone globally
date_default_timezone_set('Asia/Karachi');

// Get PDO Database Connection
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, array(
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ));
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(array('success' => false, 'error' => 'DB connection failed: ' . $e->getMessage())));
        }
    }
    return $pdo;
}

// Set CORS Headers
function setCorsHeaders() {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, X-Session-Token, Authorization");
    header("Access-Control-Allow-Credentials: true");
    header("Content-Type: application/json; charset=UTF-8");
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}

// JSON Success Response
function jsonSuccess($data, $message) {
    if ($message === null) $message = 'Success';
    echo json_encode(array('success' => true, 'message' => $message, 'data' => $data));
    exit();
}

// JSON Error Response
function jsonError($message, $code) {
    if ($message === null) $message = 'Error';
    if ($code === null) $code = 400;
    http_response_code($code);
    echo json_encode(array('success' => false, 'error' => $message));
    exit();
}

// Session Authentication - users table uses 'active' column
function authenticateSession($required = true) {
    if ($required === null) $required = true;
    $token = isset($_SERVER['HTTP_X_SESSION_TOKEN']) ? $_SERVER['HTTP_X_SESSION_TOKEN'] : '';
    if (empty($token)) $token = isset($_GET['token']) ? $_GET['token'] : '';

    if (empty($token) || $token === 'test') {
        if ($required) {
            jsonError('Unauthorized - No valid session', 401);
        }
        return null;
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT u.* FROM users u INNER JOIN sessions s ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > NOW() AND u.active = 1");
    $stmt->execute(array($token));
    $user = $stmt->fetch();

    if (!$user) {
        if ($required) {
            jsonError('Unauthorized - Invalid or expired session', 401);
        }
        return null;
    }

    return $user;
}

// Get JSON Request Body
function getRequestBody() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    return $data ? $data : array();
}

// Alias used across API files
function getJsonInput() {
    return getRequestBody();
}
// Generate unique ID for records
function generateUID($prefix = 't') {
    return $prefix . substr(md5(uniqid(mt_rand(), true)), 0, 13);
}

// Generate work order number
function generateWorkOrderNumber() {
    $db = getDB();
    $year = date('Y');
    $stmt = $db->prepare("SELECT COUNT(*) FROM projects WHERE YEAR(created_at) = ?");
    $stmt->execute(array($year));
    $count = (int)$stmt->fetchColumn();
    return 'WO-' . $year . '-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);
}

// Output JSON response
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}
