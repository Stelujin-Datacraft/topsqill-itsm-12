import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil, Loader2, BarChart3, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface PerformanceProject {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  organization_id: string | null;
  form_id: string;
  form_name: string;
  created_by: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FormOption {
  id: string;
  name: string;
}

interface Props {
  onSelectProject: (project: PerformanceProject) => void;
}

export function PerformanceProjectList({ onSelectProject }: Props) {
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const projectId = currentProject?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PerformanceProject | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');

  // Fetch performance projects
  const { data: perfProjects = [], isLoading } = useQuery({
    queryKey: ['performance-projects', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('performance_projects')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PerformanceProject[];
    },
    enabled: !!projectId,
  });

  // Fetch forms for project (excluding already used ones)
  const usedFormIds = perfProjects.map(p => p.form_id);
  const { data: forms = [] } = useQuery({
    queryKey: ['project-forms-for-perf', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('forms')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');
      if (error) throw error;
      return data as FormOption[];
    },
    enabled: !!projectId,
  });

  const availableForms = forms.filter(f => !usedFormIds.includes(f.id));

  // Create performance project
  const createProject = useMutation({
    mutationFn: async () => {
      if (!projectId || !userProfile || !selectedFormId) throw new Error('Missing data');
      const selectedForm = forms.find(f => f.id === selectedFormId);
      const { data, error } = await supabase
        .from('performance_projects')
        .insert({
          name: newName || `${selectedForm?.name} Performance`,
          description: newDescription || null,
          project_id: projectId,
          organization_id: userProfile.organization_id,
          form_id: selectedFormId,
          form_name: selectedForm?.name || '',
          created_by: userProfile.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-create a data source for this form
      await supabase
        .from('performance_data_sources')
        .insert({
          project_id: projectId,
          organization_id: userProfile.organization_id,
          created_by: userProfile.id,
          source_form_id: selectedFormId,
          source_form_name: selectedForm?.name || '',
          field_mappings: [],
          linked_forms: [],
          data_limit: 500,
          is_active: true,
          performance_project_id: data.id,
        });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-projects', projectId] });
      toast({ title: 'Performance Project Created' });
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      setSelectedFormId('');
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Update performance project
  const updateProject = useMutation({
    mutationFn: async () => {
      if (!editingProject) throw new Error('No project selected');
      const { error } = await supabase
        .from('performance_projects')
        .update({
          name: newName,
          description: newDescription || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProject.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-projects', projectId] });
      toast({ title: 'Project Updated' });
      setEditOpen(false);
      setEditingProject(null);
    },
  });

  // Delete performance project
  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('performance_projects')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-projects', projectId] });
      toast({ title: 'Performance Project Deleted' });
      setDeleteConfirm(null);
    },
  });

  const openEdit = (project: PerformanceProject) => {
    setEditingProject(project);
    setNewName(project.name);
    setNewDescription(project.description || '');
    setEditOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Project Performance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create a performance project per form for focused AI-powered analysis
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={availableForms.length === 0}>
              <Plus className="mr-2 h-4 w-4" />New Performance Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Performance Project</DialogTitle>
              <DialogDescription>Select a form to create a dedicated performance analysis project for it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Form</Label>
                <Select value={selectedFormId} onValueChange={(v) => {
                  setSelectedFormId(v);
                  const form = forms.find(f => f.id === v);
                  if (form && !newName) setNewName(`${form.name} Performance`);
                }}>
                  <SelectTrigger><SelectValue placeholder="Choose a form..." /></SelectTrigger>
                  <SelectContent>
                    {availableForms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Project Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Budget Tracker Performance" />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="What will you analyze?" />
              </div>
              <Button
                className="w-full"
                onClick={() => createProject.mutate()}
                disabled={!selectedFormId || !newName || createProject.isPending}
              >
                {createProject.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Performance Project</DialogTitle>
            <DialogDescription>Update the project name or description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => updateProject.mutate()} disabled={updateProject.isPending}>
              {updateProject.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Performance Project?</DialogTitle>
            <DialogDescription>
              This will permanently delete this performance project and all its data sources, thresholds, alerts, and predictions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteProject.mutate(deleteConfirm)} disabled={deleteProject.isPending}>
              {deleteProject.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Cards */}
      {perfProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">No performance projects yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a performance project for each form you want to analyze individually.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {perfProjects.map(project => (
            <Card key={project.id} className="group hover:border-primary/40 transition-colors cursor-pointer" onClick={() => onSelectProject(project)}>
              <CardContent className="py-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-xs">
                        <BarChart3 className="h-3 w-3 mr-1" />
                        {project.form_name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created {format(new Date(project.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(project)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(project.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-end mt-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
