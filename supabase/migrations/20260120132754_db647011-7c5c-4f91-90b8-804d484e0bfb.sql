-- Add source_filters and source_filter_logic columns to data_feeds table
ALTER TABLE public.data_feeds 
ADD COLUMN IF NOT EXISTS source_filters JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS source_filter_logic TEXT;