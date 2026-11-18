-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "is_called" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN "called_by_admin" TEXT;

-- CreateIndex
CREATE INDEX "bookings_is_called_idx" ON "bookings"("is_called");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_called_by_admin_fkey" FOREIGN KEY ("called_by_admin") REFERENCES "admins"("email") ON DELETE SET NULL ON UPDATE CASCADE;
