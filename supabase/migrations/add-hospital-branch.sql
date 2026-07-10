-- Add hospital branch column (run once in Supabase SQL Editor)
ALTER TABLE hospitals
ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT '';
