ALTER TABLE public.data_feeds
ALTER COLUMN source_form_id DROP NOT NULL;

ALTER TABLE public.data_feeds
DROP CONSTRAINT IF EXISTS data_feeds_source_validation;

ALTER TABLE public.data_feeds
ADD CONSTRAINT data_feeds_source_validation
CHECK (
  (
    COALESCE(source_type, 'form') = 'form'
    AND source_form_id IS NOT NULL
  )
  OR (
    COALESCE(source_type, 'form') <> 'form'
  )
);

NOTIFY pgrst, 'reload schema';