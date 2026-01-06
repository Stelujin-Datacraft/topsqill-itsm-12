import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

interface TablePreviewProps {
  formId: string;
  selectedColumns: string[];
  filters?: any[];
  pageSize?: number;
}

export function TablePreview({ formId, selectedColumns, filters = [], pageSize = 5 }: TablePreviewProps) {
  const [data, setData] = useState<any[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (formId) {
      loadData();
    }
  }, [formId, selectedColumns, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load form fields
      const { data: fieldsData } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId);

      if (fieldsData) {
        setFields(fieldsData);
      }

      // Load submissions (limited for preview)
      const { data: submissions } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false })
        .limit(pageSize);

      if (submissions) {
        setData(submissions);
      }
    } catch (error) {
      console.error('Error loading table preview data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFieldLabel = (columnId: string): string => {
    // Check metadata columns
    const metadataLabels: Record<string, string> = {
      'submitted_at': 'Submitted At',
      'submitted_by': 'Submitted By',
      'approval_status': 'Status',
      'submission_ref_id': 'Reference ID'
    };
    
    if (metadataLabels[columnId]) {
      return metadataLabels[columnId];
    }

    const field = fields.find(f => f.id === columnId);
    return field?.label || columnId;
  };

  const formatCellValue = (row: any, columnId: string): React.ReactNode => {
    // Handle metadata columns
    if (columnId === 'submitted_at' && row.submitted_at) {
      try {
        return format(new Date(row.submitted_at), 'MMM d, yyyy HH:mm');
      } catch {
        return row.submitted_at;
      }
    }
    
    if (columnId === 'approval_status') {
      const status = row.approval_status || 'pending';
      return (
        <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'}>
          {status}
        </Badge>
      );
    }

    if (columnId === 'submitted_by' || columnId === 'submission_ref_id') {
      return row[columnId] || '-';
    }

    // Handle submission data fields
    const submissionData = row.submission_data || {};
    const value = submissionData[columnId];

    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground">-</span>;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading preview...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No records found for this form.</p>
      </div>
    );
  }

  const displayColumns = selectedColumns.length > 0 ? selectedColumns : ['submission_ref_id', 'submitted_at'];

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[300px]">
        <Table>
          <TableHeader>
            <TableRow>
              {displayColumns.map((colId) => (
                <TableHead key={colId} className="whitespace-nowrap text-xs">
                  {getFieldLabel(colId)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={row.id || idx}>
                {displayColumns.map((colId) => (
                  <TableCell key={colId} className="text-xs py-2">
                    {formatCellValue(row, colId)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="bg-muted/30 px-3 py-2 border-t text-xs text-muted-foreground">
        Showing {data.length} of total records (preview limited to {pageSize})
      </div>
    </div>
  );
}
