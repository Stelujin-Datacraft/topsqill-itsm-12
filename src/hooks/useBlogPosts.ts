import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rawSupabase } from '@/integrations/supabase/rawClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { BlogPostInput, BlogPostRecord } from '@/types/blog';
import {
  createStorageBlogPost,
  deleteStorageBlogPost,
  formatBlogError,
  getPublishedStorageBlogPost,
  invalidateBlogTableProbe,
  isMissingRelationError,
  listPublishedStorageBlogPosts,
  listStorageBlogPosts,
  probeBlogTable,
  updateStorageBlogPost,
  uploadBlogCover,
} from '@/lib/blogCms';
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
    queryFn: async () => {
      const tableOk = await probeBlogTable();
      if (tableOk) {
        const { data, error } = await rawSupabase
          .from('blog_posts')
          .select('*')
          .eq('published', true)
          .order('published_at', { ascending: false });
        if (!error) return (data || []) as BlogPostRecord[];
        if (!isMissingRelationError(error)) {
          console.warn('[blog] published fetch failed:', error.message);
        }
        invalidateBlogTableProbe();
      }
      return listPublishedStorageBlogPosts();
    },
    staleTime: 60_000,
  });
}

export function usePublishedBlogPost(slug: string | undefined) {
  return useQuery({
    queryKey: [...PUBLIC_KEY, slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      if (!slug) return null;
      const tableOk = await probeBlogTable();
      if (tableOk) {
        const { data, error } = await rawSupabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .eq('published', true)
          .maybeSingle();
        if (!error) return (data as BlogPostRecord) || null;
        if (!isMissingRelationError(error)) {
          console.warn('[blog] post fetch failed:', error.message);
        }
        invalidateBlogTableProbe();
      }
      return getPublishedStorageBlogPost(slug);
    },
    staleTime: 60_000,
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
      const tableOk = await probeBlogTable();
      if (tableOk) {
        const { data, error } = await rawSupabase
          .from('blog_posts')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error) return (data || []) as BlogPostRecord[];
        if (!isMissingRelationError(error)) throw new Error(formatBlogError(error));
        invalidateBlogTableProbe();
      }
      return listStorageBlogPosts();
    },
  });

  const createPost = useMutation({
    mutationFn: async (input: BlogPostInput) => {
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
        if (!error) return data as BlogPostRecord;
        if (!isMissingRelationError(error)) throw new Error(formatBlogError(error));
        invalidateBlogTableProbe();
      }
      return createStorageBlogPost(input, user?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      queryClient.invalidateQueries({ queryKey: MODE_KEY });
      toast.success('Blog post saved');
    },
    onError: (err: Error) => toast.error(formatBlogError(err, 'Failed to save post')),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...input }: BlogPostInput & { id: string }) => {
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
        if (!error) return data as BlogPostRecord;
        if (!isMissingRelationError(error)) throw new Error(formatBlogError(error));
        invalidateBlogTableProbe();
      }
      return updateStorageBlogPost(id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      queryClient.invalidateQueries({ queryKey: MODE_KEY });
      toast.success('Blog post updated');
    },
    onError: (err: Error) => toast.error(formatBlogError(err, 'Failed to update post')),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const tableOk = await probeBlogTable();
      if (tableOk) {
        const { error } = await rawSupabase.from('blog_posts').delete().eq('id', id);
        if (!error) return;
        if (!isMissingRelationError(error)) throw new Error(formatBlogError(error));
        invalidateBlogTableProbe();
      }
      await deleteStorageBlogPost(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      toast.success('Blog post deleted');
    },
    onError: (err: Error) => toast.error(formatBlogError(err, 'Failed to delete post')),
  });

  const uploadCover = async (file: File): Promise<string> => {
    try {
      return await uploadBlogCover(file);
    } catch (err) {
      // Best-effort: ask Nest (service role) to create blog-media, then retry once
      await ensureBlogBucketViaApi();
      invalidateBlogTableProbe();
      try {
        return await uploadBlogCover(file);
      } catch (retryErr) {
        throw new Error(formatBlogError(retryErr, 'Cover upload failed'));
      }
    }
  };

  const ensureSetup = async () => {
    const res = await request<{
      bucket?: string;
      table?: boolean;
      message?: string;
    }>('/blog/ensure', { method: 'POST' });
    if (res.error) throw new Error(res.error.message);
    invalidateBlogTableProbe();
    await queryClient.invalidateQueries({ queryKey: MODE_KEY });
    await queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
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
