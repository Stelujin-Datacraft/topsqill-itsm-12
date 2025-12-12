
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings,
  Edit,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReports } from '@/hooks/useReports';
import { useFormSubmissionData } from '@/hooks/useFormSubmissionData';
import { supabase } from '@/integrations/supabase/client';
import { FormDataCell } from './FormDataCell';

interface FormSubmissionsTableConfig {
  title?: string;
  formId?: string;
  selectedColumns?: string[];
  filters?: Array<{ field: string; operator: string; value: any }>;
  showApprovalStatus?: boolean;
  pageSize?: number;
}

interface FormSubmissionsTableProps {
  config: FormSubmissionsTableConfig;
  isEditing?: boolean;
  onConfigChange?: (config: FormSubmissionsTableConfig) => void;
  onEdit?: () => void;
}

interface FormField {
  id: string;
  label: string;
  field_type: string;
  custom_config?: any;
}

export function FormSubmissionsTable({ config, isEditing, onConfigChange, onEdit }: FormSubmissionsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  
  const { forms } = useReports();
  const { submissions, loading } = useFormSubmissionData(config.formId);

  // Fetch form fields directly from database
  useEffect(() => {
    const fetchFormFields = async () => {
      if (!config.formId) {
        setFormFields([]);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type, custom_config')
          .eq('form_id', config.formId)
          .order('field_order', { ascending: true });
          
        if (error) {
          console.error('Error fetching form fields:', error);
          setFormFields([]);
          return;
        }
        
        setFormFields(data || []);
      } catch (err) {
        console.error('Error fetching form fields:', err);
        setFormFields([]);
      }
    };
    
    fetchFormFields();
  }, [config.formId]);

  const getAvailableFields = () => {
    if (!config.formId) return [];
    // Filter out signature-pad fields (contain base64 data not suitable for table display)
    const filteredFormFields = formFields.filter(field => field.field_type !== 'signature-pad');
    return [
      { id: 'submitted_at', label: 'Submitted At', type: 'date' },
      { id: 'submitted_by', label: 'Submitted By', type: 'text' },
      ...(config.showApprovalStatus ? [
        { id: 'approval_status', label: 'Approval Status', type: 'text' },
        { id: 'approved_by', label: 'Approved By', type: 'text' },
        { id: 'approval_timestamp', label: 'Approval Date', type: 'date' }
      ] : []),
      ...filteredFormFields.map(field => ({
        id: field.id,
        label: field.label,
        type: field.field_type || 'text'
      }))
    ];
  };

  const getDisplayColumns = () => {
    const availableFields = getAvailableFields();
    if (config.selectedColumns?.length) {
      return availableFields.filter(field => config.selectedColumns!.includes(field.id));
    }
    return availableFields.slice(0, 5); // Default to first 5 columns
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-violet-600" />
      : <ArrowDown className="h-4 w-4 text-violet-600" />;
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const filteredAndSortedData = submissions
    .filter(submission => {
      const matchesSearch = searchTerm === '' || 
        Object.values(submission.submission_data || {}).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        (submission.submitted_by || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesApprovalFilter = approvalFilter === 'all' || 
                                   submission.approval_status === approvalFilter;
      
      return matchesSearch && matchesApprovalFilter;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      
      let aValue, bValue;
      
      if (sortColumn === 'submitted_at' || sortColumn === 'approval_timestamp') {
        aValue = new Date(a[sortColumn as keyof typeof a] as string).getTime();
        bValue = new Date(b[sortColumn as keyof typeof b] as string).getTime();
      } else if (sortColumn in a) {
        aValue = a[sortColumn as keyof typeof a];
        bValue = b[sortColumn as keyof typeof b];
      } else {
        aValue = a.submission_data[sortColumn];
        bValue = b.submission_data[sortColumn];
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aString = String(aValue || '').toLowerCase();
      const bString = String(bValue || '').toLowerCase();
      
      return sortDirection === 'asc' ? aString.localeCompare(bString) : bString.localeCompare(aString);
    });

  const renderCellValue = (submission: any, fieldId: string, type: string) => {
    let value;
    
    if (fieldId === 'submitted_at' || fieldId === 'approval_timestamp') {
      value = submission[fieldId];
    } else if (fieldId === 'submitted_by' || fieldId === 'approved_by' || fieldId === 'approval_status') {
      value = submission[fieldId];
    } else {
      value = submission.submission_data[fieldId];
    }

    if (value === null || value === undefined) return '--';
    
    // For approval status, use the badge
    if (fieldId === 'approval_status') {
      return getApprovalBadge(value);
    }

    // For system fields (dates), render simply
    if (fieldId === 'submitted_at' || fieldId === 'approval_timestamp') {
      return <span className="text-sm">{new Date(value).toLocaleDateString()}</span>;
    }

    // For submitted_by and approved_by, render as text
    if (fieldId === 'submitted_by' || fieldId === 'approved_by') {
      return <span className="text-sm">{String(value)}</span>;
    }

    // For form fields, use FormDataCell for proper rendering
    const formField = formFields.find(f => f.id === fieldId);
    if (formField) {
      return (
        <FormDataCell 
          value={value} 
          fieldType={formField.field_type || type} 
          field={formField}
        />
      );
    }

    // Fallback for unknown fields
    if (typeof value === 'object') {
      return <span className="text-xs text-muted-foreground">{JSON.stringify(value)}</span>;
    }
    return <span className="text-sm">{String(value)}</span>;
  };

  const handleExport = () => {
    const displayColumns = getDisplayColumns();
    const headers = displayColumns.map(col => col.label);
    const csvData = [
      headers.join(','),
      ...filteredAndSortedData.map(submission => 
        displayColumns.map(col => {
          const value = col.id === 'submitted_at' || col.id === 'approval_timestamp' 
            ? submission[col.id]
            : col.id === 'submitted_by' || col.id === 'approved_by' || col.id === 'approval_status'
            ? submission[col.id]
            : submission.submission_data[col.id];
          return String(value || '').replace(/,/g, ';');
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.title || 'form-submissions'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isEditing) {
    return (
      <div className="space-y-4 p-6 border-2 border-violet-200 rounded-lg bg-white shadow-sm">
        <div>
          <label className="text-slate-700 font-medium">Table Title</label>
          <Input
            value={config.title || ''}
            onChange={(e) => onConfigChange?.({ ...config, title: e.target.value })}
            placeholder="Enter table title"
            className="mt-1 border-slate-200 focus:border-violet-400"
          />
        </div>

        <div>
          <label className="text-slate-700 font-medium">Form</label>
          <Select 
            value={config.formId || ''} 
            onValueChange={(value) => onConfigChange?.({ ...config, formId: value })}
          >
            <SelectTrigger className="mt-1 border-slate-200 focus:border-violet-400">
              <SelectValue placeholder="Select form" />
            </SelectTrigger>
            <SelectContent>
              {forms.map(form => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showApprovalStatus"
            checked={config.showApprovalStatus || false}
            onChange={(e) => onConfigChange?.({ ...config, showApprovalStatus: e.target.checked })}
            className="rounded border-slate-300"
          />
          <label htmlFor="showApprovalStatus" className="text-sm text-slate-700">
            Show Approval Status Columns
          </label>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading form submissions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative group">
      {onEdit && (
        <Button
          size="sm"
          variant="outline"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{config.title || 'Form Submissions'}</h3>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search submissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-slate-200 focus:border-violet-400"
          />
        </div>
        
        {config.showApprovalStatus && (
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Approval Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {getDisplayColumns().map((column) => (
                <TableHead 
                  key={column.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => handleSort(column.id)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {getSortIcon(column.id)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.slice(0, config.pageSize || 50).map((submission, index) => (
              <TableRow key={submission.id || index}>
                {getDisplayColumns().map((column) => (
                  <TableCell key={column.id}>
                    {renderCellValue(submission, column.id, column.type)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {!config.formId ? 'Please select a form to view submissions' : 'No submissions found'}
          </div>
        )}
      </div>
      
      <div className="text-sm text-muted-foreground text-center">
        Showing {Math.min(filteredAndSortedData.length, config.pageSize || 50)} of {filteredAndSortedData.length} submissions
      </div>
    </div>
  );
}
