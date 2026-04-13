-- ============================================
-- SOLAR PROJECT TRACKING SYSTEM
-- Complete MySQL Database Schema
-- Run: http://localhost/backend/setup.php
-- ============================================

CREATE DATABASE IF NOT EXISTS solar_tracking;
USE solar_tracking;

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('selling','superadmin','planning','teamleader') NOT NULL,
    active TINYINT(1) DEFAULT 1,
    approved TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    location VARCHAR(300) NOT NULL,
    city VARCHAR(100) NOT NULL,
    budget DECIMAL(15,2) NOT NULL DEFAULT 0,
    capacity VARCHAR(50) NOT NULL,
    project_type ENUM('Residential','Commercial','Industrial','Agricultural') NOT NULL DEFAULT 'Residential',
    deadline DATE NOT NULL,
    description TEXT NOT NULL,
    status ENUM('new','approved','assigned','accepted','in_progress','completed','rejected') DEFAULT 'new',
    created_by VARCHAR(50) NOT NULL,
    approved_by VARCHAR(50) DEFAULT NULL,
    approved_at TIMESTAMP NULL,
    assigned_leader VARCHAR(50) DEFAULT NULL,
    assigned_team VARCHAR(100) DEFAULT NULL,
    assigned_at TIMESTAMP NULL,
    accepted_at TIMESTAMP NULL,
    rejected_reason TEXT DEFAULT NULL,
    work_order_number VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_assigned_leader (assigned_leader)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PROJECT FILES
CREATE TABLE IF NOT EXISTS project_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    project_id VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) DEFAULT NULL,
    file_size INT DEFAULT 0,
    file_category ENUM('quotation','voice_note','step_file') DEFAULT 'step_file',
    step_number INT DEFAULT NULL,
    approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
    approval_note TEXT DEFAULT NULL,
    approved_at TIMESTAMP NULL,
    uploaded_by VARCHAR(50) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project (project_id),
    INDEX idx_step (step_number),
    INDEX idx_approval (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PROJECT STEPS
CREATE TABLE IF NOT EXISTS project_steps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    step_number INT NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    step_type ENUM('main','sub') DEFAULT 'main',
    parent_step INT DEFAULT NULL,
    status ENUM('pending','in_progress','completed','approved','rejected') DEFAULT 'pending',
    description TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    step_deadline DATE DEFAULT NULL,
    delay_reason TEXT DEFAULT NULL,
    is_locked TINYINT(1) DEFAULT 1,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_project_step (project_id, step_number),
    INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migration: Add new columns if table already exists
-- ALTER TABLE project_steps ADD COLUMN IF NOT EXISTS step_type ENUM('main','sub') DEFAULT 'main';
-- ALTER TABLE project_steps ADD COLUMN IF NOT EXISTS parent_step INT DEFAULT NULL;
-- ALTER TABLE project_steps ADD COLUMN IF NOT EXISTS step_deadline DATE DEFAULT NULL;

-- MECHANICAL CHECKLIST
CREATE TABLE IF NOT EXISTS mechanical_checklist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    base_plates_installed TINYINT(1) DEFAULT 0,
    u_channel_installed TINYINT(1) DEFAULT 0,
    panels_installed TINYINT(1) DEFAULT 0,
    paint_civil_complete TINYINT(1) DEFAULT 0,
    completed_by VARCHAR(100) DEFAULT NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- BOQ ITEMS
CREATE TABLE IF NOT EXISTS boq_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    project_id VARCHAR(50) NOT NULL,
    description VARCHAR(300) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    rate DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- BOQ DOCUMENTS
CREATE TABLE IF NOT EXISTS boq_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    project_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    type VARCHAR(100),
    size INT DEFAULT 0,
    uploaded_by VARCHAR(50),
    uploaded_by_name VARCHAR(255),
    comment TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TODO ITEMS
CREATE TABLE IF NOT EXISTS todo_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    project_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    text VARCHAR(500) NOT NULL,
    completed TINYINT(1) DEFAULT 0,
    priority ENUM('low','medium','high') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project (project_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    project_id VARCHAR(50) DEFAULT NULL,
    for_role ENUM('selling','superadmin','planning','teamleader') NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_role (for_role),
    INDEX idx_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    INDEX idx_token (session_token),
    INDEX idx_user (user_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
