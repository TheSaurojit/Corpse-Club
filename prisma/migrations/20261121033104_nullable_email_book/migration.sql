-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "customer_email" DROP NOT NULL,
ALTER COLUMN "customer_email" SET DEFAULT '';
