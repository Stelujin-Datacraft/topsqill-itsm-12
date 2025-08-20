import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { ChevronUp, ChevronDown, Search, Filter, Settings, Eye, Maximize2, Minimize2, Trash2, Edit3, FileText, User, Calendar, CheckCircle, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useReports } from '@/hooks/useReports';
import { useNavigate } from 'react-router-dom';
import { DynamicTableColumnSelector } from './DynamicTableColumnSelector';
import { SubmissionAnalytics } from './SubmissionAnalytics';
import { FormDataCell } from './FormDataCell';
import { SubmittedByCell } from './SubmittedByCell';
import { DeleteSubmissionButton } from './DeleteSubmissionButton';
import { ExportDropdown } from './ExportDropdown';
import { SortingControls, SortConfig } from './SortingControls';
import { ComplexFilter, FilterGroup } from '@/components/ui/complex-filter';
import { SavedFiltersManager } from './SavedFiltersManager';
import { InlineEditDialog } from './InlineEditDialog';
import { BulkActionsBar } from './BulkActionsBar';
import { BulkDeleteDialog } from './BulkDeleteDialog';
import { CrossReferenceDialog } from './CrossReferenceDialog';
import { ImportButton } from '@/components/ImportButton';

interface TableConfig {
  title: string;
  formId: string;
  selectedColumns: string[];
  showMetadata?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableSearch?: boolean;
}

interface DynamicTableProps {
  config: TableConfig;
  onEdit?: () => void;
}

