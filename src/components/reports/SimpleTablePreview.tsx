
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Search, Download, RefreshCw, Database } from 'lucide-react';
import { Form } from '@/types/form';
import { useTableData } from '@/hooks/useTableData';
import { rowPassesSearch, extractComparableValue, extractNumericValue } from '@/utils/filterUtils';

interface DisplayField {
  id: string;
  label: string;
  type: string;
}

// Helper function to safely format cell values for display
const formatCellValue = (value: any, fieldType?: string): string => {
  if (value === null || value === undefined) return '-';
  
  // Handle arrays (multi-select, tags, etc.)
  if (Array.isArray(value)) {
    return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
  }
  
  // Handle objects (address, submission-access, etc.)
  if (typeof value === 'object') {
    // Address field
    if ('street' in value || 'city' in value || 'state' in value) {
      const parts = [value.street, value.city, value.state, value.postal, value.country].filter(Boolean);
      return parts.join(', ') || '-';
    }
    
    // Submission-access field
    if ('users' in value || 'groups' in value) {
      const users = Array.isArray(value.users) ? value.users : [];
      const groups = Array.isArray(value.groups) ? value.groups : [];
      const parts = [...users, ...groups.map((g: string) => `[${g}]`)];
      return parts.join(', ') || '-';
    }
    
    // Generic object - stringify
    return JSON.stringify(value);
  }
  
  // Handle primitives
  return String(value);
};

interface FilterGroup {
  conditions: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
}

interface SimpleTablePreviewProps {
  selectedForm: Form | null;
  selectedColumns: string[];
  filters: FilterGroup[];
  enableSearch: boolean;
  enableSorting: boolean;
  enableExport: boolean;
  pageSize: number;
  title?: string;
}

