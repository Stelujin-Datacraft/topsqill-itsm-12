import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rawSupabase } from '@/integrations/supabase/rawClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { BlogPostInput, BlogPostRecord } from '@/types/blog';
import {
  clearBlogBucketCache,
  createStorageBlogPost,
  deleteBlogPostEverywhere,
  formatBlogError,
  invalidateBlogTableProbe,
  isMissingRelationError,
  listStorageBlogPosts,
  loadAllPublishedBlogPosts,
  loadDeletedSlugs,
  loadPublishedBlogPostBySlug,
  mirrorPostToStorageAndLocal,
  probeBlogTable,
  updateStorageBlogPost,
  uploadBlogCover,
} from '@/lib/blogCms';
import { mergeAdminBlogPosts } from '@/content/blog/posts';
import { isDemoBlogId } from '@/types/blog';
import { request } from '@/services/api/apiClient';

const ADMIN_KEY = ['blog_posts_admin'] as const;
const PUBLIC_KEY = ['blog_posts_published'] as const;
const MODE_KEY = ['blog_cms_mode'] as const;

export type BlogCmsMode = 'table' | 'storage';

async function ensureBlogBucketViaApi(): Promise<void> {
  const res = await request('/blog/ensure', { method: 'POST' });
  if (res.error) {
    console.warn('[blog] ensure endpoint unavailable:', res.error.message);
  }
}

