
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/contexts/FormContext';
import { useProject } from '@/contexts/ProjectContext';
import { useSubmissionAccessFilter } from '@/hooks/useSubmissionAccessFilter';
import { Form } from '@/types/form';
import { 
  Search, 
  Eye, 
  Edit, 
  Calendar,
  FileText,
  Hash,
  Clock
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface FormSubmission {
  id: string;
  form_id: string;
  submitted_at: string;
  submission_data: Record<string, any>;
  submission_ref_id?: string;
  form_name?: string;
  form_reference_id?: string;
}

export function MySubmissions() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  const [currentForm, setCurrentForm] = useState<Form | null>(null);
  
  const { userProfile } = useAuth();
  const { forms } = useForm();
  const { currentProject } = useProject();
  const navigate = useNavigate();
  
  const { filterSubmissions: applyAccessFilter, loading: accessFilterLoading } = useSubmissionAccessFilter(
    currentForm,
    userProfile?.id
  );

  // Load user's submissions
  const loadSubmissions = async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);
      
      // Only load submissions if we have a current project
      if (!currentProject) {
        setSubmissions([]);
        return;
      }

      // Get forms from current project first
      const { data: projectForms, error: formsError } = await supabase
        .from('forms')
        .select('id')
        .eq('project_id', currentProject.id);

      if (formsError) throw formsError;

      const formIds = projectForms?.map(f => f.id) || [];
      
      if (formIds.length === 0) {
        setSubmissions([]);
        return;
      }

      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          forms!inner(name, reference_id, project_id)
        `)
        .eq('submitted_by', userProfile.id)
        .in('form_id', formIds)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const formattedSubmissions: FormSubmission[] = (data || []).map(submission => ({
        id: submission.id,
        form_id: submission.form_id,
        submitted_at: submission.submitted_at,
        submission_data: submission.submission_data as Record<string, any>,
        submission_ref_id: submission.submission_ref_id,
        form_name: submission.forms?.name,
        form_reference_id: submission.forms?.reference_id
      }));

      setSubmissions(formattedSubmissions);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast({
        title: "Error loading submissions",
        description: "Failed to load your form submissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [userProfile?.id, currentProject?.id]);

  // Load current form structure for access filtering
  useEffect(() => {
    const loadCurrentForm = async () => {
      if (selectedFormId === 'all' || !selectedFormId) {
        setCurrentForm(null);
        return;
      }

      try {
        const { data: formData, error } = await supabase
          .from('forms')
          .select(`
            *,
            form_fields(*)
          `)
          .eq('id', selectedFormId)
          .single();

        if (error) throw error;

        const safeParseJson = (jsonString: any, fallback: any = null) => {
          if (!jsonString) return fallback;
          if (typeof jsonString === 'object') return jsonString;
          try {
            return JSON.parse(jsonString);
          } catch (error) {
            return fallback;
          }
        };

        const transformedForm: Form = {
          id: formData.id,
          name: formData.name,
          description: formData.description || '',
          organizationId: formData.organization_id,
          projectId: formData.project_id,
          status: formData.status as Form['status'],
          fields: (formData.form_fields || []).map((field: any) => ({
            id: field.id,
            type: field.field_type as any,
            label: field.label,
            placeholder: field.placeholder || undefined,
            required: field.required || false,
            customConfig: field.custom_config ? safeParseJson(field.custom_config, {}) : undefined,
          })),
          permissions: safeParseJson(formData.permissions, { view: [], submit: [], edit: [] }),
          createdAt: formData.created_at,
          updatedAt: formData.updated_at,
          createdBy: formData.created_by,
          isPublic: formData.is_public,
          shareSettings: safeParseJson(formData.share_settings, { allowPublicAccess: false, sharedUsers: [] }),
          fieldRules: safeParseJson(formData.field_rules, []),
          formRules: safeParseJson(formData.form_rules, []),
          layout: safeParseJson(formData.layout, { columns: 1 }),
          pages: safeParseJson(formData.pages, []),
        };

        setCurrentForm(transformedForm);
      } catch (error) {
        console.error('Error loading form:', error);
        setCurrentForm(null);
      }
    };

    loadCurrentForm();
  }, [selectedFormId]);

  // Apply access control filter first, then other filters
  const accessFilteredSubmissions = React.useMemo(() => {
    return applyAccessFilter(submissions);
  }, [submissions, applyAccessFilter]);

  // Filter submissions
  const filteredSubmissions = accessFilteredSubmissions.filter(submission => {
    const matchesSearch = submission.form_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submission.submission_ref_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         Object.values(submission.submission_data).some(value => 
                           String(value).toLowerCase().includes(searchTerm.toLowerCase())
                         );
    
    const matchesForm = selectedFormId === 'all' || submission.form_id === selectedFormId;
    
    return matchesSearch && matchesForm;
  });

  // Get unique forms from submissions
  const submissionForms = Array.from(
    new Set(submissions.map(s => s.form_id))
  ).map(formId => {
    const submission = submissions.find(s => s.form_id === formId);
    return {
      id: formId,
      name: submission?.form_name || 'Unknown Form'
    };
  });

  const handleViewSubmission = (submission: FormSubmission) => {
    navigate(`/submission/${submission.id}`);
  };

  const handleEditSubmission = (submission: FormSubmission) => {
    // Navigate to submission edit page
    navigate(`/submission/${submission.id}?edit=true`);
  };

  if (loading || accessFilterLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading your submissions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Submissions</h2>
          <p className="text-muted-foreground">
            View and manage your form submissions
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search submissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedFormId} onValueChange={setSelectedFormId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filter by form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                {submissionForms.map(form => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Submissions ({filteredSubmissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Form ID</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline">
                            {submission.submission_ref_id || submission.id.slice(0, 8)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{submission.form_name}</div>
                          {submission.form_reference_id && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              <Hash className="h-3 w-3 mr-1" />
                              {submission.form_reference_id}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {submission.form_id.slice(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(submission.submitted_at).toLocaleDateString()} at{' '}
                            {new Date(submission.submitted_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewSubmission(submission)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditSubmission(submission)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No submissions found</p>
              <p className="text-sm">Your form submissions will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
