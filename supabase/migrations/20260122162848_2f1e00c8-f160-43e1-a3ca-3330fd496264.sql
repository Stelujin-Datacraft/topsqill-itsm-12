-- Add nested_cross_ref_mappings column to data_feeds table
-- This stores configuration for creating/updating records in linked forms via cross-reference fields
ALTER TABLE public.data_feeds 
ADD COLUMN IF NOT EXISTS nested_cross_ref_mappings JSONB DEFAULT '[]'::jsonb;