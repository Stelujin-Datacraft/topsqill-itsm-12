import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUp, ArrowDown, Eye, Database, X, Filter, Plus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useReports } from '@/hooks/useReports';
import { useTableData } from '@/hooks/useTableData';
import { FormDataCell } from './FormDataCell';
import { evaluateFilterCondition, rowPassesSearch, extractComparableValue, valueContainsSearchWithConfig } from '@/utils/filterUtils';

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
    fields?: string[];
    drilldownLevels?: string[];
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
  const navigate = useNavigate();
  const [formFields, setFormFields] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [drilldownFilters, setDrilldownFilters] = useState<DrilldownFilter[]>([]);
  const [currentDrilldownLevel, setCurrentDrilldownLevel] = useState(0); // Track current level
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<ActiveFilter[]>([]); // Client-side filters
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<{ id: string; refId: string } | null>(null);

  const { forms } = useReports();

  // Convert drilldown filters for useTableData hook
  const drilldownFiltersForQuery = useMemo(() => {
    return drilldownFilters.map(filter => ({
      field: filter.fieldId,
      operator: 'equals', // Use 'equals' to match evaluateFilterCondition
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
    
    // Get field type for proper handling
    const field = formFields.find(f => f.id === filter.field);
    const fieldType = (field as any)?.field_type || field?.type || '';

    return evaluateFilterCondition(value, filter.operator, filterValue, fieldType);
  }, [formFields]);

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

  // Handle drilldown click on a cell - hierarchical drilldown
  const handleCellDrilldown = (fieldId: string, value: string, label: string) => {
    const drilldownLevels = getDrilldownLevels();
    const currentLevelFieldId = drilldownLevels[currentDrilldownLevel];
    
    // Only allow drilling down from the current level's field
    if (fieldId !== currentLevelFieldId) return;
    
    // Add filter for current level
    setDrilldownFilters(prev => [...prev, { fieldId, value, label }]);
    
    // Move to next drilldown level
    if (currentDrilldownLevel < drilldownLevels.length - 1) {
      setCurrentDrilldownLevel(prev => prev + 1);
    } else {
      // At final level - show all records (no more drilldown levels)
      setCurrentDrilldownLevel(drilldownLevels.length);
    }
  };

  // Go back one drilldown level
  const goBackOneLevel = () => {
    if (currentDrilldownLevel > 0) {
      setCurrentDrilldownLevel(prev => prev - 1);
      setDrilldownFilters(prev => prev.slice(0, -1));
    }
  };

  // Remove a specific drilldown filter and reset to that level
  const removeFilter = (index: number) => {
    setDrilldownFilters(prev => prev.slice(0, index));
    setCurrentDrilldownLevel(index);
  };

  // Reset all drilldown filters
  const resetAllFilters = () => {
    setDrilldownFilters([]);
    setCurrentDrilldownLevel(0);
  };

  // Get drilldown levels array
  const getDrilldownLevels = (): string[] => {
    return config.drilldownConfig?.drilldownLevels || config.drilldownConfig?.fields || [];
  };

  // Check if drilldown is enabled and we're in drilldown mode
  const isInDrilldownMode = () => {
    const drilldownLevels = getDrilldownLevels();
    return config.drilldownConfig?.enabled && drilldownLevels.length > 0;
  };

  // Check if we've drilled down to the final level (showing raw records)
  const isAtFinalLevel = () => {
    const drilldownLevels = getDrilldownLevels();
    return currentDrilldownLevel >= drilldownLevels.length;
  };

  // Get the current drilldown field to display
  const getCurrentDrilldownField = () => {
    const drilldownLevels = getDrilldownLevels();
    if (currentDrilldownLevel < drilldownLevels.length) {
      return drilldownLevels[currentDrilldownLevel];
    }
    return null;
  };

  // Check if a specific field is the current drilldown field (can be clicked)
  const isDrilldownEnabled = (fieldId: string) => {
    if (!isInDrilldownMode()) return false;
    const currentField = getCurrentDrilldownField();
    return currentField === fieldId;
  };

  // Get display fields based on drilldown state and selected columns
  const displayFields = useMemo(() => {
    const validFields = formFields.filter(field => field && field.id);
    
    // If in drilldown mode and NOT at final level, show only the current drilldown field
    if (isInDrilldownMode() && !isAtFinalLevel()) {
      const currentFieldId = getCurrentDrilldownField();
      if (currentFieldId) {
        const currentField = validFields.find(f => f.id === currentFieldId);
        if (currentField) {
          return [currentField];
        }
      }
    }
    
    // At final level or no drilldown - show selected columns
    if (config.selectedColumns?.length > 0) {
      return validFields.filter(field => config.selectedColumns.includes(field.id));
    }
    return validFields;
  }, [formFields, config.selectedColumns, currentDrilldownLevel, config.drilldownConfig]);

  // Apply client-side filters, search and sorting
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply client-side active filters
    if (appliedFilters.length > 0) {
      filtered = filtered.filter(row => evaluateFilters(row, appliedFilters));
    }

    // Apply search filter
    if (searchTerm && config.enableSearch) {
      // Build field type map and field config map for proper search handling
      const fieldTypeMap: Record<string, string> = {};
      const fieldConfigMap: Record<string, any> = {};
      formFields.forEach(field => {
        fieldTypeMap[field.id] = (field as any)?.field_type || field?.type || '';
        // Include options and custom_config for proper label resolution
        fieldConfigMap[field.id] = {
          options: field.options,
          custom_config: (field as any)?.custom_config || (field as any)?.customConfig
        };
      });
      
      filtered = filtered.filter(row => {
        return rowPassesSearch(row, searchTerm, fieldTypeMap, fieldConfigMap);
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
  }, [data, searchTerm, displayFields, config.enableSearch, sortConfig, appliedFilters, evaluateFilters, formFields]);

  // Aggregate data for drilldown mode - group by current field with counts
  const aggregatedData = useMemo(() => {
    if (!isInDrilldownMode() || isAtFinalLevel()) {
      return null; // No aggregation needed
    }

    const currentFieldId = getCurrentDrilldownField();
    if (!currentFieldId) return null;

    // Group data by the current drilldown field value
    const grouped: Record<string, { value: string; count: number; sampleRow: any }> = {};
    
    filteredData.forEach(row => {
      const fieldValue = getFieldValue(row, currentFieldId);
      const valueStr = fieldValue === null || fieldValue === undefined ? '(Empty)' : String(fieldValue);
      
      if (!grouped[valueStr]) {
        grouped[valueStr] = { value: valueStr, count: 0, sampleRow: row };
      }
      grouped[valueStr].count++;
    });

    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }, [filteredData, currentDrilldownLevel, config.drilldownConfig]);

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

        {/* Active Drilldown Filters - Breadcrumb style */}
        {drilldownFilters.length > 0 && (
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Drilldown:</span>
            {drilldownFilters.map((filter, index) => (
              <Badge 
                key={`${filter.fieldId}-${index}`} 
                variant="default"
                className="flex items-center gap-1 cursor-pointer hover:bg-primary/80"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFilter(index);
                }}
              >
                <span>{filter.label}: {filter.value}</span>
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-6 text-xs"
            >
              Reset
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
                  
                  return (
                    <TableHead key={field.id} className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className={canDrilldown ? 'text-primary font-medium' : ''}>
                          {field.label}
                        </span>
                        
                        {/* Sorting controls - only show when not in aggregated mode */}
                        {config.enableSorting && !aggregatedData && (
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
                          <Badge variant="outline" className="text-xs ml-1">Click to drill down</Badge>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
                {/* Count column for aggregated view */}
                {aggregatedData && (
                  <TableHead className="text-right">Count</TableHead>
                )}
                {/* Metadata columns only in non-aggregated view */}
                {!aggregatedData && config.showMetadata && (
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
              {/* Aggregated drilldown view */}
              {aggregatedData ? (
                aggregatedData.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={displayFields.length + 1} 
                      className="text-center py-8 text-muted-foreground"
                    >
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  aggregatedData.map((item, index) => (
                    <TableRow 
                      key={`agg-${index}-${item.value}`}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        const currentFieldId = getCurrentDrilldownField();
                        const currentField = formFields.find(f => f.id === currentFieldId);
                        if (currentFieldId && currentField) {
                          handleCellDrilldown(currentFieldId, item.value, currentField.label);
                        }
                      }}
                    >
                      <TableCell>
                        <button
                          className="text-left hover:underline hover:text-primary transition-colors font-medium"
                          title={`Click to drill down into "${item.value}"`}
                        >
                          {item.value}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{item.count} records</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : (
                /* Normal table view (at final level or no drilldown) */
                filteredData.length === 0 ? (
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
                    <TableRow 
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => row.id && setSelectedSubmission({ id: row.id, refId: row.submission_ref_id || row.id.slice(0, 8) })}
                    >
                      {displayFields.map(field => {
                        const fieldValue = getFieldValue(row, field.id);
                        
                        return (
                          <TableCell key={field.id}>
                            <FormDataCell 
                              value={fieldValue} 
                              fieldType={field.field_type} 
                              field={field}
                            />
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
                )
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            {/* Back button when in drilldown */}
            {isInDrilldownMode() && currentDrilldownLevel > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={goBackOneLevel}
                className="h-7 text-xs gap-1"
              >
                ← Back
              </Button>
            )}
            <span>
              {aggregatedData 
                ? `${aggregatedData.length} unique values (Level ${currentDrilldownLevel + 1} of ${getDrilldownLevels().length})`
                : `Showing ${filteredData.length} of {data.length} records`
              }
            </span>
          </div>
          {sortConfig && !aggregatedData && (
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
        
        {/* View Submission Dialog */}
        <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>View Submission</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                You selected submission <span className="font-mono font-medium text-foreground">#{selectedSubmission?.refId}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Would you like to view the full details of this submission?
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (selectedSubmission) {
                  navigate(`/submission/${selectedSubmission.id}`);
                  setSelectedSubmission(null);
                }
              }}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Submission
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
