
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, ArrowUpDown, Eye, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';

interface RecordTableFieldProps {
  field: FormField;
  value?: any[];
  onChange?: (value: any[]) => void;
  disabled?: boolean;
}

interface FormRecord {
  id: string;
  [key: string]: any;
}

interface TargetFieldInfo {
  id: string;
  label: string;
  field_type: string;
}

export function RecordTableField({ field, value = [], onChange, disabled = false }: RecordTableFieldProps) {
  const [records, setRecords] = useState<FormRecord[]>([]);
  const [targetFields, setTargetFields] = useState<TargetFieldInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Parse customConfig safely
  let config = {};
  try {
    if (typeof field.customConfig === 'string') {
      config = JSON.parse(field.customConfig);
    } else if (field.customConfig && typeof field.customConfig === 'object') {
      config = field.customConfig;
    }
  } catch (error) {
    console.error('Error parsing field customConfig:', error);
    config = {};
  }

  const {
    targetFormId,
    targetFormName,
    displayColumns = [],
    filters = [],
    enableSearch = true,
    enableSorting = true,
    pageSize = 10,
    includeMetadata = false,
    showOnlyUserRecords = false
  } = config as any;

  // Load target form fields and records when component mounts
  useEffect(() => {
    if (targetFormId) {
      loadTargetFormFields();
      loadRecords();
    }
  }, [targetFormId, displayColumns, filters]);

  const loadTargetFormFields = async () => {
    if (!targetFormId) return;

    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', targetFormId)
        .order('field_order', { ascending: true });

      if (error) {
        console.error('Error loading target form fields:', error);
        return;
      }

      setTargetFields(fields || []);
    } catch (error) {
      console.error('Exception loading target form fields:', error);
    }
  };

  const loadRecords = async () => {
    if (!targetFormId || displayColumns.length === 0) return;

    setLoading(true);
    try {
      // Get form submissions for the target form
      let query = supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', targetFormId);

      // Apply user filter if enabled
      if (showOnlyUserRecords) {
        // This would need proper user context
        // query = query.eq('submitted_by', currentUserId);
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: submissions, error } = await query;

      if (error) {
        console.error('Error loading records:', error);
        return;
      }

      // Transform submissions to records
      const transformedRecords = (submissions || []).map(submission => {
        const record: FormRecord = {
          id: submission.id,
        };

        // Add submission data
        if (submission.submission_data && typeof submission.submission_data === 'object') {
          Object.assign(record, submission.submission_data);
        }

        // Add metadata if enabled
        if (includeMetadata) {
          record.metadata_created_at = submission.submitted_at;
          record.metadata_updated_at = submission.submitted_at;
          record.metadata_submitted_by = submission.submitted_by;
          record.metadata_submission_id = submission.id;
        }

        return record;
      });

      // Apply search filter
      let filteredRecords = transformedRecords;
      if (searchTerm && enableSearch) {
        filteredRecords = transformedRecords.filter(record =>
          Object.values(record).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
      }

      // Apply custom filters
      if (filters.length > 0) {
        filteredRecords = filteredRecords.filter(record => {
          return filters.every((filter: any) => {
            const fieldValue = record[filter.field];
            const filterValue = filter.value;

            switch (filter.operator) {
              case '==':
                return fieldValue === filterValue;
              case '!=':
                return fieldValue !== filterValue;
              case '<':
                return Number(fieldValue) < Number(filterValue);
              case '>':
                return Number(fieldValue) > Number(filterValue);
              case 'contains':
                return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
              default:
                return true;
            }
          });
        });
      }

      setRecords(filteredRecords);
    } catch (error) {
      console.error('Exception loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getColumnLabel = (columnId: string) => {
    if (columnId.startsWith('metadata_')) {
      const metadataId = columnId.replace('metadata_', '');
      const metadataLabels: Record<string, string> = {
        created_at: 'Created At',
        updated_at: 'Updated At',
        submitted_by: 'Submitted By',
        submission_id: 'Submission ID'
      };
      return metadataLabels[metadataId] || metadataId;
    }

    const targetField = targetFields.find(f => f.id === columnId);
    return targetField?.label || columnId;
  };

  const formatCellValue = (value: any, columnId: string) => {
    if (value === null || value === undefined) return '-';

    if (columnId.startsWith('metadata_')) {
      if (columnId.includes('_at')) {
        return new Date(value).toLocaleDateString();
      }
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  if (!targetFormId) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <p>No target form configured for this record field.</p>
          <p className="text-sm">Please configure the field to select a target form.</p>
        </CardContent>
      </Card>
    );
  }

  if (displayColumns.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <p>No display columns configured.</p>
          <p className="text-sm">Please configure which columns to display.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <span>{field.label}</span>
            {targetFormName && (
              <Badge variant="outline" className="ml-2">
                {targetFormName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {enableSearch && (
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={loadRecords}>
              <Filter className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Loading records...</div>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  {displayColumns.map((columnId: string) => (
                    <TableHead key={columnId} className="font-medium">
                      <div className="flex items-center gap-2">
                        {getColumnLabel(columnId)}
                        {enableSorting && (
                          <ArrowUpDown className="h-3 w-3 text-gray-400" />
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={displayColumns.length + 1} className="text-center py-8 text-gray-500">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      {displayColumns.map((columnId: string) => (
                        <TableCell key={columnId}>
                          {formatCellValue(record[columnId], columnId)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {records.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {records.length} records
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">Page {currentPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={records.length < pageSize}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
