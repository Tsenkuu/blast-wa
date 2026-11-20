-- WA BLAST MANAGER PRO - MySQL Database Schema
-- Charset: utf8mb4, Engine: InnoDB

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_name VARCHAR(100) NOT NULL UNIQUE,
  phone_number VARCHAR(50),
  push_name VARCHAR(100),
  status ENUM('connecting', 'connected', 'disconnected', 'logged_out') DEFAULT 'disconnected',
  last_connected_at TIMESTAMP NULL,
  is_active TINYINT(1) DEFAULT 1,
  qr_code TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  can_broadcast TINYINT(1) DEFAULT 1,
  can_manage_excel TINYINT(1) DEFAULT 1,
  can_manage_sessions TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  notify_on_events TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_datasets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  total_rows INT DEFAULT 0,
  valid_rows INT DEFAULT 0,
  invalid_rows INT DEFAULT 0,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dataset_columns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dataset_id INT NOT NULL,
  column_letter VARCHAR(10) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  original_header VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES contact_datasets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dataset_id INT NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  name VARCHAR(150),
  notes TEXT,
  extra_data_json LONGTEXT,
  is_valid TINYINT(1) DEFAULT 1,
  validation_error VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dataset_phone (dataset_id, phone_number),
  FOREIGN KEY (dataset_id) REFERENCES contact_datasets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_consents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('granted', 'revoked') DEFAULT 'granted',
  source VARCHAR(100) DEFAULT 'import',
  consented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opt_outs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL UNIQUE,
  reason VARCHAR(255) DEFAULT 'user_requested',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  has_media TINYINT(1) DEFAULT 0,
  default_media_id INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcasts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  broadcast_code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  dataset_id INT NOT NULL,
  template_id INT NULL,
  custom_message MEDIUMTEXT NOT NULL,
  media_id INT NULL,
  delay_seconds INT DEFAULT 4,
  status ENUM('draft', 'queued', 'running', 'paused', 'completed', 'cancelled', 'failed') DEFAULT 'draft',
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  pending_count INT DEFAULT 0,
  scheduled_at TIMESTAMP NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  paused_at TIMESTAMP NULL,
  created_by_admin_id INT NULL,
  created_by_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES contact_datasets(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  broadcast_id INT NOT NULL,
  contact_id INT NULL,
  phone_number VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(150),
  personalized_message MEDIUMTEXT NOT NULL,
  status ENUM('pending', 'processing', 'sent', 'failed', 'skipped') DEFAULT 'pending',
  error_reason TEXT,
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  idempotency_key VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_broadcast_status (broadcast_id, status),
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outgoing_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  broadcast_id INT NULL,
  recipient_id INT NULL,
  phone_number VARCHAR(50) NOT NULL,
  message_type ENUM('text', 'image') DEFAULT 'text',
  content MEDIUMTEXT,
  media_path VARCHAR(255),
  status VARCHAR(50) DEFAULT 'sent',
  baileys_message_id VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_phone VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level ENUM('INFO', 'WARNING', 'ERROR', 'SUCCESS') DEFAULT 'INFO',
  module VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata_json LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_syslogs_level_time (level, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  details_json LONGTEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL UNIQUE,
  value_text TEXT NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
