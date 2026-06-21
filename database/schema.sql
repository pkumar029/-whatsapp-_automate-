-- ============================================================
-- WhatsApp Automate — MySQL Database Schema v1.0
-- ============================================================
-- Run: mysql -u root -p whatsapp_automate < schema.sql
-- ============================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS `whatsapp_automate`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `whatsapp_automate`;

-- ─── Drop tables in safe order ──────────────────────────────
DROP TABLE IF EXISTS `automation_logs`;
DROP TABLE IF EXISTS `automation_steps`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `automations`;
DROP TABLE IF EXISTS `contacts`;
DROP TABLE IF EXISTS `whatsapp_sessions`;
DROP TABLE IF EXISTS `users`;


-- ============================================================
-- TABLE: users
-- Application users who manage the WhatsApp automation system
-- ============================================================
CREATE TABLE `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(100) NOT NULL,
  `email`         VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `is_admin`      TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: whatsapp_sessions
-- WhatsApp connection state and session metadata
-- ============================================================
CREATE TABLE `whatsapp_sessions` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`          INT UNSIGNED NULL,
  `phone`            VARCHAR(20) NULL,
  `status`           ENUM('connected','disconnected','connecting','expired')
                       NOT NULL DEFAULT 'disconnected',
  `session_data`     JSON NULL COMMENT 'Serialized session credentials',
  `qr_code`          TEXT NULL COMMENT 'Base64-encoded QR code image',
  `connected_at`     DATETIME NULL,
  `disconnected_at`  DATETIME NULL,
  `error_message`    TEXT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_status` (`status`),
  KEY `idx_session_phone` (`phone`),
  CONSTRAINT `fk_session_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: contacts
-- WhatsApp contacts managed in the platform
-- ============================================================
CREATE TABLE `contacts` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100) NOT NULL,
  `phone`        VARCHAR(20) NOT NULL COMMENT 'E.164 format: +919876543210',
  `email`        VARCHAR(150) NULL,
  `notes`        TEXT NULL,
  `tags`         JSON NULL COMMENT 'Array of tag strings',
  `is_active`    TINYINT(1) NOT NULL DEFAULT 1,
  `is_blocked`   TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contacts_phone` (`phone`),
  KEY `idx_contacts_name` (`name`),
  KEY `idx_contacts_active` (`is_active`),
  KEY `idx_contacts_blocked` (`is_blocked`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: automations
-- WhatsApp automation workflow definitions
-- ============================================================
CREATE TABLE `automations` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(150) NOT NULL,
  `description`     TEXT NULL,
  `trigger_type`    ENUM('keyword','schedule','contact_added','message_received','manual')
                      NOT NULL DEFAULT 'manual',
  `trigger_config`  JSON NULL COMMENT 'Trigger-specific configuration (e.g., keyword string, cron expression)',
  `is_active`       TINYINT(1) NOT NULL DEFAULT 0,
  `run_count`       INT UNSIGNED NOT NULL DEFAULT 0,
  `last_run`        DATETIME NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_automations_active` (`is_active`),
  KEY `idx_automations_trigger` (`trigger_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: messages
-- Inbound and outbound WhatsApp message records
-- ============================================================
CREATE TABLE `messages` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `contact_id`          INT UNSIGNED NULL,
  `phone`               VARCHAR(20) NOT NULL,
  `direction`           ENUM('inbound','outbound') NOT NULL,
  `content`             TEXT NOT NULL,
  `media_url`           VARCHAR(500) NULL,
  `media_type`          VARCHAR(50) NULL,
  `status`              ENUM('pending','sent','delivered','read','failed')
                          NOT NULL DEFAULT 'pending',
  `whatsapp_message_id` VARCHAR(100) NULL COMMENT 'WhatsApp-assigned message ID',
  `automation_id`       INT UNSIGNED NULL COMMENT 'Linked automation if sent by a workflow',
  `error_message`       TEXT NULL,
  `sent_at`             DATETIME NULL,
  `delivered_at`        DATETIME NULL,
  `read_at`             DATETIME NULL,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_phone` (`phone`),
  KEY `idx_messages_direction` (`direction`),
  KEY `idx_messages_status` (`status`),
  KEY `idx_messages_contact` (`contact_id`),
  KEY `idx_messages_automation` (`automation_id`),
  KEY `idx_messages_created` (`created_at`),
  CONSTRAINT `fk_messages_contact`
    FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_messages_automation`
    FOREIGN KEY (`automation_id`) REFERENCES `automations` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: automation_steps
-- Individual steps within an automation workflow
-- ============================================================
CREATE TABLE `automation_steps` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `automation_id` INT UNSIGNED NOT NULL,
  `step_type`     ENUM('send_message','delay','condition','update_contact','webhook','log')
                    NOT NULL,
  `step_order`    SMALLINT UNSIGNED NOT NULL COMMENT 'Execution order within automation',
  `name`          VARCHAR(100) NULL COMMENT 'Optional display name for the step',
  `config`        JSON NULL COMMENT 'Step-specific configuration parameters',
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_steps_automation` (`automation_id`),
  KEY `idx_steps_order` (`automation_id`, `step_order`),
  CONSTRAINT `fk_steps_automation`
    FOREIGN KEY (`automation_id`) REFERENCES `automations` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: automation_logs
-- Execution history for automation runs
-- ============================================================
CREATE TABLE `automation_logs` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `automation_id`   INT UNSIGNED NOT NULL,
  `status`          ENUM('running','success','failed','partial')
                      NOT NULL DEFAULT 'running',
  `trigger_data`    JSON NULL COMMENT 'Data that triggered the automation',
  `log_output`      TEXT NULL COMMENT 'Step-by-step execution output',
  `error_message`   TEXT NULL,
  `steps_executed`  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `total_steps`     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `execution_time`  FLOAT NULL COMMENT 'Total execution time in milliseconds',
  `started_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at`     DATETIME NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_logs_automation` (`automation_id`),
  KEY `idx_logs_status` (`status`),
  KEY `idx_logs_started` (`started_at`),
  CONSTRAINT `fk_logs_automation`
    FOREIGN KEY (`automation_id`) REFERENCES `automations` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Done!
-- ============================================================
SET foreign_key_checks = 1;
