-- CreateTable
CREATE TABLE "admin_push_subscriptions" (
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

-- CreateIndex
CREATE UNIQUE INDEX "admin_push_subscriptions_endpoint_key" ON "admin_push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "admin_push_subscriptions_admin_email_idx" ON "admin_push_subscriptions"("admin_email");

-- AddForeignKey
ALTER TABLE "admin_push_subscriptions" ADD CONSTRAINT "admin_push_subscriptions_admin_email_fkey" FOREIGN KEY ("admin_email") REFERENCES "admins"("email") ON DELETE CASCADE ON UPDATE CASCADE;
