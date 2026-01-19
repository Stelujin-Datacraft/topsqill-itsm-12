-- Add matching_logic column to data_feeds table for logical operator support
ALTER TABLE public.data_feeds 
ADD COLUMN IF NOT EXISTS matching_logic text;

-- Add comment for documentation
COMMENT ON COLUMN public.data_feeds.matching_logic IS 'Logic expression for matching rules (e.g., "1 AND 2", "(1 OR 2) AND 3"). Default: AND all rules.';