export function SimpleTablePreview({
  selectedForm,
  selectedColumns,
  filters,
  enableSearch,
  enableSorting,
  enableExport,
  pageSize,
  title
}: SimpleTablePreviewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data, loading, totalCount, currentPage, setCurrentPage, refetch } = useTableData(
    selectedForm?.id || '',
    filters,
    pageSize
  );

  const displayFields = useMemo((): DisplayField[] => {
    if (!selectedForm) return [];
    
    const metadataFields: DisplayField[] = [
      { id: 'submitted_at', label: 'Submitted At', type: 'metadata' },
      { id: 'submitted_by', label: 'Submitted By', type: 'metadata' },
      { id: 'submission_ref_id', label: 'Reference ID', type: 'metadata' }
    ];
    
    const formFields: DisplayField[] = selectedForm.fields.map(field => ({
      id: field.id,
      label: field.label,
      type: field.type
    }));
    
    const allFields = [...metadataFields, ...formFields];
    
    if (selectedColumns.length > 0) {
      return allFields.filter(field => selectedColumns.includes(field.id));
    }
    
    return allFields;
  }, [selectedForm, selectedColumns]);

  // Build field type map and field config map for proper search/sort
  const { fieldTypeMap, fieldConfigMap } = useMemo(() => {
    const typeMap: Record<string, string> = {};
    const configMap: Record<string, any> = {};
    
    displayFields.forEach(field => {
      typeMap[field.id] = field.type || '';
    });
    
    if (selectedForm?.fields) {
      selectedForm.fields.forEach((field: any) => {
        configMap[field.id] = {
          options: field.options,
          custom_config: field.custom_config || field.customConfig
        };
      });
    }
    
    return { fieldTypeMap: typeMap, fieldConfigMap: configMap };
  }, [displayFields, selectedForm]);

  const filteredData = useMemo(() => {
    if (!enableSearch || !searchTerm) return data;
    return data.filter(row => rowPassesSearch(row, searchTerm, fieldTypeMap, fieldConfigMap));
  }, [data, searchTerm, enableSearch, fieldTypeMap, fieldConfigMap]);

  // Sort the filtered data
  const sortedData = useMemo(() => {
    if (!enableSorting || !sortField) return filteredData;
    
    const fieldType = fieldTypeMap[sortField] || '';
    const fieldConfig = fieldConfigMap[sortField];
    
    // Determine if this is a numeric field type
    const numericTypes = ['number', 'currency', 'slider', 'rating', 'calculation'];
    const isNumericField = numericTypes.includes(fieldType);
    
    // Determine if this is a date field type
    const dateTypes = ['date', 'datetime', 'time', 'metadata'];
    const isDateField = dateTypes.includes(fieldType) || sortField === 'submitted_at';
    
    return [...filteredData].sort((a, b) => {
      let valueA: any;
      let valueB: any;
      
      // Extract values based on field type (metadata vs submission_data)
      if (fieldType === 'metadata' || ['submitted_at', 'submitted_by', 'submission_ref_id'].includes(sortField)) {
        valueA = a[sortField as keyof typeof a];
        valueB = b[sortField as keyof typeof b];
      } else {
        valueA = a.submission_data?.[sortField];
        valueB = b.submission_data?.[sortField];
      }
      
      // Handle null/undefined values - always sort to end
      if (valueA === null || valueA === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (valueB === null || valueB === undefined) return sortDirection === 'asc' ? -1 : 1;
      
      let comparison = 0;
      
      // Check if values are currency objects (detect by structure, not just fieldType)
      const isCurrencyObject = (v: any) => typeof v === 'object' && v !== null && ('amount' in v || ('value' in v && 'currency' in v));
      const isAddressObject = (v: any) => typeof v === 'object' && v !== null && ('street' in v || 'city' in v || 'state' in v || 'country' in v);
      
      if (isDateField) {
        // Date comparison
        const dateA = new Date(valueA).getTime();
        const dateB = new Date(valueB).getTime();
        comparison = dateA - dateB;
      } else if (isNumericField || isCurrencyObject(valueA) || isCurrencyObject(valueB)) {
        // Numeric comparison using extractNumericValue for complex types
        const numA = extractNumericValue(valueA) ?? 0;
        const numB = extractNumericValue(valueB) ?? 0;
        comparison = numA - numB;
      } else if (isAddressObject(valueA) || isAddressObject(valueB)) {
        // Address comparison - use extractComparableValue for proper string formatting
        const strA = extractComparableValue(valueA, 'address', fieldConfig).toLowerCase();
        const strB = extractComparableValue(valueB, 'address', fieldConfig).toLowerCase();
        comparison = strA.localeCompare(strB);
      } else {
        // String comparison using extractComparableValue for complex types
        const strA = extractComparableValue(valueA, fieldType, fieldConfig).toLowerCase();
        const strB = extractComparableValue(valueB, fieldType, fieldConfig).toLowerCase();
        comparison = strA.localeCompare(strB);
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortField, sortDirection, enableSorting, fieldTypeMap, fieldConfigMap]);

  const handleSort = (fieldId: string) => {
    if (!enableSorting) return;
    
    if (sortField === fieldId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(fieldId);
      setSortDirection('asc');
    }
  };

  const handleExport = () => {
    if (!enableExport) return;
    
    const headers = displayFields.map(f => f.label).join(',');
    const rows = sortedData.map(row => 
      displayFields.map(field => {
        const value = field.type === 'metadata' 
          ? row[field.id as keyof typeof row]
          : row.submission_data?.[field.id];
        return `"${value || ''}"`;
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'table-export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (!selectedForm) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
        <div className="text-center text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No Form Selected</p>
          <p className="text-sm">Select a primary form to see the preview</p>
        </div>
      </div>
    );
  }

  if (displayFields.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
        <div className="text-center text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No Columns Selected</p>
          <p className="text-sm">Select columns to display in the table</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">
              {title || 'Table Preview'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {totalCount} total records • {displayFields.length} columns
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {enableExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={sortedData.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>
      
      {/* Search */}
      {enableSearch && (
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

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading data...</div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {displayFields.map(field => (
                    <TableHead key={field.id} className="whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <span>{field.label}</span>
                        <Badge 
                          variant={field.type === 'metadata' ? 'secondary' : 'outline'} 
                          className="text-xs"
                        >
                          {field.type === 'metadata' ? 'Meta' : field.type}
                        </Badge>
                        {enableSorting && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort(field.id)}
                            className="h-4 w-4 p-0"
                          >
                            {sortField === field.id ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )
                            ) : (
                              <ChevronUp className="h-3 w-3 opacity-50" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={displayFields.length} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {data.length === 0 ? 'No data available' : 'No records match your search'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row) => (
                    <TableRow key={row.id}>
                      {displayFields.map(field => {
                        let displayValue: string;
                        
                        if (field.type === 'metadata') {
                          if (field.id === 'submitted_at') {
                            displayValue = new Date(row[field.id as keyof typeof row] as string).toLocaleDateString();
                          } else {
                            displayValue = String(row[field.id as keyof typeof row] || '-');
                          }
                        } else {
                          displayValue = formatCellValue(row.submission_data?.[field.id], field.type);
                        }
                        
                        return (
                          <TableCell key={field.id} className="whitespace-nowrap max-w-xs truncate" title={displayValue}>
                            {displayValue}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {displayFields.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} results
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
