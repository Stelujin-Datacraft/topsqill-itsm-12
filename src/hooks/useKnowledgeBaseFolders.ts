import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface KnowledgeBaseFolder {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  organization_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useKnowledgeBaseFolders() {
  const { currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;
  const orgId = currentOrganization?.id;

  const foldersQuery = useQuery({
    queryKey: ['kb_folders', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('knowledge_base_folders')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      if (error) throw error;
      return (data || []) as KnowledgeBaseFolder[];
    },
    enabled: !!projectId,
  });

  const createFolder = useMutation({
    mutationFn: async (folder: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('knowledge_base_folders')
        .insert([{
          name: folder.name,
          description: folder.description || null,
          project_id: projectId,
          organization_id: orgId,
          created_by: user?.id,
        }])
        .select()
        .single();
      if (error) throw error;
      return data as KnowledgeBaseFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb_folders', projectId] });
      toast.success('Folder created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateFolder = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string }) => {
      const { data, error } = await supabase
        .from('knowledge_base_folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as KnowledgeBaseFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb_folders', projectId] });
      toast.success('Folder updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('knowledge_base_folders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb_folders', projectId] });
      toast.success('Folder deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    folders: foldersQuery.data || [],
    isLoading: foldersQuery.isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
  };
}
