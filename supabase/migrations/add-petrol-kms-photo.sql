-- Add odometer / kms evidence photo on petrol requests
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE petrol_requests
  ADD COLUMN IF NOT EXISTS kms_photo_url TEXT NOT NULL DEFAULT '';

COMMIT;
