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

    // Prefer creating blog-media; also accept report-media as the working bucket.
    let bucket = 'blog-media';
    const { data: existing, error: getBucketErr } = await supabase.storage.getBucket('blog-media');
    if (getBucketErr || !existing) {
      const { error: createErr } = await supabase.storage.createBucket('blog-media', {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (createErr && !/already exists/i.test(createErr.message)) {
        this.logger.warn(`createBucket blog-media: ${createErr.message}`);
        bucket = 'report-media';
        // Ensure report-media exists too
        const { data: reportBucket } = await supabase.storage.getBucket('report-media');
        if (!reportBucket) {
          const { error: reportCreateErr } = await supabase.storage.createBucket('report-media', {
            public: true,
            fileSizeLimit: 10 * 1024 * 1024,
          });
          if (reportCreateErr && !/already exists/i.test(reportCreateErr.message)) {
            this.logger.warn(`createBucket report-media: ${reportCreateErr.message}`);
          }
        }
      }
    }

    // Make sure public read works for blog-media objects (idempotent policy create is hard;
    // public bucket flag is the important part for getPublicUrl).

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

  /**
   * Service-role delete so RLS quirks cannot leave orphans.
   * Also tombstones the slug so static demo seeds do not reappear on /blog.
   */
  async deletePost(userId: string, id: string, slug?: string) {
    await this.assertAdmin(userId);
    const supabase = this.supabaseService.getServiceClient();
    const isDemo = String(id || '').startsWith('demo:');
    let resolvedSlug = (slug || '').trim() || (isDemo ? id.replace(/^demo:/, '') : '');

    if (!isDemo) {
      if (!resolvedSlug) {
        const { data } = await supabase.from('blog_posts').select('slug').eq('id', id).maybeSingle();
        resolvedSlug = data?.slug || '';
      }

      const { error: tableErr } = await supabase.from('blog_posts').delete().eq('id', id);
      if (tableErr && !/does not exist|schema cache|42P01|PGRST205/i.test(tableErr.message)) {
        this.logger.warn(`blog_posts delete by id: ${tableErr.message}`);
      }
      if (resolvedSlug) {
        const { error: slugErr } = await supabase.from('blog_posts').delete().eq('slug', resolvedSlug);
        if (slugErr && !/does not exist|schema cache|42P01|PGRST205/i.test(slugErr.message)) {
          this.logger.warn(`blog_posts delete by slug: ${slugErr.message}`);
        }
      }

      // Remove from cms-posts.json mirrors
      for (const bucket of ['blog-media', 'report-media', 'form-attachments', 'organization-logos']) {
        try {
          const { data, error } = await supabase.storage.from(bucket).download('blog/cms-posts.json');
          if (error || !data) continue;
          const text = await data.text();
          const parsed = text.trim() ? JSON.parse(text) : [];
          if (!Array.isArray(parsed)) continue;
          const next = parsed.filter((p: any) => p?.id !== id && (!resolvedSlug || p?.slug !== resolvedSlug));
          const body = new Blob([JSON.stringify(next, null, 2)], { type: 'application/json' });
          const { error: upErr } = await supabase.storage.from(bucket).upload('blog/cms-posts.json', body, {
            upsert: true,
            contentType: 'application/json',
          });
          if (upErr) this.logger.warn(`cms-posts delete mirror ${bucket}: ${upErr.message}`);
        } catch (err) {
          this.logger.warn(`cms-posts delete mirror ${bucket}: ${(err as Error).message}`);
        }
      }
    }

    if (resolvedSlug) {
      for (const bucket of ['blog-media', 'report-media', 'form-attachments', 'organization-logos']) {
        try {
          let slugs: string[] = [];
          const { data, error } = await supabase.storage.from(bucket).download('blog/deleted-slugs.json');
          if (!error && data) {
            const text = await data.text();
            const parsed = text.trim() ? JSON.parse(text) : [];
            if (Array.isArray(parsed)) slugs = parsed.map((s) => String(s).trim()).filter(Boolean);
          }
          if (!slugs.includes(resolvedSlug)) slugs.push(resolvedSlug);
          const body = new Blob([JSON.stringify(slugs, null, 2)], { type: 'application/json' });
          const { error: upErr } = await supabase.storage.from(bucket).upload('blog/deleted-slugs.json', body, {
            upsert: true,
            contentType: 'application/json',
          });
          if (upErr) this.logger.warn(`deleted-slugs ${bucket}: ${upErr.message}`);
          else break;
        } catch (err) {
          this.logger.warn(`deleted-slugs ${bucket}: ${(err as Error).message}`);
        }
      }
    }

    return { ok: true, id, slug: resolvedSlug || null };
  }
}
