import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, ChevronLeft, ChevronRight, Database, LinkIcon, Eye, RefreshCw, Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { FormReferenceTag } from '@/components/FormReferenceTag';
import { OptimizedFilterControls } from './components/OptimizedFilterControls';
import { SortControls, getSortIcon } from './components/SortControls';
import { useOptimizedFormSubmissionData } from '@/hooks/useOptimizedFormSubmissionData';
interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: string;
}
interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}
interface FormDataTableConfig {
  targetFormId: string;
  targetFormName?: string;
  filters?: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  displayColumns?: string[];
  enableSorting?: boolean;
  enableSearch?: boolean;
  pageSize?: number;
  isParentReference?: boolean;
  isChildField?: boolean;
}
interface OptimizedFormDataTableProps {
  config: FormDataTableConfig;
  fieldType: 'record-table' | 'cross-reference' | 'matrix-grid';
  value?: any[];
  onChange?: (selectedRecords: any[]) => void;
  autoSelectedRecords?: SelectedRecord[];
  isAutoSelectionLoading?: boolean;
}
interface SelectedRecord {
  id: string;
  submission_ref_id: string;
  displayData: Record<string, any>;
}
export function OptimizedFormDataTable({
  config,
  fieldType,
  value = [],
  onChange,
  autoSelectedRecords = [],
  isAutoSelectionLoading = false
}: OptimizedFormDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [sortConditions, setSortConditions] = useState<SortCondition[]>([]);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);

  // Separate state for modal selection (temporary until confirmed)
  const [modalSelectedRecordIds, setModalSelectedRecordIds] = useState<Set<string>>(new Set());

  // State for confirmed selected records
  const [selectedRecords, setSelectedRecords] = useState<SelectedRecord[]>([]);
  const pageSize = config.pageSize || 10;
  const displayColumns = config.displayColumns || [];
  const isCrossReference = fieldType === 'cross-reference';
  const isChildCrossReference = config.isChildField === true;

  // Convert config filters to the format expected by the hook
  const configFilters = (config.filters || []).map(filter => ({
    field: filter.field,
    operator: filter.operator,
    value: filter.value,
    logic: 'AND'
  }));
  const {
    data,
    formFields,
    targetForm,
    loading,
    totalRecords,
    error,
    refetch
  } = useOptimizedFormSubmissionData({
    targetFormId: config.targetFormId,
    displayColumns,
    filters: [...configFilters, ...activeFilters],
    searchTerm,
    sortConditions,
    currentPage,
    pageSize
  });

  // Initialize selected records from value prop and auto-selected records (only once on mount)
  useEffect(() => {
    console.log('🚀 Initializing selected records from props:', {
      value,
      autoSelectedRecords
    });
    const manuallySelectedRecords = value && Array.isArray(value) && value.length > 0 ? value.map(item => ({
      id: item.id || item.recordId,
      submission_ref_id: item.submission_ref_id || item.refId,
      displayData: item.displayData || item
    })) : [];

    // Combine manually selected and auto-selected records, avoiding duplicates
    const allRecords = [...manuallySelectedRecords];
    autoSelectedRecords.forEach(autoRecord => {
      const alreadyExists = allRecords.some(record => record.id === autoRecord.id);
      if (!alreadyExists) {
        allRecords.push(autoRecord);
      }
    });
    console.log('✅ Setting initial selected records:', allRecords);
    setSelectedRecords(allRecords);
  }, []); // Only run once on mount

  // Update selected records when autoSelectedRecords changes (but don't reset manually selected ones)
  useEffect(() => {
    if (autoSelectedRecords.length > 0) {
      console.log('🔄 Auto-selected records updated:', autoSelectedRecords);
      setSelectedRecords(prevSelected => {
        // Keep existing manually selected records
        const manuallySelected = prevSelected.filter(record => !autoSelectedRecords.some(autoRecord => autoRecord.id === record.id));

        // Add new auto-selected records
        const updatedRecords = [...manuallySelected, ...autoSelectedRecords];
        console.log('✅ Updated selected records with auto-selection:', updatedRecords);
        return updatedRecords;
      });
    }
  }, [autoSelectedRecords]);

  // Initialize modal selection state when modal opens
  const handleModalOpen = () => {
    console.log('🔍 Modal opening, initializing selection state with current selected records');
    const currentSelectedIds = selectedRecords.map(r => r.id);
    console.log('🔄 Setting modal selected IDs:', currentSelectedIds);
    setModalSelectedRecordIds(new Set(currentSelectedIds));
    setIsSelectionModalOpen(true);
  };
  const totalPages = Math.ceil(totalRecords / pageSize);
  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };
  const handleSort = (fieldId: string) => {
    if (!config.enableSorting) return;
    setSortConditions(prev => {
      const existing = prev.find(s => s.field === fieldId);
      if (existing) {
        if (existing.direction === 'asc') {
          return prev.map(s => s.field === fieldId ? {
            ...s,
            direction: 'desc' as const
          } : s);
        } else {
          return prev.filter(s => s.field !== fieldId);
        }
      } else {
        return [...prev, {
          field: fieldId,
          direction: 'asc' as const
        }];
      }
    });
  };
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };
  const handleViewSubmission = (submissionId: string) => {
    const url = `/submission/${submissionId}`;
    window.open(url, '_blank');
  };
  const formatCellValue = (value: any, fieldType?: string) => {
    if (value === null || value === undefined || value === '' || value === '-') {
      return <span className="text-gray-400">-</span>;
    }
    if (fieldType === 'date' || fieldType === 'datetime') {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    }
    return String(value);
  };
  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'draft': 'bg-gray-100 text-gray-800'
    };
    return <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>;
  };
  const handleRecordSelection = (recordId: string, isSelected: boolean) => {
    console.log('🔍 handleRecordSelection called:', {
      recordId,
      isSelected,
      currentSelectedIds: Array.from(modalSelectedRecordIds)
    });
    const newSelectedIds = new Set(modalSelectedRecordIds);
    if (isSelected) {
      newSelectedIds.add(recordId);
      console.log('✅ Adding record to modal selection:', recordId, 'New set size:', newSelectedIds.size);
    } else {
      newSelectedIds.delete(recordId);
      console.log('❌ Removing record from modal selection:', recordId, 'New set size:', newSelectedIds.size);
    }
    console.log('🔄 Setting new modalSelectedRecordIds:', Array.from(newSelectedIds));
    setModalSelectedRecordIds(newSelectedIds);
  };
  const handleSelectAll = () => {
    const allRecordIds = data.map(record => record.id);
    console.log('🔍 handleSelectAll called:', {
      allRecordIds,
      dataLength: data.length
    });
    console.log('🔄 Setting modalSelectedRecordIds to all records:', allRecordIds);
    setModalSelectedRecordIds(new Set(allRecordIds));
  };
  const handleDeselectAll = () => {
    console.log('🔍 handleDeselectAll called');
    console.log('🔄 Setting modalSelectedRecordIds to empty set');
    setModalSelectedRecordIds(new Set());
  };
  const handleConfirmSelection = () => {
    console.log('🔍 Confirming selection:', Array.from(modalSelectedRecordIds));

    // Keep auto-selected records (they shouldn't be removed)
    const autoSelectedIds = autoSelectedRecords.map(r => r.id);
    const preservedAutoRecords = selectedRecords.filter(record => autoSelectedIds.includes(record.id));

    // Add newly selected records from modal
    const newRecordsFromModal = data.filter(record => modalSelectedRecordIds.has(record.id)).map(record => ({
      id: record.id,
      submission_ref_id: record.submission_ref_id || `SUB-${record.id.slice(0, 8)}`,
      displayData: displayColumns.reduce((acc, colId) => {
        acc[colId] = record[colId];
        return acc;
      }, {} as Record<string, any>)
    }));

    // Combine preserved auto-selected and newly selected records
    const allSelectedRecords = [...preservedAutoRecords, ...newRecordsFromModal];
    console.log('✅ Final confirmed selection:', allSelectedRecords);
    setSelectedRecords(allSelectedRecords);
    setIsSelectionModalOpen(false);

    // Call onChange with all selected records
    if (onChange) {
      onChange(allSelectedRecords);
    }
  };
  const handleRemoveSelectedRecord = (recordId: string) => {
    console.log('🗑️ Removing selected record:', recordId);
    const updatedRecords = selectedRecords.filter(record => record.id !== recordId);
    setSelectedRecords(updatedRecords);
    if (onChange) {
      onChange(updatedRecords);
    }
  };
  const getDisplayValue = (record: SelectedRecord) => {
    const primaryField = displayColumns[0];
    if (primaryField && record.displayData[primaryField]) {
      return record.displayData[primaryField];
    }
    return record.submission_ref_id;
  };

  // Filter data to show only selected records in the main table for cross-reference
  // For child cross-reference fields, show auto-selected records from parent form
  const displayData = (() => {
    if (isCrossReference && isChildCrossReference) {
      // For child cross-reference, display auto-selected records (parent form data)
      console.log('🔍 Child cross-reference displaying auto-selected records:', autoSelectedRecords);
      return autoSelectedRecords.map(record => ({
        id: record.id,
        submission_ref_id: record.submission_ref_id,
        ...record.displayData,
        submitted_at: new Date().toISOString(), // Default timestamp
        approval_status: 'approved' // Default status for parent records
      }));
    } else if (isCrossReference && !isChildCrossReference) {
      // For regular cross-reference, filter to show only selected records
      return data.filter(record => selectedRecords.some(selected => selected.id === record.id));
    } else {
      // For regular tables, show all data
      return data;
    }
  })();
  if (!config.targetFormId) {
    return <Card className="w-full">
        <CardContent className="p-8 text-center">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No target form configured</p>
        </CardContent>
      </Card>;
  }
  return <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {fieldType === 'cross-reference' ? <LinkIcon className="h-5 w-5 text-blue-500" /> : <Database className="h-5 w-5 text-purple-500" />}
            <div className="flex flex-col">
              <CardTitle className="text-lg">
                {targetForm?.name || config.targetFormName || 'Form Submissions'}
                {config.isParentReference && <Badge variant="secondary" className="ml-2">Parent</Badge>}
              </CardTitle>
              {targetForm?.reference_id && <FormReferenceTag referenceId={targetForm.reference_id} className="mt-1" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {isCrossReference ? selectedRecords.length : totalRecords} record{(isCrossReference ? selectedRecords.length : totalRecords) !== 1 ? 's' : ''}
            </Badge>
            {isCrossReference && !isChildCrossReference && <Dialog open={isSelectionModalOpen} onOpenChange={setIsSelectionModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleModalOpen}>
                    <Plus className="h-4 w-4 mr-2" />
                    Select Records
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Select Records from {targetForm?.name}</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Selection Controls */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={data.length === 0}>
                          Select All
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                          Deselect All
                        </Button>
                        <Badge variant="secondary">
                          {modalSelectedRecordIds.size} selected
                        </Badge>
                      </div>
                      <Button onClick={handleConfirmSelection}>
                        Confirm Selection
                      </Button>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex items-center gap-4 mb-4">
                      {config.enableSearch && <div className="relative flex-1 max-w-sm">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input placeholder="Search submissions..." value={searchTerm} onChange={e => handleSearch(e.target.value)} className="pl-9" />
                        </div>}
                      
                      <OptimizedFilterControls activeFilters={activeFilters} setActiveFilters={setActiveFilters} formFields={formFields} displayColumns={displayColumns} />
                    </div>

                    {/* Selection Table */}
                    <div className="border rounded-lg overflow-auto flex-1">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox checked={data.length > 0 && modalSelectedRecordIds.size === data.length} onCheckedChange={checked => {
                            if (checked) {
                              handleSelectAll();
                            } else {
                              handleDeselectAll();
                            }
                          }} />
                            </TableHead>
                            <TableHead className="w-32">Ref ID</TableHead>
                            {displayColumns.map(fieldId => <TableHead key={fieldId} className={config.enableSorting ? "cursor-pointer hover:bg-gray-50" : ""} onClick={() => handleSort(fieldId)}>
                                <div className="flex items-center gap-2">
                                  {getFieldLabel(fieldId)}
                                  {config.enableSorting && getSortIcon(fieldId, sortConditions)}
                                </div>
                              </TableHead>)}
                            <TableHead>Status</TableHead>
                            <TableHead>Submitted</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? <TableRow>
                              <TableCell colSpan={displayColumns.length + 4} className="text-center py-8">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                  Loading...
                                </div>
                              </TableCell>
                            </TableRow> : data.length === 0 ? <TableRow>
                              <TableCell colSpan={displayColumns.length + 4} className="text-center py-8 text-gray-500">
                                No submissions found
                              </TableCell>
                            </TableRow> : data.map((row, index) => <TableRow key={row.id || index}>
                                <TableCell>
                                  <Checkbox checked={modalSelectedRecordIds.has(row.id)} onCheckedChange={checked => handleRecordSelection(row.id, checked as boolean)} />
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {row.submission_ref_id || `SUB-${String(index + 1).padStart(3, '0')}`}
                                </TableCell>
                                {displayColumns.map(fieldId => {
                          const field = formFields.find(f => f.id === fieldId);
                          return <TableCell key={fieldId}>
                                      {formatCellValue(row[fieldId], field?.field_type)}
                                    </TableCell>;
                        })}
                                <TableCell>
                                  {getStatusBadge(row.approval_status || 'pending')}
                                </TableCell>
                                <TableCell className="text-sm text-gray-500">
                                  {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '-'}
                                </TableCell>
                              </TableRow>)}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-gray-500">
                          Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          
                          <Select value={currentPage.toString()} onValueChange={value => setCurrentPage(parseInt(value))}>
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({
                          length: totalPages
                        }, (_, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  {i + 1}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                          
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>}
                  </div>
                </DialogContent>
              </Dialog>}
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading} className="h-8 w-8 p-0">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Error Display */}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            <strong>Error:</strong> {error}
          </div>}

        {/* Applied Filters from Config */}
        {config.filters && config.filters.length > 0 && <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">Pre-configured Filters</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.filters.map((filter, index) => <Badge key={index} variant="outline" className="text-xs">
                  {getFieldLabel(filter.field)} {filter.operator} {filter.value}
                </Badge>)}
            </div>
          </div>}

        {/* Selected Records Display for Cross Reference */}
        {isCrossReference && selectedRecords.length > 0 && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">Selected Records ({selectedRecords.length})</Badge>
              {autoSelectedRecords.length > 0 && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  {autoSelectedRecords.length} Auto-selected
                </Badge>}
              {isAutoSelectionLoading && <Badge variant="outline" className="text-xs">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-1 border-blue-500 mr-1"></div>
                  Loading auto-selection...
                </Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedRecords.map(record => {
            const isAutoSelected = autoSelectedRecords.some(autoRecord => autoRecord.id === record.id);
            return <Badge key={record.id} variant="outline" className={`flex items-center gap-1 ${isAutoSelected ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`} title={isAutoSelected ? 'Auto-selected from parent form' : 'Manually selected'}>
                    {isAutoSelected && <span className="text-xs mr-1">🔗</span>}
                    {getDisplayValue(record)}
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1 hover:bg-red-100" onClick={() => handleRemoveSelectedRecord(record.id)} title={isAutoSelected ? 'Remove auto-selected record' : 'Remove selected record'}>
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>;
          })}
            </div>
          </div>}

        {/* Search and Controls - Only for non-cross-reference */}
        {!isCrossReference && <div className="flex items-center gap-4 mb-4">
            {config.enableSearch && <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search submissions..." value={searchTerm} onChange={e => handleSearch(e.target.value)} className="pl-9" />
              </div>}
            
            <OptimizedFilterControls activeFilters={activeFilters} setActiveFilters={setActiveFilters} formFields={formFields} displayColumns={displayColumns} />
          </div>}

        {/* Sort Display - Only for non-cross-reference */}
        {!isCrossReference && <SortControls sortConditions={sortConditions} setSortConditions={setSortConditions} formFields={formFields} displayColumns={displayColumns} />}

        {/* Data Table */}
        <div className="border rounded-lg overflow-hidden mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Ref ID</TableHead>
                {displayColumns.map(fieldId => <TableHead key={fieldId} className={config.enableSorting && !isCrossReference ? "cursor-pointer hover:bg-gray-50" : ""} onClick={() => !isCrossReference && handleSort(fieldId)}>
                    <div className="flex items-center gap-2">
                      {getFieldLabel(fieldId)}
                      {config.enableSorting && !isCrossReference && getSortIcon(fieldId, sortConditions)}
                    </div>
                  </TableHead>)}
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow>
                  <TableCell colSpan={displayColumns.length + 4} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      Loading...
                    </div>
                  </TableCell>
                </TableRow> : displayData.length === 0 ? <TableRow>
                  <TableCell colSpan={displayColumns.length + 4} className="text-center py-8 text-gray-500">
                    {error ? 'Error loading data' : isCrossReference && isChildCrossReference ? 'No parent records reference this submission' : isCrossReference ? 'No records selected' : 'No submissions have been made yet!'}
                    {config.isParentReference && !error && !isCrossReference && <div className="text-sm mt-1">
                        Parent form records will appear here when available
                      </div>}
                  </TableCell>
                </TableRow> : displayData.map((row, index) => <TableRow key={row.id || index}>
                    <TableCell className="font-mono text-sm">
                      {row.submission_ref_id || `SUB-${String(index + 1).padStart(3, '0')}`}
                    </TableCell>
                    {displayColumns.map(fieldId => {
                const field = formFields.find(f => f.id === fieldId);
                return <TableCell key={fieldId}>
                          {formatCellValue(row[fieldId], field?.field_type)}
                        </TableCell>;
              })}
                    <TableCell>
                      {getStatusBadge(row.approval_status || 'pending')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleViewSubmission(row.id)} className="h-8 w-8 p-0" title="View Submission">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>)}
            </TableBody>
          </Table>
        </div>

        {/* Pagination for non-cross-reference only */}
        {!isCrossReference && totalPages > 1 && <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <Select value={currentPage.toString()} onValueChange={value => setCurrentPage(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({
                length: totalPages
              }, (_, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {i + 1}
                    </SelectItem>)}
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>}
      </CardContent>
    </Card>;
}