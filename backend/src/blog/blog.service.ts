import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const BLOG_TABLE_SQL = `
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

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
`;

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async assertAdmin(userId: string) {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      this.logger.warn(`admin check failed: ${error.message}`);
      throw new ForbiddenException('Unable to verify admin role');
    }
    if (data?.role !== 'admin') {
      throw new ForbiddenException('Admins only');
    }
  }

  async ensure(userId: string, _authHeader?: string) {
    await this.assertAdmin(userId);
    const supabase = this.supabaseService.getServiceClient();

    let bucket = 'blog-media';
    const { data: existing, error: getBucketErr } = await supabase.storage.getBucket('blog-media');
    if (getBucketErr || !existing) {
      const { error: createErr } = await supabase.storage.createBucket('blog-media', {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (createErr && !/already exists/i.test(createErr.message)) {
        this.logger.warn(`createBucket blog-media: ${createErr.message}`);
        // Fall back — report-media is known to exist in this project
        bucket = 'report-media';
      }
    }

    // Ensure public read + admin write policies via storage API is limited;
    // bucket create with public:true is enough for public URLs.

    let table = false;
    const { error: probeErr } = await supabase.from('blog_posts').select('id').limit(1);
    if (!probeErr) {
      table = true;
    } else {
      // Attempt to create via optional exec_sql RPC if the project defines it
      const { error: rpcErr } = await supabase.rpc('exec_sql' as any, { sql: BLOG_TABLE_SQL } as any);
      if (!rpcErr) {
        const { error: reprobe } = await supabase.from('blog_posts').select('id').limit(1);
        table = !reprobe;
      } else {
        this.logger.warn(
          `blog_posts table missing and exec_sql unavailable: ${probeErr.message}. Client will use storage fallback.`,
        );
      }
    }

    // Seed empty CMS file so public fetches don't 404 forever when using storage mode
    if (!table) {
      const empty = new Blob(['[]'], { type: 'application/json' });
      const { error: seedErr } = await supabase.storage.from(bucket).upload('blog/cms-posts.json', empty, {
        upsert: false,
        contentType: 'application/json',
      });
      if (seedErr && !/already exists|duplicate|the resource already exists/i.test(seedErr.message)) {
        this.logger.warn(`seed cms-posts.json: ${seedErr.message}`);
      }
    }

    return {
      bucket,
      table,
      message: table
        ? `Blog ready (table + bucket ${bucket})`
        : `Bucket ready (${bucket}). Table not found — CMS will use storage JSON until migration 20260827120000_blog_posts.sql is applied.`,
    };
  }
}
