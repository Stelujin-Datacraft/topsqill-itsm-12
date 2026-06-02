ALTER TABLE public.data_feeds ADD COLUMN IF NOT EXISTS source_date_format text NOT NULL DEFAULT 'auto';
NOTIFY pgrst, 'reload schema';