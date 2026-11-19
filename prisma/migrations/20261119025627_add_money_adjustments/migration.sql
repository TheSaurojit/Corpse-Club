-- CreateTable
CREATE TABLE "money_adjustments" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'transfer',
    "from_account" TEXT NOT NULL,
    "to_account" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "admin_id" INTEGER,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "money_adjustments_date_idx" ON "money_adjustments"("date");

-- AddForeignKey
ALTER TABLE "money_adjustments" ADD CONSTRAINT "money_adjustments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
