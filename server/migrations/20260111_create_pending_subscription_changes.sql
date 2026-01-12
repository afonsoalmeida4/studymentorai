-- Migration: create pending_subscription_changes table
-- Run this on your Postgres database to add the table used for scheduled subscription changes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pending_subscription_changes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  plan varchar(20) NOT NULL,
  price_id varchar,
  billing_period varchar(10) NOT NULL DEFAULT 'monthly',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_subscription_user ON pending_subscription_changes(user_id);

-- Add foreign key constraint if users table exists (optional)
-- ALTER TABLE pending_subscription_changes
--   ADD CONSTRAINT fk_pending_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
