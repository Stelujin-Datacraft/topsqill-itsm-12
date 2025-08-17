
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
import { ChevronUp, ChevronDown, Search, Filter, Settings, Eye, Maximize2, Minimize2, Trash2, Edit3 } from 'lucide-react';
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
  
  // New state for bulk operations and inline editing
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showInlineEdit, setShowInlineEdit] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<any>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [canDeleteSubmissions, setCanDeleteSubmissions] = useState(false);
  
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
    return formFields.filter(field => columnsToShow.includes(field.id));
  }, [formFields, selectedColumns, config.selectedColumns]);

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;

    // Apply search
    if (searchTerm && config.enableSearch) {
      filtered = data.filter(row => {
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
    return formFields.map(field => ({
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
        setSelectedColumns(fields.map(f => f.id));
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
        .select('*')
        .eq('form_id', config.formId)
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching submissions:', error);
        return;
      }

      setData(submissions || []);
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
    <div className={containerClasses}>
      {/* Analytics Section */}
      {!isExpanded && <SubmissionAnalytics data={data} />}
      
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>{config.title || 'Dynamic Table'}</span>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {filteredAndSortedData.length} records
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Exit fullscreen" : "Expand fullscreen"}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <SavedFiltersManager
                formId={config.formId}
                onApplyFilter={setComplexFilters}
                currentFilters={complexFilters}
              />
              <ExportDropdown data={exportData} disabled={filteredAndSortedData.length === 0} />
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
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              )}
            </div>
          </CardTitle>
          
          <div className="space-y-3 mt-3">
            {config.enableSearch && (
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
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

            {filteredAndSortedData.length > pageSize && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select value={pageSize.toString()} onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className={isExpanded ? "h-[calc(100vh-200px)]" : "h-[600px]"}>
            <div className="rounded-xl border border-border shadow-sm bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 overflow-hidden">
              <Table>
            <TableHeader className="sticky top-0 z-20 bg-gradient-to-b from-background/95 to-background/90 backdrop-blur-sm border-b-2 border-primary/20 shadow-sm">
              <TableRow className="border-b h-14 hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={paginatedData.length > 0 && paginatedData.every(row => selectedRows.has(row.id))}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
                {displayFields.map(field => (
                  <TableHead key={field.id} className="uppercase text-xs tracking-wider font-semibold text-foreground/90" style={{ minWidth: '200px' }}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{field.label}</span>
                      {config.enableSorting && sortConfigs.find(s => s.field === field.id) && (
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                          {sortConfigs.findIndex(s => s.field === field.id) + 1}
                        </Badge>
                      )}
                      {config.enableFiltering && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`${columnFilters[field.id] ? 'text-primary bg-primary/10' : 'text-foreground/70'} h-7 w-7 p-0 hover:text-primary hover:bg-primary/10 transition-colors`}
                              aria-label={`Filter ${field.label}`}
                              title={`Filter ${field.label}`}
                            >
                              <Filter className="h-3.5 w-3.5" />
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
                {config.showMetadata && (
                  <>
                    <TableHead className="uppercase text-xs tracking-wider font-semibold text-foreground/90" style={{ minWidth: '200px' }}>Submitted At</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider font-semibold text-foreground/90" style={{ minWidth: '200px' }}>Submitted By</TableHead>
                  </>
                )}
                <TableHead className="uppercase text-xs tracking-wider font-semibold text-foreground/90" style={{ minWidth: '140px' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={displayFields.length + (config.showMetadata ? 2 : 0) + 2} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {data.length === 0 ? 'No data available' : 'No records match your filters'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                 paginatedData.map((row) => (
                   <TableRow key={row.id} className="hover:bg-accent/10 transition-colors">
                     <TableCell>
                       <Checkbox
                         checked={selectedRows.has(row.id)}
                         onCheckedChange={(checked) => handleRowSelect(row.id, Boolean(checked))}
                         aria-label={`Select row ${row.id}`}
                       />
                     </TableCell>
                     {displayFields.map(field => (
                        <TableCell key={field.id} style={{ minWidth: '200px' }}>
                          <FormDataCell 
                            value={row.submission_data?.[field.id]}
                            fieldType={field.field_type || field.type}
                            field={field}
                          />
                        </TableCell>
                      ))}
                      {config.showMetadata && (
                        <>
                          <TableCell style={{ minWidth: '200px' }}>
                            {new Date(row.submitted_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell style={{ minWidth: '200px' }}>
                            <SubmittedByCell submissionData={row} />
                          </TableCell>
                        </>
                      )}
                      <TableCell style={{ minWidth: '140px' }}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSubmission(row.id)}
                            className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                            title="View submission details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSubmission(row)}
                            className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                            title="Edit submission"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <DeleteSubmissionButton 
                            submissionId={row.id}
                            onDelete={() => handleDeleteSubmission(row.id)}
                            checkPermission={() => checkDeletePermission(row.id)}
                          />
                        </div>
                      </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
            </div>
        </ScrollArea>
      </CardContent>
      
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(pageNum);
                        }}
                        isActive={currentPage === pageNum}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </Card>

    {/* Bulk Actions Bar */}
    <BulkActionsBar
      selectedCount={selectedRows.size}
      onBulkEdit={handleBulkEdit}
      onBulkDelete={handleBulkDelete}
      onClearSelection={handleClearSelection}
      canDelete={canDeleteSubmissions}
    />

    {/* Individual Inline Edit Dialog */}
    <InlineEditDialog
      isOpen={showInlineEdit}
      onOpenChange={setShowInlineEdit}
      submissions={editingSubmission && !Array.isArray(editingSubmission) ? [editingSubmission] : []}
      formFields={formFields}
      onSave={handleInlineEditSave}
    />

    {/* Bulk Edit Dialog */}
    <InlineEditDialog
      isOpen={showBulkEdit}
      onOpenChange={setShowBulkEdit}
      submissions={Array.isArray(editingSubmission) ? editingSubmission : []}
      formFields={formFields}
      onSave={handleInlineEditSave}
    />

    {/* Bulk Delete Dialog */}
    <BulkDeleteDialog
      isOpen={showBulkDelete}
      onOpenChange={setShowBulkDelete}
      submissionIds={Array.from(selectedRows)}
      onDelete={handleBulkDeleteComplete}
    />
    </div>
  );
}
