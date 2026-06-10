-- Add terms_and_conditions to organisations table for PDF rendering
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS terms_and_conditions text;
