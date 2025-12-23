import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink, ChevronDown, ChevronRight, Maximize2, Minimize2, Search, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportData, ExportFormat } from '@/utils/exportUtils';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { extractComparableValue, extractNumericValue } from '@/utils/filterUtils';

interface TableCellSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  dimensionField: string;
  dimensionValue: string;
  groupField?: string;
  groupValue?: string;
  dimensionLabel?: string;
  groupLabel?: string;
  submissionId?: string;
  displayFields?: string[];
  fieldLabels?: Record<string, string>;
}

interface SubmissionRecord {
  id: string;
  submission_ref_id: string;
  submission_data: Record<string, any>;
}

export function TableCellSubmissionsDialog({ 
  open, 
  onOpenChange, 
  formId,
  dimensionField,
  dimensionValue,
  groupField,
  groupValue,
  dimensionLabel,
  groupLabel,
  submissionId,
  displayFields = [],
  fieldLabels = {}
}: TableCellSubmissionsDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('_submission_ref');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [fieldTypeMap, setFieldTypeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && formId) {
      loadSubmissions();
      loadFieldTypes();
      setExpandedSubmissions(new Set());
      setIsFullScreen(false);
      setSearchQuery('');
      setSortField('_submission_ref');
      setSortDirection('desc');
    }
  }, [open, formId, dimensionField, dimensionValue, groupField, groupValue, submissionId]);

  const loadFieldTypes = async () => {
    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('id, field_type')
        .eq('form_id', formId);
      
      if (error) throw error;
      
      const typeMap: Record<string, string> = {};
      fields?.forEach(field => {
        typeMap[field.id] = field.field_type;
      });
      setFieldTypeMap(typeMap);
    } catch (error) {
      console.error('Error loading field types:', error);
    }
  };

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      // If we have a direct submissionId, fetch that specific record
      if (submissionId) {
        const { data, error } = await supabase
          .from('form_submissions')
          .select('id, submission_ref_id, submission_data')
          .eq('id', submissionId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setSubmissions([{
            ...data,
            submission_data: (data.submission_data as Record<string, any>) || {}
          }]);
        } else {
          setSubmissions([]);
        }
        return;
      }

      // Otherwise, query by dimension/group filters
      let query = supabase
        .from('form_submissions')
        .select('id, submission_ref_id, submission_data')
        .eq('form_id', formId);

      // Apply dimension filter
      if (dimensionField && dimensionValue) {
        query = query.contains('submission_data', { [dimensionField]: dimensionValue });
      }

      // Apply group filter if exists
      if (groupField && groupValue) {
        query = query.contains('submission_data', { [groupField]: groupValue });
      }

      const { data, error } = await query.order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data?.map(d => ({
        ...d,
        submission_data: (d.submission_data as Record<string, any>) || {}
      })) || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubmission = (submissionId: string) => {
    navigate(`/submission/${submissionId}`);
    onOpenChange(false);
  };

  const toggleExpanded = (submissionId: string) => {
    setExpandedSubmissions(prev => {
      const next = new Set(prev);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  };

  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.join(', ');
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Get sortable fields (submission ref + display fields)
  const sortableFields = useMemo(() => {
    const fields: { value: string; label: string }[] = [
      { value: '_submission_ref', label: 'Submission ID' }
    ];
    
    displayFields.forEach(fieldId => {
      fields.push({
        value: fieldId,
        label: fieldLabels[fieldId] || fieldId
      });
    });
    
    return fields;
  }, [displayFields, fieldLabels]);

  // Filter and sort submissions
  const filteredAndSortedSubmissions = useMemo(() => {
    let result = [...submissions];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(submission => {
        if (submission.submission_ref_id?.toLowerCase().includes(query)) return true;
        return Object.values(submission.submission_data).some(value => {
          // Use extractComparableValue for proper handling of currency, rating, slider, etc.
          const stringValue = extractComparableValue(value).toLowerCase();
          return stringValue.includes(query);
        });
      });
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      if (sortField === '_submission_ref') {
        aValue = a.submission_ref_id || '';
        bValue = b.submission_ref_id || '';
        // String comparison for submission ref
        const comparison = (aValue as string).localeCompare(bValue as string, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      aValue = a.submission_data[sortField];
      bValue = b.submission_data[sortField];
      
      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
      
      // Get field type for proper comparison
      const fieldType = fieldTypeMap[sortField] || '';
      
      // Numeric field types - use extractNumericValue for proper handling of currency, slider, rating
      const numericTypes = ['number', 'currency', 'slider', 'rating', 'calculation'];
      if (numericTypes.includes(fieldType)) {
        const aNum = extractNumericValue(aValue) ?? 0;
        const bNum = extractNumericValue(bValue) ?? 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Date field types
      const dateTypes = ['date', 'datetime', 'datetime-local', 'time'];
      if (dateTypes.includes(fieldType)) {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
        }
      }
      
      // For address and other complex types, use extractComparableValue
      const aStr = extractComparableValue(aValue, fieldType).toLowerCase();
      const bStr = extractComparableValue(bValue, fieldType).toLowerCase();
      
      const comparison = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [submissions, searchQuery, sortField, sortDirection, fieldTypeMap]);

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleExport = (format: ExportFormat) => {
    if (filteredAndSortedSubmissions.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no submissions to export.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Prepare export data with flattened submission_data
      const exportRows = filteredAndSortedSubmissions.map(submission => {
        const row: Record<string, any> = {
          'Submission ID': submission.submission_ref_id || submission.id
        };
        
        // Add display fields if specified, otherwise add all submission_data fields
        if (displayFields.length > 0) {
          displayFields.forEach(fieldId => {
            const label = fieldLabels[fieldId] || fieldId;
            row[label] = formatFieldValue(submission.submission_data[fieldId]);
          });
        } else {
          Object.entries(submission.submission_data).forEach(([key, value]) => {
            row[key] = formatFieldValue(value);
          });
        }
        
        return row;
      });

      const filename = `submissions_${dimensionValue || 'all'}_${new Date().toISOString().split('T')[0]}`;
      exportData(exportRows, format, filename);
      
      toast({
        title: "Export successful",
        description: `Exported ${exportRows.length} submissions to ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "An error occurred while exporting data.",
        variant: "destructive"
      });
    }
  };

  const getDialogTitle = () => {
    let title = `Submissions`;
    if (dimensionLabel && dimensionValue) {
      title += ` - ${dimensionLabel}: ${dimensionValue}`;
    }
    if (groupLabel && groupValue) {
      title += ` - ${groupLabel}: ${groupValue}`;
    }
    return `${title} (${filteredAndSortedSubmissions.length}${searchQuery ? ` of ${submissions.length}` : ''})`;
  };

  const hasDisplayFields = displayFields.length > 0;

  // Render the horizontal table for display fields
  const renderFieldsTable = (submission: SubmissionRecord) => {
    if (!hasDisplayFields) return null;
    
    return (
      <div className="overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {displayFields.map((fieldId) => (
                <TableHead key={fieldId} className="h-8 px-3 text-xs font-medium whitespace-nowrap">
                  {fieldLabels[fieldId] || fieldId}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-transparent">
              {displayFields.map((fieldId) => {
                const value = submission.submission_data[fieldId];
                return (
                  <TableCell 
                    key={fieldId} 
                    className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate"
                    title={formatFieldValue(value)}
                  >
                    {formatFieldValue(value)}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  const dialogContentClass = isFullScreen 
    ? "max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh]"
    : "max-w-3xl max-h-[80vh]";

  const scrollAreaClass = isFullScreen ? "h-[calc(95vh-220px)]" : "max-h-[50vh]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContentClass}>
        <DialogHeader className="flex flex-row items-center justify-between pr-8">
          <DialogTitle className="flex-1">{getDialogTitle()}</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? "Exit full screen" : "Expand to full screen"}
          >
            {isFullScreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </DialogHeader>
        
        {/* Search and Sort Controls */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search across all fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Sort Controls */}
          <div className="flex items-center gap-1">
            <Select value={sortField} onValueChange={setSortField}>
              <SelectTrigger className="w-[160px] h-10">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sort by..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                {sortableFields.map(field => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSortDirection}
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              className="h-10 w-10"
            >
              {sortDirection === 'asc' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 px-3">
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="h-4 w-4 mr-2" />
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export to Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ScrollArea className={scrollAreaClass}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading submissions...</span>
            </div>
          ) : filteredAndSortedSubmissions.length > 0 ? (
            <div className="space-y-2 p-1">
              {filteredAndSortedSubmissions.map((submission) => {
                const isExpanded = expandedSubmissions.has(submission.id);
                return (
                  <div
                    key={submission.id}
                    className="border border-border rounded-md overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-3 hover:bg-muted/30">
                      <div className="flex items-center gap-2">
                        {hasDisplayFields && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleExpanded(submission.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Badge variant="secondary" className="font-mono">
                          #{submission.submission_ref_id}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewSubmission(submission.id)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                    
                    {hasDisplayFields && isExpanded && (
                      <div className="px-2 pb-3 pt-1 bg-muted/20 border-t border-border">
                        {renderFieldsTable(submission)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No submissions match your search' : 'No submissions found for this criteria'}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
