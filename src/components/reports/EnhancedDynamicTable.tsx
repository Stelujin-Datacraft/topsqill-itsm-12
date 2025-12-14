import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUp, ArrowDown, Eye, Database, X, Filter, Plus, ChevronDown, ChevronUp } from 'lucide-react';
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

interface ActiveFilter {
  field: string;
  operator: string;
  value: string;
  logicalOperator: 'AND' | 'OR'; // Logical operator with next filter
}

export function EnhancedDynamicTable({ config, onEdit }: EnhancedDynamicTableProps) {
  const [formFields, setFormFields] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [drilldownFilters, setDrilldownFilters] = useState<DrilldownFilter[]>([]);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<ActiveFilter[]>([]); // Client-side filters
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const { forms } = useReports();

  // Convert drilldown filters for useTableData hook
  const drilldownFiltersForQuery = useMemo(() => {
    return drilldownFilters.map(filter => ({
      field: filter.fieldId,
      operator: 'eq',
      value: filter.value
    }));
  }, [drilldownFilters]);

  // Convert joinConfig to the format expected by useTableData
  const joinConfigForQuery = useMemo(() => {
    if (!config.joinConfig?.enabled || !config.joinConfig?.secondaryFormId) return undefined;
    
    console.log('Join config:', config.joinConfig);
    
    return {
      enabled: true,
      joins: [{
        id: 'join-1',
        secondaryFormId: config.joinConfig.secondaryFormId,
        joinType: config.joinConfig.joinType || 'inner',
        primaryFieldId: config.joinConfig.primaryFieldId,
        secondaryFieldId: config.joinConfig.secondaryFieldId,
        alias: config.joinConfig.alias
      }]
    };
  }, [config.joinConfig]);

  // Only use configured filters for server-side query (not user active filters)
  const filterGroups = useMemo(() => {
    const configuredFilters = (config as any).filters as { field: string; operator: string; value: any }[] | undefined;
    
    if (!configuredFilters || configuredFilters.length === 0) return [] as { conditions: { field: string; operator: string; value: any }[] }[];
    return [
      {
        conditions: configuredFilters.map(f => ({
          field: f.field,
          operator: f.operator,
          value: f.value
        }))
      }
    ];
  }, [config]);

  const { data, loading, totalCount, refetch } = useTableData(
    config.formId,
    filterGroups,
    50,
    drilldownFiltersForQuery,
    joinConfigForQuery
  );

  // Client-side filter evaluation
  const evaluateFilter = useCallback((row: any, filter: ActiveFilter): boolean => {
    const value = getFieldValue(row, filter.field);
    const filterValue = filter.value;
    const strValue = String(value).toLowerCase();
    const strFilterValue = String(filterValue).toLowerCase();

    switch (filter.operator) {
      case 'equals':
        return strValue === strFilterValue;
      case 'not_equals':
        return strValue !== strFilterValue;
      case 'contains':
        return strValue.includes(strFilterValue);
      case 'starts_with':
        return strValue.startsWith(strFilterValue);
      case 'ends_with':
        return strValue.endsWith(strFilterValue);
      case 'greater_than':
        return parseFloat(String(value)) > parseFloat(filterValue);
      case 'less_than':
        return parseFloat(String(value)) < parseFloat(filterValue);
      case 'is_empty':
        return !value || strValue === '' || strValue === 'n/a';
      case 'is_not_empty':
        return value && strValue !== '' && strValue !== 'n/a';
      default:
        return true;
    }
  }, []);

  // Evaluate all filters with logical operators
  const evaluateFilters = useCallback((row: any, filters: ActiveFilter[]): boolean => {
    if (filters.length === 0) return true;
    
    let result = evaluateFilter(row, filters[0]);
    
    for (let i = 1; i < filters.length; i++) {
      const prevFilter = filters[i - 1];
      const currentResult = evaluateFilter(row, filters[i]);
      
      if (prevFilter.logicalOperator === 'OR') {
        result = result || currentResult;
      } else {
        result = result && currentResult;
      }
    }
    
    return result;
  }, [evaluateFilter]);

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

      // Load fields from joined form when join is enabled
      if (config.joinConfig?.enabled && config.joinConfig.secondaryFormId) {
        const { data: secondaryFields, error: secondaryError } = await supabase
          .from('form_fields')
          .select('*')
          .eq('form_id', config.joinConfig.secondaryFormId)
          .neq('field_type', 'signature-pad')
          .order('field_order', { ascending: true });

        if (!secondaryError && secondaryFields) {
          const form = forms.find(f => f.id === config.joinConfig.secondaryFormId);
          const formLabel = config.joinConfig.alias || form?.name || 'Joined';

          const prefixedSecondaryFields = secondaryFields.map(field => ({
            ...field,
            id: `${config.joinConfig.secondaryFormId}.${field.id}`,
            label: `[${formLabel}] ${field.label}`,
            sourceFormId: config.joinConfig.secondaryFormId
          }));
          allFields = [...allFields, ...prefixedSecondaryFields];
        }
      }

      setFormFields(allFields);
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  }, [config.formId, config.joinConfig, forms]);

  const getFieldValue = (row: any, fieldId: string) => {
    if (!fieldId) return 'N/A';
    
    // Direct lookup first
    if (row.submission_data?.[fieldId] !== undefined) {
      return row.submission_data[fieldId];
    }
    
    // For joined fields, try different prefix formats
    // Check if fieldId contains a form ID prefix (format: formId.fieldId)
    if (fieldId.includes('.')) {
      const [formIdPart, actualFieldId] = fieldId.split('.');
      // Try with formId prefix (used in useTableData)
      const prefixedKey = `${formIdPart}.${actualFieldId}`;
      if (row.submission_data?.[prefixedKey] !== undefined) {
        return row.submission_data[prefixedKey];
      }
    }
    
    return 'N/A';
  };

  // Add a new active filter
  const addActiveFilter = () => {
    if (formFields.length > 0) {
      setActiveFilters(prev => [...prev, {
        field: formFields[0].id,
        operator: 'equals',
        value: '',
        logicalOperator: 'AND' as const
      }]);
    }
  };

  // Update an active filter (without triggering data fetch)
  const updateActiveFilter = (index: number, updates: Partial<ActiveFilter>) => {
    setActiveFilters(prev => prev.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    ));
  };

  // Remove an active filter
  const removeActiveFilter = (index: number) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all active filters
  const clearActiveFilters = () => {
    setActiveFilters([]);
    setAppliedFilters([]);
  };

  // Apply filters - triggers data fetch
  const applyFilters = () => {
    setAppliedFilters([...activeFilters]);
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

  // Apply client-side filters, search and sorting
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply client-side active filters
    if (appliedFilters.length > 0) {
      filtered = filtered.filter(row => evaluateFilters(row, appliedFilters));
    }

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
  }, [data, searchTerm, displayFields, config.enableSearch, sortConfig, appliedFilters, evaluateFilters]);

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

        {/* Filter Controls */}
        {config.enableFiltering && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="h-8 gap-1"
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activeFilters.length}
                  </Badge>
                )}
                {showFilterPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              
              {activeFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearActiveFilters}
                  className="h-8 text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Active Filter Badges */}
            {activeFilters.length > 0 && !showFilterPanel && (
              <div className="flex flex-wrap gap-1">
                {activeFilters.map((filter, index) => {
                  const field = formFields.find(f => f.id === filter.field);
                  return (
                    <Badge key={index} variant="secondary" className="gap-1">
                      <span className="text-xs">
                        {field?.label || filter.field} {filter.operator} "{filter.value}"
                      </span>
                      <button
                        onClick={() => removeActiveFilter(index)}
                        className="hover:bg-muted rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Filter Panel */}
            {showFilterPanel && (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                {activeFilters.map((filter, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Select
                        value={filter.field}
                        onValueChange={(value) => updateActiveFilter(index, { field: value })}
                      >
                        <SelectTrigger className="w-[160px] h-8 bg-background">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {formFields.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filter.operator}
                        onValueChange={(value) => updateActiveFilter(index, { operator: value })}
                      >
                        <SelectTrigger className="w-[120px] h-8 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="not_equals">Not equals</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="starts_with">Starts with</SelectItem>
                          <SelectItem value="ends_with">Ends with</SelectItem>
                          <SelectItem value="greater_than">Greater than</SelectItem>
                          <SelectItem value="less_than">Less than</SelectItem>
                          <SelectItem value="is_empty">Is empty</SelectItem>
                          <SelectItem value="is_not_empty">Is not empty</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        value={filter.value}
                        onChange={(e) => updateActiveFilter(index, { value: e.target.value })}
                        placeholder="Value..."
                        className="flex-1 h-8"
                        disabled={filter.operator === 'is_empty' || filter.operator === 'is_not_empty'}
                      />

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeActiveFilter(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Logical operator between filters */}
                    {index < activeFilters.length - 1 && (
                      <div className="flex items-center gap-2 pl-2">
                        <Select
                          value={filter.logicalOperator}
                          onValueChange={(value: 'AND' | 'OR') => updateActiveFilter(index, { logicalOperator: value })}
                        >
                          <SelectTrigger className="w-[80px] h-7 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addActiveFilter}
                    className="h-8 gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Filter
                  </Button>
                  
                  {activeFilters.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={applyFilters}
                      className="h-8"
                    >
                      Apply Filters
                    </Button>
                  )}
                </div>
              </div>
            )}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleCellDrilldown(field.id, fieldValue.toString(), field.label);
                              }}
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
