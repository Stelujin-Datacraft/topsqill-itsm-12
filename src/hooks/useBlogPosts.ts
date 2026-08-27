import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend as supabase } from '@/services/api';
import { rawSupabase } from '@/integrations/supabase/rawClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { BlogPostInput, BlogPostRecord } from '@/types/blog';

const ADMIN_KEY = ['blog_posts_admin'] as const;
const PUBLIC_KEY = ['blog_posts_published'] as const;

export function usePublishedBlogPosts() {
  return useQuery({
    queryKey: PUBLIC_KEY,
    queryFn: async () => {
      const { data, error } = await rawSupabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });
      if (error) {
        // Table may not exist yet in some envs — fail soft for public site
        console.warn('[blog] published fetch failed:', error.message);
        return [] as BlogPostRecord[];
      }
      return (data || []) as BlogPostRecord[];
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
      const { data, error } = await rawSupabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (error) {
        console.warn('[blog] post fetch failed:', error.message);
        return null;
      }
      return (data as BlogPostRecord) || null;
    },
    staleTime: 60_000,
  });
}

export function useBlogAdmin() {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = userProfile?.role === 'admin';

  const listQuery = useQuery({
    queryKey: ADMIN_KEY,
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BlogPostRecord[];
    },
  });

  const createPost = useMutation({
    mutationFn: async (input: BlogPostInput) => {
      const { data, error } = await supabase
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
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data as BlogPostRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      toast.success('Blog post saved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save post'),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...input }: BlogPostInput & { id: string }) => {
      const payload: Record<string, unknown> = { ...input };
      if (input.published === true && !input.published_at) {
        payload.published_at = new Date().toISOString();
      }
      const { data, error } = await supabase
        .from('blog_posts')
        .update(payload as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BlogPostRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      toast.success('Blog post updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update post'),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      toast.success('Blog post deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete post'),
  });

  const uploadCover = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('blog-media').upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('blog-media').getPublicUrl(path);
    return data.publicUrl;
  };

  return {
    isAdmin,
    posts: listQuery.data || [],
    isLoading: listQuery.isLoading,
    createPost,
    updatePost,
    deletePost,
    uploadCover,
    refetch: listQuery.refetch,
  };
}
