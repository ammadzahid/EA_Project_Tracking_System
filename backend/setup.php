<?php
// ============================================
// SETUP - Create sessions table if not exists
// Run once: yourdomain.com/backend/setup.php
// ============================================

require_once __DIR__ . '/config.php';

header('Content-Type: text/html; charset=UTF-8');

try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ));

    // Create sessions table
    $pdo->exec("CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(64) UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    echo '<h2 style="color:green">Setup Complete!</h2>';
    echo '<p>sessions table created (or already exists)</p>';

    // Check users table
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM users");
    $count = $stmt->fetch();
    echo '<p>Total users in database: <strong>' . $count['total'] . '</strong></p>';

    // Show users (without passwords)
    $stmt2 = $pdo->query("SELECT id, uid, name, email, role, active, approved FROM users");
    $users = $stmt2->fetchAll();
    echo '<table border=1 cellpadding=5>';
    echo '<tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Approved</th></tr>';
    foreach ($users as $u) {
        echo '<tr>';
        echo '<td>' . $u['id'] . '</td>';
        echo '<td>' . htmlspecialchars($u['name']) . '</td>';
        echo '<td>' . htmlspecialchars($u['email']) . '</td>';
        echo '<td>' . htmlspecialchars($u['role']) . '</td>';
        echo '<td>' . ($u['active'] ? 'YES' : 'NO') . '</td>';
        echo '<td>' . ($u['approved'] ? 'YES' : '<strong style=color:red>NO - Not approved</strong>') . '</td>';
        echo '</tr>';
    }
    echo '</table>';
    echo '<br><p style="color:orange"><strong>IMPORTANT:</strong> Purane users ko approve karne ke liye niche ka SQL run karo phpMyAdmin mein:</p>';
    echo '<code style="background:#eee;padding:10px;display:block">UPDATE users SET approved = 1, active = 1 WHERE 1=1;</code>';
    echo '<p>Ya sirf specific users:</p>';
    echo '<code style="background:#eee;padding:10px;display:block">UPDATE users SET approved = 1 WHERE email = \'your@email.com\';</code>';

} catch (PDOException $e) {
    echo '<h2 style="color:red">Error!</h2>';
    echo '<p>' . $e->getMessage() . '</p>';
}