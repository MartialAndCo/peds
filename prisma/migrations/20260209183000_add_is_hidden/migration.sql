-- Add isHidden column to Contact table
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS "contacts_isHidden_idx" ON "contacts"("isHidden");
