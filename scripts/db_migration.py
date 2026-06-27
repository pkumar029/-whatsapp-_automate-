import sys
import os
from sqlalchemy import text

# Add backend directory to sys.path so we can import connection
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import engine

def migrate():
    print("Running database migrations...")
    campaigns_ddl = """
    CREATE TABLE IF NOT EXISTS `campaigns` (
      `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
      `name`           VARCHAR(150) NOT NULL,
      `status`         ENUM('active','paused','completed','cancelled') NOT NULL DEFAULT 'active',
      `delay_seconds`  INT UNSIGNED NOT NULL DEFAULT 0,
      `concurrency`    INT UNSIGNED NOT NULL DEFAULT 1,
      `total_jobs`     INT UNSIGNED NOT NULL DEFAULT 0,
      `completed_jobs` INT UNSIGNED NOT NULL DEFAULT 0,
      `failed_jobs`    INT UNSIGNED NOT NULL DEFAULT 0,
      `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_campaigns_status` (`status`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """

    message_jobs_ddl = """
    CREATE TABLE IF NOT EXISTS `message_jobs` (
      `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      `campaign_id`     INT UNSIGNED NULL,
      `contact_id`      INT UNSIGNED NULL,
      `phone`           VARCHAR(20) NOT NULL,
      `body`            TEXT NOT NULL,
      `scheduled_at`    DATETIME NOT NULL,
      `status`          ENUM('queued','sending','sent','delivered','read','failed','cancelled') NOT NULL DEFAULT 'queued',
      `retry_count`     INT UNSIGNED NOT NULL DEFAULT 0,
      `next_retry_time` DATETIME NULL,
      `lock_time`       DATETIME NULL,
      `sent_time`       DATETIME NULL,
      `provider_id`     VARCHAR(100) NULL,
      `failure_reason`  TEXT NULL,
      `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uq_campaign_contact` (`campaign_id`, `contact_id`),
      UNIQUE KEY `uq_campaign_phone` (`campaign_id`, `phone`),
      KEY `idx_jobs_campaign` (`campaign_id`),
      KEY `idx_jobs_contact` (`contact_id`),
      KEY `idx_jobs_status` (`status`),
      KEY `idx_jobs_scheduled_at` (`scheduled_at`),
      KEY `idx_jobs_next_retry` (`next_retry_time`),
      KEY `idx_jobs_lock_time` (`lock_time`),
      CONSTRAINT `fk_jobs_campaign`
        FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`)
        ON DELETE CASCADE,
      CONSTRAINT `fk_jobs_contact`
        FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            print("Creating campaigns table...")
            conn.execute(text(campaigns_ddl))
            print("Creating message_jobs table...")
            conn.execute(text(message_jobs_ddl))
            trans.commit()
            print("Database migration completed successfully!")
        except Exception as e:
            trans.rollback()
            print(f"Migration failed: {e}")
            sys.exit(1)

if __name__ == "__main__":
    migrate()
