-- ============================================================
-- WhatsApp Automate — Development Seed Data
-- ============================================================
-- Run AFTER schema.sql:
--   mysql -u root -p whatsapp_automate < seed.sql
-- ============================================================

USE `whatsapp_automate`;

-- ─── Default User ────────────────────────────────────────────
INSERT INTO `users` (`name`, `email`, `password_hash`, `is_admin`)
VALUES ('Admin User', 'admin@example.com', '$2b$12$placeholder_hash', 1);

-- ─── WhatsApp Session ────────────────────────────────────────
INSERT INTO `whatsapp_sessions` (`status`) VALUES ('disconnected');

-- ─── Sample Contacts ─────────────────────────────────────────
INSERT INTO `contacts` (`name`, `phone`, `email`, `notes`, `tags`) VALUES
  ('Alice Johnson', '+919876543201', 'alice@example.com', 'Premium customer', '["vip","customer"]'),
  ('Bob Smith', '+919876543202', 'bob@example.com', 'Lead from website', '["lead"]'),
  ('Charlie Brown', '+919876543203', NULL, NULL, '["prospect"]'),
  ('Diana Prince', '+919876543204', 'diana@example.com', 'Partner contact', '["partner"]'),
  ('Eve Wilson', '+919876543205', NULL, 'Trial user', '["trial"]');

-- ─── Sample Automation ───────────────────────────────────────
INSERT INTO `automations` (`name`, `description`, `trigger_type`, `trigger_config`, `is_active`)
VALUES (
  'Welcome Message',
  'Send a welcome message when a new contact is added',
  'contact_added',
  '{"delay_seconds": 0}',
  1
);

-- ─── Sample Steps ─────────────────────────────────────────────
INSERT INTO `automation_steps` (`automation_id`, `step_type`, `step_order`, `name`, `config`)
VALUES
  (1, 'send_message', 1, 'Send Welcome', '{"message": "Hello {{name}}! Welcome to our service. How can we help you today?"}'),
  (1, 'delay', 2, 'Wait 1 hour', '{"seconds": 3600}'),
  (1, 'send_message', 3, 'Follow Up', '{"message": "Hi {{name}}, just checking in! Do you have any questions?"}');
