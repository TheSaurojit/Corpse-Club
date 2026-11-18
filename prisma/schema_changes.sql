-- ============================================================================
-- CORPSE CLUB SCHEMA MIGRATION: Web Push Subscriptions & Call Verification
-- ============================================================================

-- 1. Web Push Subscriptions for Admin Devices
CREATE TABLE IF NOT EXISTS "admin_push_subscriptions" (
    "id" SERIAL NOT NULL,
    "admin_email" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "device_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- Unique index on push endpoint (one record per physical device/browser)
CREATE UNIQUE INDEX IF NOT EXISTS "admin_push_subscriptions_endpoint_key" 
ON "admin_push_subscriptions"("endpoint");

-- Index on admin email for fast lookup
CREATE INDEX IF NOT EXISTS "admin_push_subscriptions_admin_email_idx" 
ON "admin_push_subscriptions"("admin_email");

-- Foreign key linking device subscriptions to admins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admin_push_subscriptions_admin_email_fkey'
    ) THEN
        ALTER TABLE "admin_push_subscriptions" 
        ADD CONSTRAINT "admin_push_subscriptions_admin_email_fkey" 
        FOREIGN KEY ("admin_email") REFERENCES "admins"("email") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;


-- 2. Customer Call Verification Tracking on Bookings
ALTER TABLE "bookings" 
ADD COLUMN IF NOT EXISTS "is_called" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "bookings" 
ADD COLUMN IF NOT EXISTS "called_by_admin" TEXT;

-- Index for filtering uncalled vs called bookings
CREATE INDEX IF NOT EXISTS "bookings_is_called_idx" 
ON "bookings"("is_called");

-- Foreign key linking called_by_admin to admins table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_called_by_admin_fkey'
    ) THEN
        ALTER TABLE "bookings" 
        ADD CONSTRAINT "bookings_called_by_admin_fkey" 
        FOREIGN KEY ("called_by_admin") REFERENCES "admins"("email") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
