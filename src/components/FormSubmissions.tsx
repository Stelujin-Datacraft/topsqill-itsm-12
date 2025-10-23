import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form } from '@/types/form';
import { supabase } from '@/integrations/supabase/client';
import { Search, Filter, Download, Eye, Trash2, Calendar, User, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSubmissionAccessFilter } from '@/hooks/useSubmissionAccessFilter';
import { SubmissionUpdateButton } from './submissions/SubmissionUpdateButton';
interface FormSubmission {
  id: string;
  formId: string;
  submittedBy: string;
  submittedAt: string;
  submissionData: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  approvalStatus?: string;
  approvedBy?: string;
  approvalTimestamp?: string;
  approvalNotes?: string;
}
interface FormSubmissionsProps {
  form: Form;
}
export function FormSubmissions({
  form
}: FormSubmissionsProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const { userProfile } = useAuth();
  const { filterSubmissions: applyAccessFilter, loading: accessFilterLoading } = useSubmissionAccessFilter(form, userProfile?.id);

  // Get all fields from all pages
  const getAllFields = () => {
    return form.fields;
  };

  // Load submissions from database
  const loadSubmissions = async () => {
    try {
      setLoading(true);
      console.log('Loading submissions for form:', form.id);
      const {
        data,
        error
      } = await supabase.from('form_submissions').select(`
          *,
          user_profiles!form_submissions_approved_by_fkey(
            first_name,
            last_name,
            email
          )
        `).eq('form_id', form.id).order('submitted_at', {
        ascending: false
      });
      if (error) {
        console.error('Error loading submissions:', error);
        throw error;
      }
      const submissionsData = (data || []).map(submission => ({
        id: submission.id,
        formId: submission.form_id,
        submittedBy: submission.submitted_by || 'Anonymous',
        submittedAt: submission.submitted_at,
        submissionData: submission.submission_data as Record<string, any>,
        ipAddress: submission.ip_address as string | undefined,
        userAgent: submission.user_agent || '',
        approvalStatus: submission.approval_status || 'pending',
        approvedBy: submission.approved_by,
        approvalTimestamp: submission.approval_timestamp,
        approvalNotes: submission.approval_notes,
        approverProfile: submission.user_profiles
      }));
      setSubmissions(submissionsData);
      console.log('Loaded submissions:', submissionsData.length);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast({
        title: "Error loading submissions",
        description: "Failed to load form submissions.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadSubmissions();
  }, [form.id]);

  // Apply access control filter first, then other filters
  const accessFilteredSubmissions = useMemo(() => {
    return applyAccessFilter(submissions.map(s => ({ 
      ...s, 
      submission_data: s.submissionData 
    }))).map(s => ({
      ...s,
      submissionData: s.submission_data
    }));
  }, [submissions, applyAccessFilter]);

  const filteredSubmissions = accessFilteredSubmissions.filter(submission => {
    const matchesSearch = submission.submittedBy.toLowerCase().includes(searchTerm.toLowerCase()) || Object.values(submission.submissionData).some(value => String(value).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesApprovalFilter = approvalFilter === 'all' || submission.approvalStatus === approvalFilter;
    return matchesSearch && matchesApprovalFilter;
  });
  const handleViewSubmission = (submission: FormSubmission) => {
    // Navigate to submission view page
    window.open(`/submission/${submission.id}`, '_blank');
  };
  const handleDeleteSubmission = async (submissionId: string) => {
    try {
      const {
        error
      } = await supabase.from('form_submissions').delete().eq('id', submissionId);
      if (error) throw error;
      setSubmissions(prev => prev.filter(sub => sub.id !== submissionId));
      toast({
        title: "Submission deleted",
        description: "The submission has been deleted successfully."
      });
    } catch (error) {
      console.error('Error deleting submission:', error);
      toast({
        title: "Error deleting submission",
        description: "Failed to delete the submission. Please try again.",
        variant: "destructive"
      });
    }
  };
  const handleExportData = () => {
    const allFields = getAllFields();
    
    // Helper function to format field values for export
    const formatFieldValueForExport = (field: any, value: any) => {
      // Handle cross-reference fields - export submission_ref_id values
      if (field.fieldType === 'cross-reference' && Array.isArray(value)) {
        return value
          .map(item => item?.submission_ref_id || '')
          .filter(Boolean)
          .join(', ');
      }
      
      // Handle other field types
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value || '';
    };
    
    // Create CSV data with Submission ID and approval status
    const headers = ['Submission ID', 'Submitted By', 'Submitted At', 'Approval Status', 'Approved By', 'Approval Date', 'Approval Notes', ...allFields.map(field => field.label)];
    const csvData = [
      headers.join(','), 
      ...filteredSubmissions.map(submission => [
        submission.id, 
        submission.submittedBy, 
        new Date(submission.submittedAt).toLocaleString(), 
        submission.approvalStatus || 'pending', 
        submission.approvedBy || '', 
        submission.approvalTimestamp ? new Date(submission.approvalTimestamp).toLocaleString() : '', 
        submission.approvalNotes || '', 
        ...allFields.map(field => formatFieldValueForExport(field, submission.submissionData[field.id]))
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvData], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.name}_submissions.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  const getFieldValue = (submission: FormSubmission, fieldId: string) => {
    return submission.submissionData[fieldId] || '-';
  };
  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>;
      case 'disapproved':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Disapproved
          </Badge>;
      default:
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>;
    }
  };
  if (loading || accessFilterLoading) {
    return <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading submissions...</div>
      </div>;
  }
  const allFields = getAllFields();
  return <div className="space-y-6 px-[15px] py-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Form Submissions</h2>
          <p className="text-muted-foreground">
            Manage and review submissions for "{form.name}"
          </p>
        </div>
        <div className="flex gap-2">
          <SubmissionUpdateButton 
            formId={form.id}
            onUpdateComplete={loadSubmissions}
          />
          <Button onClick={handleExportData} disabled={submissions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input placeholder="Search submissions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Approval Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="disapproved">Disapproved</SelectItem>
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
            Submissions ({filteredSubmissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubmissions.length > 0 ? <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Approval Status</TableHead>
                    {allFields.slice(0, 2).map(field => <TableHead key={field.id}>{field.label}</TableHead>)}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map(submission => <TableRow key={submission.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {submission.submittedBy}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getApprovalBadge(submission.approvalStatus || 'pending')}
                      </TableCell>
                      {allFields.slice(0, 2).map(field => <TableCell key={field.id}>
                          {getFieldValue(submission, field.id)}
                        </TableCell>)}
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleViewSubmission(submission)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteSubmission(submission.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            </div> : <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No submissions found</p>
              <p className="text-sm">Submissions will appear here once users submit the form</p>
            </div>}
        </CardContent>
      </Card>
    </div>;
}