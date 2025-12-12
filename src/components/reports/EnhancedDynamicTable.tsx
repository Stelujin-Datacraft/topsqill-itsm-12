import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ArrowUp, ArrowDown, Eye, Database, X, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useReports } from '@/hooks/useReports';
import { useTableData } from '@/hooks/useTableData';
import { FormDataCell } from './FormDataCell';

interface EnhancedTableConfig {
  title: string;
  formId: string;
  selectedColumns: string[];
  showMetadata?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableSearch?: boolean;
  joinConfig?: any;
  drilldownConfig?: {
    enabled: boolean;
    fields: string[];
  };
}

interface EnhancedDynamicTableProps {
  config: EnhancedTableConfig;
  onEdit?: () => void;
  onDrilldown?: (level: string, value: string) => void;
  drilldownState?: { path: string[], values: string[] };
}

interface DrilldownFilter {
  fieldId: string;
  value: string;
  label: string;
}

export function EnhancedDynamicTable({ config, onEdit }: EnhancedDynamicTableProps) {
  const [formFields, setFormFields] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [drilldownFilters, setDrilldownFilters] = useState<DrilldownFilter[]>([]);

  const { forms } = useReports();

  // Convert drilldown filters for useTableData hook
  const drilldownFiltersForQuery = useMemo(() => {
    return drilldownFilters.map(filter => ({
      field: filter.fieldId,
      operator: 'eq',
      value: filter.value
    }));
  }, [drilldownFilters]);

  // Use the useTableData hook with drilldown filters and join config
  const { data, loading, totalCount, refetch } = useTableData(
    config.formId, 
    [], 
    50,
    drilldownFiltersForQuery,
    config.joinConfig
  );

  const loadFormFields = useCallback(async () => {
    if (!config.formId) return;

    try {
      // Load primary form fields
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', config.formId)
        .neq('field_type', 'signature-pad')
        .order('field_order', { ascending: true });

      if (error) throw error;
      
      let allFields = fields || [];

      // Load fields from all joined forms
      if (config.joinConfig?.enabled && config.joinConfig.joins?.length > 0) {
        for (const join of config.joinConfig.joins) {
          if (!join.secondaryFormId) continue;

          const { data: secondaryFields, error: secondaryError } = await supabase
            .from('form_fields')
            .select('*')
            .eq('form_id', join.secondaryFormId)
            .neq('field_type', 'signature-pad')
            .order('field_order', { ascending: true });

          if (!secondaryError && secondaryFields) {
            const form = forms.find(f => f.id === join.secondaryFormId);
            const formLabel = join.alias || form?.name || 'Joined';
            
            const prefixedSecondaryFields = secondaryFields.map(field => ({
              ...field,
              id: `${join.secondaryFormId}.${field.id}`,
              label: `[${formLabel}] ${field.label}`,
              sourceFormId: join.secondaryFormId
            }));
            allFields = [...allFields, ...prefixedSecondaryFields];
          }
        }
      }

      setFormFields(allFields);
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  }, [config.formId, config.joinConfig, forms]);

  const getFieldValue = (row: any, fieldId: string) => {
    if (!fieldId) return 'N/A';
    return row.submission_data?.[fieldId] ?? 'N/A';
  };

  // Handle drilldown click on a cell
  const handleCellDrilldown = (fieldId: string, value: string, label: string) => {
    // Check if this field is already filtered
    const existingIndex = drilldownFilters.findIndex(f => f.fieldId === fieldId);
    
    if (existingIndex >= 0) {
      // Update existing filter
      setDrilldownFilters(prev => 
        prev.map((f, i) => i === existingIndex ? { fieldId, value, label } : f)
      );
    } else {
      // Add new filter
      setDrilldownFilters(prev => [...prev, { fieldId, value, label }]);
    }
  };

  // Remove a specific drilldown filter
  const removeFilter = (fieldId: string) => {
    setDrilldownFilters(prev => prev.filter(f => f.fieldId !== fieldId));
  };

  // Reset all drilldown filters
  const resetAllFilters = () => {
    setDrilldownFilters([]);
  };

  // Check if a field is drilldown-enabled
  const isDrilldownEnabled = (fieldId: string) => {
    return config.drilldownConfig?.enabled && 
           (config.drilldownConfig.fields || []).includes(fieldId);
  };

  // Get display fields based on selected columns
  const displayFields = useMemo(() => {
    const validFields = formFields.filter(field => field && field.id);
    
    if (config.selectedColumns?.length > 0) {
      return validFields.filter(field => config.selectedColumns.includes(field.id));
    }
    return validFields;
  }, [formFields, config.selectedColumns]);

  // Apply search and sorting
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply search filter
    if (searchTerm && config.enableSearch) {
      filtered = filtered.filter(row => {
        return displayFields.some(field => {
          const value = getFieldValue(row, field.id);
          return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue, bValue;
        
        if (sortConfig.field === 'submitted_at') {
          aValue = new Date(a.submitted_at).getTime();
          bValue = new Date(b.submitted_at).getTime();
        } else if (sortConfig.field === 'approval_status') {
          aValue = a.approval_status || 'pending';
          bValue = b.approval_status || 'pending';
        } else {
          aValue = getFieldValue(a, sortConfig.field);
          bValue = getFieldValue(b, sortConfig.field);
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, displayFields, config.enableSearch, sortConfig]);

  useEffect(() => {
    loadFormFields();
  }, [loadFormFields]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading table data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {config.title || 'Data Table'}
            {config.joinConfig?.enabled && (
              <Badge variant="secondary" className="text-xs">Joined</Badge>
            )}
          </CardTitle>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Eye className="h-4 w-4 mr-2" />
              Configure
            </Button>
          )}
        </div>

        {/* Active Drilldown Filters */}
        {drilldownFilters.length > 0 && (
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
            {drilldownFilters.map((filter) => (
              <Badge 
                key={filter.fieldId} 
                variant="default"
                className="flex items-center gap-1"
              >
                <span>{filter.label}: {filter.value}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFilter(filter.fieldId);
                  }}
                  className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-6 text-xs"
            >
              Clear All
            </Button>
          </div>
        )}

        {/* Search Bar */}
        {config.enableSearch && (
          <div className="flex items-center gap-2 pt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm h-8"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                {displayFields.map(field => {
                  const canDrilldown = isDrilldownEnabled(field.id);
                  const hasActiveFilter = drilldownFilters.some(f => f.fieldId === field.id);
                  
                  return (
                    <TableHead key={field.id} className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className={canDrilldown ? 'text-primary font-medium' : ''}>
                          {field.label}
                        </span>
                        
                        {/* Sorting controls */}
                        {config.enableSorting && (
                          <div className="flex flex-col ml-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-4 w-4 p-0 ${sortConfig?.field === field.id && sortConfig?.direction === 'asc' ? 'text-primary' : ''}`}
                              onClick={() => setSortConfig({ field: field.id, direction: 'asc' })}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-4 w-4 p-0 ${sortConfig?.field === field.id && sortConfig?.direction === 'desc' ? 'text-primary' : ''}`}
                              onClick={() => setSortConfig({ field: field.id, direction: 'desc' })}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        
                        {canDrilldown && (
                          <Badge variant="outline" className="text-xs ml-1">Click to filter</Badge>
                        )}
                        
                        {hasActiveFilter && (
                          <Badge variant="default" className="text-xs ml-1">Active</Badge>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
                {config.showMetadata && (
                  <>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <span>Submitted</span>
                        {config.enableSorting && (
                          <div className="flex flex-col ml-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-4 w-4 p-0 ${sortConfig?.field === 'submitted_at' && sortConfig?.direction === 'asc' ? 'text-primary' : ''}`}
                              onClick={() => setSortConfig({ field: 'submitted_at', direction: 'asc' })}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-4 w-4 p-0 ${sortConfig?.field === 'submitted_at' && sortConfig?.direction === 'desc' ? 'text-primary' : ''}`}
                              onClick={() => setSortConfig({ field: 'submitted_at', direction: 'desc' })}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={displayFields.length + (config.showMetadata ? 2 : 0)} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    {data.length === 0 ? 'No data available' : 'No matching records'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map(row => (
                  <TableRow key={row.id}>
                    {displayFields.map(field => {
                      const fieldValue = getFieldValue(row, field.id);
                      const canDrilldown = isDrilldownEnabled(field.id);
                      const activeFilter = drilldownFilters.find(f => f.fieldId === field.id);
                      const isCurrentlyFiltered = activeFilter?.value === fieldValue.toString();
                      
                      return (
                        <TableCell key={field.id}>
                          {canDrilldown ? (
                            <button
                              onClick={() => handleCellDrilldown(field.id, fieldValue.toString(), field.label)}
                              className={`text-left hover:underline hover:text-primary transition-colors ${isCurrentlyFiltered ? 'font-semibold text-primary' : ''}`}
                              title={`Click to filter by "${fieldValue}"`}
                            >
                              <FormDataCell 
                                value={fieldValue} 
                                fieldType={field.field_type} 
                                field={field}
                              />
                            </button>
                          ) : (
                            <FormDataCell 
                              value={fieldValue} 
                              fieldType={field.field_type} 
                              field={field}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                    {config.showMetadata && (
                      <>
                        <TableCell className="text-sm">
                          {new Date(row.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.approval_status === 'approved' ? 'default' : 'secondary'}>
                            {row.approval_status || 'pending'}
                          </Badge>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {filteredData.length} of {data.length} records</span>
          {sortConfig && (
            <div className="flex items-center gap-2">
              <span>Sorted by: {sortConfig.field} ({sortConfig.direction})</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortConfig(null)}
                className="h-6 text-xs"
              >
                Clear Sort
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