export function DynamicTable({ config, onEdit }: DynamicTableProps) {
  // All state hooks first
  const [data, setData] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [complexFilters, setComplexFilters] = useState<FilterGroup[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // New state for bulk operations and inline editing
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showInlineEdit, setShowInlineEdit] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<any>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [canDeleteSubmissions, setCanDeleteSubmissions] = useState(false);
  const [showCrossReferenceDialog, setShowCrossReferenceDialog] = useState(false);
  const [crossReferenceData, setCrossReferenceData] = useState<string[]>([]);
  
  // Custom hooks
  const { forms } = useReports();
  const navigate = useNavigate();

  // Helper function to evaluate filter conditions
  const evaluateCondition = useCallback((row: any, condition: any) => {
    if (!condition.field || !condition.operator) return true;
    
    const value = row.submission_data?.[condition.field];
    const filterValue = condition.value;
    
    if (value === null || value === undefined) {
      return ['is_empty'].includes(condition.operator);
    }
    
    const stringValue = value.toString().toLowerCase();
    const stringFilterValue = filterValue?.toString().toLowerCase() || '';
    
    switch (condition.operator) {
      case 'equals':
        return stringValue === stringFilterValue;
      case 'not_equals':
        return stringValue !== stringFilterValue;
      case 'contains':
        return stringValue.includes(stringFilterValue);
      case 'not_contains':
        return !stringValue.includes(stringFilterValue);
      case 'starts_with':
        return stringValue.startsWith(stringFilterValue);
      case 'ends_with':
        return stringValue.endsWith(stringFilterValue);
      case 'greater_than':
        return parseFloat(stringValue) > parseFloat(stringFilterValue);
      case 'less_than':
        return parseFloat(stringValue) < parseFloat(stringFilterValue);
      case 'greater_equal':
        return parseFloat(stringValue) >= parseFloat(stringFilterValue);
      case 'less_equal':
        return parseFloat(stringValue) <= parseFloat(stringFilterValue);
      case 'is_empty':
        return !stringValue || stringValue.trim() === '';
      case 'is_not_empty':
        return stringValue && stringValue.trim() !== '';
      default:
        return true;
    }
  }, []);

  // All useMemo hooks
  const displayFields = useMemo(() => {
    const columnsToShow = selectedColumns.length > 0 ? selectedColumns : 
                         (config.selectedColumns && config.selectedColumns.length > 0 ? config.selectedColumns : 
                          formFields.map(f => f.id));
    return formFields.filter(field => 
      columnsToShow.includes(field.id) && 
      !['header', 'horizontal_line', 'section_break'].includes(field.field_type)
    );
  }, [formFields, selectedColumns, config.selectedColumns]);

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;

    // Apply search
    if (searchTerm && config.enableSearch) {
      filtered = data.filter(row => {
        // Search in submission ID
        if (row.submission_ref_id && row.submission_ref_id.toLowerCase().includes(searchTerm.toLowerCase())) {
          return true;
        }
        
        // Search in internal ID
        if (row.id && row.id.toLowerCase().includes(searchTerm.toLowerCase())) {
          return true;
        }
        
        // Search in form fields
        return displayFields.some(field => {
          const value = row.submission_data?.[field.id];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }

    // Apply column filters
    if (config.enableFiltering) {
      Object.entries(columnFilters).forEach(([fieldId, filterValue]) => {
        if (filterValue) {
          filtered = filtered.filter(row => {
            const value = row.submission_data?.[fieldId];
            return value && value.toString().toLowerCase().includes(filterValue.toLowerCase());
          });
        }
      });
    }

    // Apply complex filters
    if (complexFilters.length > 0) {
      filtered = filtered.filter(row => {
        return complexFilters.some(group => {
          if (group.conditions.length === 0) return true;
          
          if (group.logic === 'AND') {
            return group.conditions.every(condition => evaluateCondition(row, condition));
          } else {
            return group.conditions.some(condition => evaluateCondition(row, condition));
          }
        });
      });
    }

    // Apply multi-level sorting
    if (sortConfigs.length > 0 && config.enableSorting) {
      filtered = [...filtered].sort((a, b) => {
        for (const sortConfig of sortConfigs) {
          const aValue = a.submission_data?.[sortConfig.field] || '';
          const bValue = b.submission_data?.[sortConfig.field] || '';
          
          const comparison = sortConfig.direction === 'asc' 
            ? aValue.toString().localeCompare(bValue.toString())
            : bValue.toString().localeCompare(aValue.toString());
          
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, columnFilters, complexFilters, sortConfigs, displayFields, config, evaluateCondition]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedData.slice(startIndex, endIndex);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const exportData = useMemo(() => {
    const headers = displayFields.map(field => field.label);
    if (config.showMetadata) {
      headers.push('Submitted At', 'Submitted By');
    }
    
    const rows = filteredAndSortedData.map(row => {
      const values = displayFields.map(field => {
        const value = row.submission_data?.[field.id];
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'object') return JSON.stringify(value);
        return value.toString();
      });
      
      if (config.showMetadata) {
        values.push(
          new Date(row.submitted_at).toLocaleDateString(),
          row.submitted_by || 'Anonymous'
        );
      }
      
      return values;
    });

    return {
      headers,
      rows,
      filename: `${config.title || 'submission-data'}-${new Date().toISOString().split('T')[0]}`,
      title: config.title || 'Submission Data'
    };
  }, [filteredAndSortedData, displayFields, config]);

  const availableFields = useMemo(() => {
    return formFields
      .filter(field => !['header', 'horizontal_line', 'section_break'].includes(field.field_type))
      .map(field => ({
        id: field.id,
        label: field.label,
        type: field.field_type || 'text'
      }));
  }, [formFields]);

  // useEffect hooks
  useEffect(() => {
    if (config.formId) {
      loadData();
      loadFormFields();
      checkUserPermissions();
    }
  }, [config.formId]);

  useEffect(() => {
    const handleCrossReference = (event: any) => {
      const { submissionIds } = event.detail;
      setCrossReferenceData(submissionIds);
      setShowCrossReferenceDialog(true);
    };

    const tableElement = document.querySelector('[data-dynamic-table]');
    if (tableElement) {
      tableElement.addEventListener('showCrossReference', handleCrossReference);
      return () => {
        tableElement.removeEventListener('showCrossReference', handleCrossReference);
      };
    }
  }, []);

  // Regular functions and event handlers
  const handleViewSubmission = (submissionId: string) => {
    navigate(`/submission/${submissionId}`);
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    try {
      const { error } = await supabase
        .from('form_submissions')
        .delete()
        .eq('id', submissionId);
      
      if (error) {
        console.error('Error deleting submission:', error);
        return;
      }
      
      // Reload data after deletion
      loadData();
    } catch (error) {
      console.error('Error deleting submission:', error);
    }
  };

  const handleEditSubmission = (submission: any) => {
    setEditingSubmission(submission);
    setShowInlineEdit(true);
  };

  const handleRowSelect = (submissionId: string, checked: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(submissionId);
      } else {
        newSet.delete(submissionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedData.map(row => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleBulkEdit = () => {
    const selectedSubmissions = paginatedData.filter(row => selectedRows.has(row.id));
    if (selectedSubmissions.length > 0) {
      setEditingSubmission(selectedSubmissions);
      setShowBulkEdit(true);
    }
  };

  const handleBulkDelete = () => {
    if (selectedRows.size > 0) {
      setShowBulkDelete(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedRows(new Set());
  };

  const handleInlineEditSave = () => {
    loadData(); // Reload data after editing
    setSelectedRows(new Set()); // Clear selection
  };

  const handleBulkDeleteComplete = () => {
    loadData(); // Reload data after deletion
    setSelectedRows(new Set()); // Clear selection
  };

  const checkDeletePermission = async (submissionId: string): Promise<boolean> => {
    try {
      const { data: submission } = await supabase
        .from('form_submissions')
        .select('form_id')
        .eq('id', submissionId)
        .single();
      
      if (!submission) return false;
      
      const { data: form } = await supabase
        .from('forms')
        .select('created_by, organization_id')
        .eq('id', submission.form_id)
        .single();
      
      if (!form) return false;
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return false;
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, role, organization_id')
        .eq('id', user.user.id)
        .single();
      
      if (!profile) return false;
      
      return form.created_by === profile.email || 
             (profile.role === 'admin' && form.organization_id === profile.organization_id);
    } catch (error) {
      console.error('Error checking delete permission:', error);
      return false;
    }
  };

  const checkUserPermissions = async () => {
    if (!config.formId) return;
    
    try {
      const { data: form } = await supabase
        .from('forms')
        .select('created_by, organization_id')
        .eq('id', config.formId)
        .single();
      
      if (!form) return;
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, role, organization_id')
        .eq('id', user.user.id)
        .single();
      
      if (!profile) return;
      
      const canDelete = form.created_by === profile.email || 
                       (profile.role === 'admin' && form.organization_id === profile.organization_id);
      
      setCanDeleteSubmissions(canDelete);
    } catch (error) {
      console.error('Error checking user permissions:', error);
      setCanDeleteSubmissions(false);
    }
  };

  const loadFormFields = async () => {
    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', config.formId)
        .order('field_order', { ascending: true });

      if (error) {
        console.error('Error fetching form fields:', error);
        return;
      }

      setFormFields(fields || []);
      if (selectedColumns.length === 0 && fields && fields.length > 0) {
        const dataFields = fields.filter(f => !['header', 'horizontal_line', 'section_break'].includes(f.field_type));
        setSelectedColumns(dataFields.map(f => f.id));
      }
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: submissions, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          user_profiles!left(email)
        `)
        .eq('form_id', config.formId)
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching submissions:', error);
        return;
      }

      // Transform submissions to include user email
      const transformedSubmissions = (submissions || []).map(submission => ({
        ...submission,
        submitted_by_email: submission.user_profiles?.email || submission.submitted_by
      }));

      setData(transformedSubmissions);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);

  const handleAddSort = (field: string, label: string) => {
    setSortConfigs(prev => [...prev, { field, direction: 'asc', label }]);
  };

  const handleRemoveSort = (index: number) => {
    setSortConfigs(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleDirection = (index: number) => {
    setSortConfigs(prev => prev.map((config, i) => 
      i === index 
        ? { ...config, direction: config.direction === 'asc' ? 'desc' : 'asc' }
        : config
    ));
  };

  const handleColumnFilter = (fieldId: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleColumnToggle = (fieldId: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(fieldId)) {
        return prev.filter(id => id !== fieldId);
      } else {
        return [...prev, fieldId];
      }
    });
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-48">
          <div className="text-muted-foreground">Loading table data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!config.formId) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{config.title || 'Dynamic Table'}</span>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-muted-foreground">No form selected</p>
            <p className="text-sm text-muted-foreground mt-1">Configure this table to select a data source</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const containerClasses = isExpanded 
    ? "fixed inset-0 z-50 bg-background p-4 space-y-6"
    : "space-y-6";

  return (
    <div className={containerClasses} data-dynamic-table>
      {/* Analytics Section */}
      {!isExpanded && <SubmissionAnalytics data={data} />}
      
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">{config.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {filteredAndSortedData.length} record{filteredAndSortedData.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {isExpanded ? 'Normal View' : 'Expand'}
              </Button>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Settings className="h-4 w-4" />
                  Configure
                </Button>
              )}
            </div>
          </div>

          {/* Applied Filters */}
          {(Object.keys(columnFilters).length > 0 || complexFilters.length > 0) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {Object.entries(columnFilters).map(([fieldId, value]) => {
                if (!value) return null;
                const field = displayFields.find(f => f.id === fieldId);
                return (
                  <Badge key={fieldId} variant="secondary" className="text-xs h-5">
                    {field?.label}: {value}
                    <button
                      className="ml-1"
                      onClick={() => handleColumnFilter(fieldId, '')}
                    >
                      ×
                    </button>
                  </Badge>
                );
              })}
              {complexFilters.map((group, index) => (
                <Badge key={`complex-${index}`} variant="secondary" className="text-xs h-5">
                  Complex Filter {index + 1}
                  <button
                    className="ml-1"
                    onClick={() => setComplexFilters(prev => prev.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Compact Controls Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left Side Controls */}
            <div className="flex items-center gap-1 flex-wrap">
              <SavedFiltersManager
                formId={config.formId}
                onApplyFilter={setComplexFilters}
                currentFilters={complexFilters}
              />
              
              <DynamicTableColumnSelector
                formFields={formFields}
                selectedColumns={selectedColumns}
                onColumnToggle={handleColumnToggle}
              />

              {config.enableFiltering && (
                <ComplexFilter
                  filters={complexFilters}
                  onFiltersChange={setComplexFilters}
                  availableFields={availableFields}
                  formId={config.formId}
                />
              )}

              {config.enableSorting && (
                <SortingControls
                  availableFields={displayFields.map(f => ({ id: f.id, label: f.label }))}
                  sortConfigs={sortConfigs}
                  onAddSort={handleAddSort}
                  onRemoveSort={handleRemoveSort}
                  onToggleDirection={handleToggleDirection}
                />
              )}

              <ExportDropdown data={exportData} />
              
              <ImportButton 
                formId={config.formId}
                formFields={formFields}
                onImportComplete={loadData}
              />
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-2">
              {/* Search */}
              {config.enableSearch && (
                <div className="relative w-48">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
              )}

              {/* Auto Refresh Toggle */}
              <div className="flex items-center space-x-1 bg-muted/30 rounded-md px-2 py-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-muted-foreground">Auto</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadData}
                  className="h-5 w-5 p-0"
                >
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      
        <CardContent className="p-2">
          <div className={`overflow-auto ${isExpanded ? 'h-[85vh]' : 'max-h-[70vh]'}`}>
            <div className="space-y-2">
              {/* Compact Page Size Selector */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-muted-foreground">Show:</span>
                  <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                    <SelectTrigger className="w-16 h-6 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/50">
                  <TableRow className="border-b">
                    <TableHead className="w-10 h-8">
                      <Checkbox
                        checked={paginatedData.length > 0 && paginatedData.every(row => selectedRows.has(row.id))}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-medium h-8">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Submission ID
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium h-8">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        User
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium h-8">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Submitted
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium h-8">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Status
                      </div>
                    </TableHead>
                    
                    {/* Form fields */}
                    {displayFields.map(field => (
                      <TableHead key={field.id} className="text-xs font-medium h-8">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{field.label}</span>
                          {config.enableFiltering && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`${columnFilters[field.id] ? 'text-primary' : 'text-muted-foreground'} h-5 w-5 p-0`}
                                  aria-label={`Filter ${field.label}`}
                                >
                                  <Filter className="h-2.5 w-2.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-64">
                                <div className="space-y-2">
                                  <Input
                                    placeholder={`Filter ${field.label}...`}
                                    value={columnFilters[field.id] || ''}
                                    onChange={(e) => handleColumnFilter(field.id, e.target.value)}
                                  />
                                  {columnFilters[field.id] && (
                                    <div className="flex justify-end">
                                      <Button variant="ghost" size="sm" onClick={() => handleColumnFilter(field.id, '')}>
                                        Clear
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-xs font-medium text-center h-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={displayFields.length + 6} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {data.length === 0 ? 'No data available' : 'No records match your filters'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((row) => (
                      <TableRow key={row.id} className={`${selectedRows.has(row.id) ? 'bg-muted/50' : ''}`}>
                        <TableCell className="py-2">
                          <Checkbox
                            checked={selectedRows.has(row.id)}
                            onCheckedChange={(checked) => handleRowSelect(row.id, Boolean(checked))}
                            aria-label={`Select row ${row.id}`}
                          />
                        </TableCell>
                        
                        {/* Submission ID */}
                        <TableCell className="py-2">
                          <Button
                            variant="link"
                            className="font-mono text-xs p-0 h-auto underline"
                            onClick={() => navigate(`/submission/${row.id}`)}
                          >
                            #{row.submission_ref_id || row.id.slice(0, 8)}
                          </Button>
                        </TableCell>
                        
                        {/* User Info */}
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                              {row.submitted_by_email ? row.submitted_by_email.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="text-xs truncate max-w-32">
                              {row.submitted_by_email || 'Anonymous'}
                            </span>
                          </div>
                        </TableCell>
                       
                       {/* Submitted Date */}
                       <TableCell className="py-2">
                         <div className="text-xs">
                           <div className="font-medium">
                             {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '-'}
                           </div>
                           <div className="text-muted-foreground">
                             {row.submitted_at ? new Date(row.submitted_at).toLocaleTimeString() : '-'}
                           </div>
                         </div>
                       </TableCell>
                       
                       {/* Status */}
                       <TableCell className="py-2">
                         <Badge variant="secondary" className="text-xs">
                           Submitted
                         </Badge>
                       </TableCell>
                       
                       {/* Form Fields */}
                      {displayFields.map(field => (
                         <TableCell key={field.id} className="py-2 max-w-48">
                           <div className="min-w-0">
                             <FormDataCell 
                               value={row.submission_data?.[field.id]}
                               fieldType={field.field_type || field.type}
                               field={field}
                             />
                           </div>
                         </TableCell>
                       ))}
                       
                       <TableCell className="py-2">
                         <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewSubmission(row.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            {canDeleteSubmissions && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditSubmission(row);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <DeleteSubmissionButton
                                  submissionId={row.id}
                                  onDelete={() => handleDeleteSubmission(row.id)}
                                  checkPermission={() => checkDeletePermission(row.id)}
                                />
                              </>
                            )}
                         </div>
                       </TableCell>
                    </TableRow>
                  ))
                )}
                </TableBody>
              </Table>

              {/* Compact Pagination */}
              <div className="flex items-center justify-between px-2 py-1 border-t">
                <div className="text-xs text-muted-foreground">
                  {Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedData.length)}-{Math.min(currentPage * pageSize, filteredAndSortedData.length)} of {filteredAndSortedData.length}
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} h-6 px-2 text-xs`}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      const pageNumber = currentPage <= 2 ? i + 1 : currentPage - 1 + i;
                      if (pageNumber > totalPages) return null;
                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            onClick={() => setCurrentPage(pageNumber)}
                            isActive={currentPage === pageNumber}
                            className="cursor-pointer h-6 px-2 text-xs"
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} h-6 px-2 text-xs`}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedRows.size}
          onBulkEdit={handleBulkEdit}
          onBulkDelete={handleBulkDelete}
          onClearSelection={handleClearSelection}
          canDelete={canDeleteSubmissions}
        />
      )}

      {/* Dialogs */}
      <InlineEditDialog
        isOpen={showInlineEdit}
        onOpenChange={setShowInlineEdit}
        submissions={editingSubmission ? (Array.isArray(editingSubmission) ? editingSubmission : [editingSubmission]) : []}
        formFields={formFields || []}
        onSave={handleInlineEditSave}
      />

      <BulkDeleteDialog
        isOpen={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        submissionIds={Array.from(selectedRows)}
        onDelete={handleBulkDeleteComplete}
      />

      <CrossReferenceDialog
        open={showCrossReferenceDialog}
        onOpenChange={setShowCrossReferenceDialog}
        submissionIds={crossReferenceData || []}
        parentFormId={config.formId}
      />
    </div>
  );
}