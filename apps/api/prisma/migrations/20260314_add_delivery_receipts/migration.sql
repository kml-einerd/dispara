-- Add DELIVERED and READ to DispatchItemStatus enum
ALTER TYPE "DispatchItemStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "DispatchItemStatus" ADD VALUE IF NOT EXISTS 'READ';

-- Add wa_msg_id column for delivery receipt correlation
ALTER TABLE "dispatch_items" ADD COLUMN "wa_msg_id" VARCHAR(255);

-- Index for fast lookup when processing delivery receipts
CREATE INDEX "dispatch_items_wa_msg_id_idx" ON "dispatch_items"("wa_msg_id");
