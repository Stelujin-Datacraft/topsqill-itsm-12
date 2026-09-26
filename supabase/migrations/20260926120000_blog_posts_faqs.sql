-- Optional FAQ Q&A pairs for FAQPage JSON-LD on public blog posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS faqs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.blog_posts.faqs IS
  'Array of {question, answer} objects used for visible FAQs and FAQPage schema.org JSON-LD';