export function usePublishedBlogPosts() {
  return useQuery({
    queryKey: PUBLIC_KEY,
    queryFn: () => loadAllPublishedBlogPosts(),
    staleTime: 5_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function usePublishedBlogPost(slug: string | undefined) {
  return useQuery({
    queryKey: [...PUBLIC_KEY, slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      if (!slug) return null;
      return loadPublishedBlogPostBySlug(slug);
    },
    staleTime: 5_000,
    refetchOnMount: 'always',
  });
}

export function useBlogAdmin() {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = userProfile?.role === 'admin';

  const modeQuery = useQuery({
    queryKey: MODE_KEY,
    enabled: isAdmin,
    queryFn: async (): Promise<BlogCmsMode> => {
      const tableOk = await probeBlogTable();
      return tableOk ? 'table' : 'storage';
    },
    staleTime: 30_000,
  });

  const listQuery = useQuery({
    queryKey: ADMIN_KEY,
    enabled: isAdmin,
    queryFn: async () => {
      const lists: BlogPostRecord[][] = [];
      const tableOk = await probeBlogTable();
      if (tableOk) {
        const { data, error } = await rawSupabase
          .from('blog_posts')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error && data) lists.push(data as BlogPostRecord[]);
        else if (error && isMissingRelationError(error)) invalidateBlogTableProbe();
        else if (error) console.warn('[blog] admin table list failed:', error.message);
      }
      try {
        lists.push(await listStorageBlogPosts());
      } catch (err) {
        console.warn('[blog] admin storage list failed:', (err as Error)?.message);
      }
      // Dedupe by slug preferring newest
      const bySlug = new Map<string, BlogPostRecord>();
      for (const list of lists) {
        for (const row of list) {
          const prev = bySlug.get(row.slug);
          if (!prev) {
            bySlug.set(row.slug, row);
            continue;
          }
          const prevTs = Date.parse(prev.updated_at || '') || 0;
          const nextTs = Date.parse(row.updated_at || '') || 0;
          if (nextTs >= prevTs) bySlug.set(row.slug, row);
        }
      }
      const deleted = await loadDeletedSlugs();
      return mergeAdminBlogPosts(
        [...bySlug.values()].map((row) => ({ ...row, origin: 'cms' as const })),
        deleted,
      );
    },
  });

  const bustPublicCache = () => {
    queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
    queryClient.invalidateQueries({ queryKey: MODE_KEY });
    queryClient.invalidateQueries({ queryKey: ['blog_deleted_slugs'] });
  };

  const persistNewPost = async (input: BlogPostInput): Promise<BlogPostRecord> => {
    const tableOk = await probeBlogTable();
    if (tableOk) {
      const { data, error } = await rawSupabase
        .from('blog_posts')
        .insert([{
          ...input,
          created_by: user?.id,
          tags: input.tags || [],
          content_html: input.content_html || '',
          published: Boolean(input.published),
          published_at: input.published
            ? (input.published_at || new Date().toISOString())
            : null,
        }])
        .select()
        .single();
      if (!error && data) {
        await mirrorPostToStorageAndLocal(data as BlogPostRecord);
        return data as BlogPostRecord;
      }
      if (error && !isMissingRelationError(error)) {
        console.warn('[blog] table insert failed, falling back to storage:', error.message);
      } else if (error) {
        invalidateBlogTableProbe();
      }
    }
    return createStorageBlogPost(input, user?.id);
  };

  const createPost = useMutation({
    mutationFn: persistNewPost,
    onSuccess: (row) => {
      bustPublicCache();
      toast.success(row.published ? 'Published — visible on /blog' : 'Draft saved');
    },
    onError: (err: Error) => toast.error(formatBlogError(err, 'Failed to save post')),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...input }: BlogPostInput & { id: string }) => {
      // Demo seed posts are not in CMS yet — saving creates a CMS override
      if (isDemoBlogId(id)) {
        const tableOk = await probeBlogTable();
        if (tableOk) {
          const { data: existingRow } = await rawSupabase
            .from('blog_posts')
            .select('id')
            .eq('slug', input.slug)
            .maybeSingle();
          if (existingRow?.id) {
            const { data, error } = await rawSupabase
              .from('blog_posts')
              .update({
                ...input,
                published_at: input.published
                  ? (input.published_at || new Date().toISOString())
                  : null,
              })
              .eq('id', existingRow.id)
              .select()
              .single();
            if (!error && data) {
              await mirrorPostToStorageAndLocal(data as BlogPostRecord);
              return data as BlogPostRecord;
            }
          }
        }
        const existingCms = (await listStorageBlogPosts()).find(
          (p) => p.slug === input.slug && !isDemoBlogId(p.id),
        );
        if (existingCms) {
          return updateStorageBlogPost(existingCms.id, input);
        }
        return persistNewPost(input);
      }
      const tableOk = await probeBlogTable();
      if (tableOk) {
        const payload: Record<string, unknown> = { ...input };
        if (input.published === true && !input.published_at) {
          payload.published_at = new Date().toISOString();
        }
        const { data, error } = await rawSupabase
          .from('blog_posts')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) {
          await mirrorPostToStorageAndLocal(data as BlogPostRecord);
          return data as BlogPostRecord;
        }
        if (error && !isMissingRelationError(error)) {
          console.warn('[blog] table update failed, falling back to storage:', error.message);
        } else if (error) {
          invalidateBlogTableProbe();
        }
      }
      return updateStorageBlogPost(id, input);
    },
    onSuccess: (row) => {
      bustPublicCache();
      toast.success(row.published ? 'Published — visible on /blog' : 'Draft updated');
    },
    onError: (err: Error) => toast.error(formatBlogError(err, 'Failed to update post')),
  });

  const deletePost = useMutation({
    mutationFn: async (payload: string | { id: string; slug?: string }) => {
      const id = typeof payload === 'string' ? payload : payload.id;
      const slug = typeof payload === 'string' ? undefined : payload.slug;

      // Prefer Nest service-role delete when available (bypasses RLS orphans)
      const qs = slug ? `?slug=${encodeURIComponent(slug)}` : '';
      const apiRes = await request<{ ok?: boolean }>(
        `/blog/posts/${encodeURIComponent(id)}${qs}`,
        { method: 'DELETE' },
      );
      if (!apiRes.error) {
        // Keep local tombstone + local CMS cache in sync even when API succeeded
        await deleteBlogPostEverywhere(id, slug).catch((err) => {
          console.warn('[blog] local/storage cleanup after API delete:', (err as Error)?.message);
        });
        return;
      }
      console.warn('[blog] API delete unavailable, using client delete:', apiRes.error.message);
      await deleteBlogPostEverywhere(id, slug);
    },
    onSuccess: () => {
      bustPublicCache();
      toast.success('Blog post deleted');
    },
    onError: (err: Error) => toast.error(formatBlogError(err, 'Failed to delete post')),
  });

  const uploadCover = async (file: File): Promise<{ url: string; via: 'storage' | 'data-url'; bucket?: string }> => {
    await ensureBlogBucketViaApi();
    try {
      return await uploadBlogCover(file);
    } catch (err) {
      clearBlogBucketCache();
      invalidateBlogTableProbe();
      await ensureBlogBucketViaApi();
      try {
        return await uploadBlogCover(file);
      } catch (retryErr) {
        throw new Error(formatBlogError(retryErr, 'Cover upload failed'));
      }
    }
  };

  const ensureSetup = async () => {
    clearBlogBucketCache();
    const res = await request<{
      bucket?: string;
      table?: boolean;
      message?: string;
    }>('/blog/ensure', { method: 'POST' });
    if (res.error) throw new Error(res.error.message);
    invalidateBlogTableProbe();
    bustPublicCache();
    return res.data;
  };

  return {
    isAdmin,
    posts: listQuery.data || [],
    isLoading: listQuery.isLoading,
    cmsMode: modeQuery.data || (listQuery.isLoading ? undefined : 'storage'),
    createPost,
    updatePost,
    deletePost,
    uploadCover,
    ensureSetup,
    refetch: listQuery.refetch,
    listError: listQuery.error ? formatBlogError(listQuery.error) : null,
  };
}
