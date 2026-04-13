<?php
// ============================================
// SOLAR PROJECT TRACKING SYSTEM
// Database Configuration
// ============================================

// ===== CHANGE THESE TO YOUR SETTINGS =====
define('DB_HOST', 'localhost');
define('DB_NAME', 'u997308461_solar_tracking');
define('DB_USER', 'u997308461_Ammad');        
define('DB_PASS', 'zx12ASqw@#');            
define('DB_CHARSET', 'utf8mb4');
// ==========================================
// ===== CHANGE THESE TO YOUR SETTINGS =====
// define('DB_HOST', 'localhost');
// define('DB_NAME', 'solar_tracking');
// define('DB_USER', 'root');        
// define('DB_PASS', '');            
// define('DB_CHARSET', 'utf8mb4');
// ==========================================

// Upload settings
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB

// Timezone - Pakistan Standard Time (UTC+5)
define('APP_TIMEZONE', 'Asia/Karachi');

// Session settings
define('SESSION_DURATION', 86400 * 7); // 7 days

// CORS - Allow all origins (change for production)
define('FRONTEND_URL', '*');

// Create upload directory if not exists
$uploadDirs = [
    UPLOAD_DIR,
    UPLOAD_DIR . 'quotations/',
    UPLOAD_DIR . 'voice_notes/',
    UPLOAD_DIR . 'step_files/'
];
foreach ($uploadDirs as $dir) {
    if (!file_exists($dir)) {
        @mkdir($dir, 0777, true);
    }
}
