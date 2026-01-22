-- Add cross-reference record selection columns to data_feeds
ALTER TABLE public.data_feeds 
ADD COLUMN IF NOT EXISTS cross_ref_record_selection TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS cross_ref_match_rules JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cross_ref_match_logic TEXT DEFAULT '';

-- Add comment for documentation
COMMENT ON COLUMN public.data_feeds.cross_ref_record_selection IS 'Record selection mode: all, first, or match_by_field';
COMMENT ON COLUMN public.data_feeds.cross_ref_match_rules IS 'Rules for filtering linked records when match_by_field is selected';
COMMENT ON COLUMN public.data_feeds.cross_ref_match_logic IS 'Logic expression for combining match rules (e.g., 1 AND 2)';