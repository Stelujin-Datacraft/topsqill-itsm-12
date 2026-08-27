-- Marketing blog CMS: global published posts for public /blog
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  author_name TEXT NOT NULL DEFAULT 'TopSqill Team',
  author_title TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published
  ON public.blog_posts (published, published_at DESC NULLS LAST)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_blog_posts_updated
  ON public.blog_posts (updated_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published blog posts" ON public.blog_posts;
CREATE POLICY "Public can read published blog posts"
ON public.blog_posts
FOR SELECT
USING (published = true);

DROP POLICY IF EXISTS "Admins can read all blog posts" ON public.blog_posts;
CREATE POLICY "Admins can read all blog posts"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can insert blog posts" ON public.blog_posts;
CREATE POLICY "Admins can insert blog posts"
ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update blog posts" ON public.blog_posts;
CREATE POLICY "Admins can update blog posts"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete blog posts" ON public.blog_posts;
CREATE POLICY "Admins can delete blog posts"
ON public.blog_posts
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_blog_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.published = true AND NEW.published_at IS NULL THEN
    NEW.published_at = now();
  ELSIF NEW.published = true AND TG_OP = 'UPDATE' AND OLD.published IS DISTINCT FROM true THEN
    NEW.published_at = COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
BEFORE INSERT OR UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.set_blog_posts_updated_at();

-- Cover / inline media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-media', 'blog-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read blog media" ON storage.objects;
CREATE POLICY "Public can read blog media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'blog-media');

DROP POLICY IF EXISTS "Admins can upload blog media" ON storage.objects;
CREATE POLICY "Admins can upload blog media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'blog-media'
  AND public.is_current_user_admin()
);

DROP POLICY IF EXISTS "Admins can update blog media" ON storage.objects;
CREATE POLICY "Admins can update blog media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'blog-media'
  AND public.is_current_user_admin()
);

DROP POLICY IF EXISTS "Admins can delete blog media" ON storage.objects;
CREATE POLICY "Admins can delete blog media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'blog-media'
  AND public.is_current_user_admin()
);
