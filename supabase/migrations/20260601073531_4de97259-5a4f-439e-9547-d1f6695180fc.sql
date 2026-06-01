ALTER TABLE public.data_feeds
  ADD COLUMN IF NOT EXISTS conditional_delete_filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conditional_delete_filter_logic text;