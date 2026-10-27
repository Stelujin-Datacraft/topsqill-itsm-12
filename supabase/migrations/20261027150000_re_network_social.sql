-- Real Estate Network: social graph, feed, messaging (ADDITIVE).
-- Does NOT edit 20261027120000 / 130000 / 140000.

-- Social fields on existing profiles
ALTER TABLE public.re_profiles
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS service_areas text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS specializations text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'org',
  -- org | connections | public
  ADD COLUMN IF NOT EXISTS is_company_page boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_company_profile_id uuid REFERENCES public.re_profiles(id) ON DELETE SET NULL;

-- Listing media gallery
CREATE TABLE IF NOT EXISTS public.re_listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.re_listings(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'image', -- image | video | floor_plan | brochure
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_re_listing_media_listing ON public.re_listing_media (listing_id, sort_order);

-- Enrich listings for marketplace
ALTER TABLE public.re_listings
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS bathrooms integer,
  ADD COLUMN IF NOT EXISTS area_value numeric,
  ADD COLUMN IF NOT EXISTS area_unit text DEFAULT 'sqft',
  ADD COLUMN IF NOT EXISTS furnishing text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Posts / feed
CREATE TABLE IF NOT EXISTS public.re_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_profile_id uuid REFERENCES public.re_profiles(id) ON DELETE SET NULL,
  post_type text NOT NULL DEFAULT 'text',
  -- text | image | property | article | announcement
  body text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'org',
  -- org | connections | public
  listing_id uuid REFERENCES public.re_listings(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reaction_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  repost_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_re_posts_org_created ON public.re_posts (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_re_posts_author ON public.re_posts (author_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.re_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.re_posts(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'image',
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.re_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.re_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.re_posts(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.re_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_re_comments_post ON public.re_comments (post_id, created_at)
  WHERE deleted_at IS NULL;

-- Connections & follows
CREATE TABLE IF NOT EXISTS public.re_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  -- pending | accepted | declined | withdrawn | blocked
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, requester_user_id, addressee_user_id),
  CHECK (requester_user_id <> addressee_user_id)
);
CREATE INDEX IF NOT EXISTS idx_re_connections_addressee ON public.re_connections (addressee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_re_connections_requester ON public.re_connections (requester_user_id, status);

CREATE TABLE IF NOT EXISTS public.re_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  follower_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, follower_user_id, following_user_id),
  CHECK (follower_user_id <> following_user_id)
);

-- Messaging
CREATE TABLE IF NOT EXISTS public.re_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text,
  is_group boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.re_conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.re_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_re_conv_members_user ON public.re_conversation_members (user_id);

CREATE TABLE IF NOT EXISTS public.re_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.re_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  listing_id uuid REFERENCES public.re_listings(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_re_messages_conv ON public.re_messages (conversation_id, created_at)
  WHERE deleted_at IS NULL;

-- Notifications
CREATE TABLE IF NOT EXISTS public.re_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_re_notifications_user ON public.re_notifications (user_id, created_at DESC);

-- RLS
ALTER TABLE public.re_listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS re_listing_media_select ON public.re_listing_media;
CREATE POLICY re_listing_media_select ON public.re_listing_media
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_posts_select ON public.re_posts;
CREATE POLICY re_posts_select ON public.re_posts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS re_posts_insert ON public.re_posts;
CREATE POLICY re_posts_insert ON public.re_posts
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id() AND author_user_id = auth.uid());

DROP POLICY IF EXISTS re_comments_select ON public.re_comments;
CREATE POLICY re_comments_select ON public.re_comments
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS re_connections_select ON public.re_connections;
CREATE POLICY re_connections_select ON public.re_connections
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND (requester_user_id = auth.uid() OR addressee_user_id = auth.uid())
  );

DROP POLICY IF EXISTS re_follows_select ON public.re_follows;
CREATE POLICY re_follows_select ON public.re_follows
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND (follower_user_id = auth.uid() OR following_user_id = auth.uid())
  );

DROP POLICY IF EXISTS re_notifications_select ON public.re_notifications;
CREATE POLICY re_notifications_select ON public.re_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS re_conv_members_select ON public.re_conversation_members;
CREATE POLICY re_conv_members_select ON public.re_conversation_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_listing_media TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_posts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_post_media TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_post_reactions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_comments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_connections TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_follows TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_conversations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_conversation_members TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_messages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_notifications TO authenticated, service_role;
