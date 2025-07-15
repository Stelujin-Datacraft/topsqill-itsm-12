
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Database, LinkIcon, Eye, X, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormDataTableProps, TableFilter, TableSort } from './types/tableTypes';
import { FilterControls } from './components/FilterControls';
import { useFormSubmissionTableData, getSubmissionData } from '@/hooks/useFormSubmissionTableData';

export function FormDataTable({ config, fieldType, currentFormId, targetFormFields = [] }: FormDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<TableFilter[]>([]);
  const [sortConditions, setSortConditions] = useState<TableSort[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const pageSize = config.pageSize || 10;

  // Get display columns with proper defaults
  const displayColumns = config.displayColumns && config.displayColumns.length > 0 
    ? config.displayColumns 
    : targetFormFields.slice(0, 3).map(f => f.id);

  // Use the updated hook for data fetching with database function
  const { data, loading, totalRecords, error, refetch } = useFormSubmissionTableData({
    targetFormId: config.targetFormId,
    displayColumns,
    targetFormFields,
    filters: config.filters,
    activeFilters,
    searchTerm,
    sortConditions,
    currentPage,
    pageSize,
    enableSearch: config.enableSearch,
    enableSorting: config.enableSorting
  });

  const totalPages = Math.ceil(totalRecords / pageSize);

  // Helper function to get field label by ID
  const getColumnLabel = (fieldId: string) => {
    const field = targetFormFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

  // Helper function to get field by ID
  const getFieldById = (fieldId: string) => {
    return targetFormFields.find(f => f.id === fieldId);
  };

  // Initialize filters from config
  useEffect(() => {
    if (config.filters && config.filters.length > 0) {
      console.log('FormDataTable: Initializing filters from config:', config.filters);
      setActiveFilters([]);
    }
  }, [config.filters]);

  const handleSort = (fieldId: string) => {
    if (!config.enableSorting) return;
    
    setSortConditions(prev => {
      const existing = prev.find(s => s.field === fieldId);
      if (existing) {
        if (existing.direction === 'asc') {
          return prev.map(s => s.field === fieldId ? { ...s, direction: 'desc' } : s);
        } else {
          return prev.filter(s => s.field !== fieldId);
        }
      } else {
        return [...prev, { field: fieldId, direction: 'asc' }];
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

    // Handle approval objects specifically
    if (typeof value === 'object' && value !== null) {
      // Check if it's an approval object
      if (value.status || value.comments || value.approvedBy || value.approvedAt) {
        const status = value.status || 'pending';
        const statusColors: Record<string, string> = {
          'pending': 'bg-yellow-100 text-yellow-800',
          'approved': 'bg-green-100 text-green-800',
          'rejected': 'bg-red-100 text-red-800',
          'draft': 'bg-gray-100 text-gray-800'
        };
        
        return (
          <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
            {status}
          </Badge>
        );
      }
      
      // Handle other objects by converting to JSON string
      return <span className="text-xs text-gray-500">{JSON.stringify(value)}</span>;
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
    
    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const getSortIcon = (fieldId: string) => {
    const sort = sortConditions.find(s => s.field === fieldId);
    if (!sort) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    
    return (
      <div className="flex items-center gap-1">
        <ArrowUpDown className={`h-4 w-4 ${sort.direction === 'asc' ? 'text-blue-500' : 'text-blue-500 rotate-180'}`} />
        <span className="text-xs bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
          {sortConditions.findIndex(s => s.field === fieldId) + 1}
        </span>
      </div>
    );
  };

  if (!config.targetFormId) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No target form configured</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {fieldType === 'cross-reference' ? (
              <LinkIcon className="h-5 w-5 text-blue-500" />
            ) : (
              <Database className="h-5 w-5 text-purple-500" />
            )}
            <CardTitle className="text-lg">
              {config.targetFormName}
              {config.isParentReference && (
                <Badge variant="secondary" className="ml-2">Parent</Badge>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {totalRecords} record{totalRecords !== 1 ? 's' : ''}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Applied Filters from Config */}
        {config.filters && config.filters.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">Applied Filters</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.filters.map((filter: any, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {getColumnLabel(filter.field)} {filter.operator} {filter.value}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Search and Controls */}
        <div className="flex items-center gap-4 mb-4">
          {config.enableSearch && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={`Search in ${displayColumns.length > 0 ? getColumnLabel(displayColumns[0]) : 'records'}...`}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          
          <FilterControls
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            targetFormFields={targetFormFields}
          />
        </div>

        {/* Sort Display */}
        {sortConditions.length > 0 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Sorted by:</span>
            {sortConditions.map((sort) => (
              <Badge key={sort.field} variant="secondary" className="text-xs">
                {getColumnLabel(sort.field)} ({sort.direction})
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => setSortConditions(prev => prev.filter(s => s.field !== sort.field))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Data Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Ref ID</TableHead>
                {displayColumns.map(fieldId => (
                  <TableHead 
                    key={fieldId}
                    className={config.enableSorting ? "cursor-pointer hover:bg-gray-50" : ""}
                    onClick={() => handleSort(fieldId)}
                  >
                    <div className="flex items-center gap-2">
                      {getColumnLabel(fieldId)}
                      {config.enableSorting && getSortIcon(fieldId)}
                    </div>
                  </TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={displayColumns.length + 4} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={displayColumns.length + 4} className="text-center py-8 text-gray-500">
                    {error ? 'Error loading data' : 'No records found'}
                    {config.isParentReference && !error && (
                      <div className="text-sm mt-1">
                        Parent form records will appear here when available
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => (
                  <TableRow key={row.id || index}>
                    <TableCell className="font-mono text-sm">
                      {row.submission_ref_id || `SUB-${String(index + 1).padStart(3, '0')}`}
                    </TableCell>
                    {displayColumns.map(fieldId => {
                      const field = getFieldById(fieldId);
                      return (
                        <TableCell key={fieldId}>
                          {formatCellValue(row[fieldId], field?.type)}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      {getStatusBadge(row.approval_status || 'pending')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewSubmission(row.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <Select
                value={currentPage.toString()}
                onValueChange={(value) => setCurrentPage(parseInt(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
