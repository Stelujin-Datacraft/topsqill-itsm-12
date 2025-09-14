import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, Search, ArrowUp, ArrowDown, Eye, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useReports } from '@/hooks/useReports';

interface EnhancedTableConfig {
  title: string;
  formId: string;
  selectedColumns: string[];
  showMetadata?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableSearch?: boolean;
  joinConfig?: any;
  drilldownConfig?: any;
}

interface EnhancedDynamicTableProps {
  config: EnhancedTableConfig;
  onEdit?: () => void;
  onDrilldown?: (level: string, value: string) => void;
  drilldownState?: { path: string[], values: string[] };
}

export function EnhancedDynamicTable({ config, onEdit, onDrilldown, drilldownState: externalDrilldownState }: EnhancedDynamicTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [drilldownState, setDrilldownState] = useState({
    activeColumnFilters: [] as { fieldId: string; value: string; label: string }[],
    drilldownColumns: new Set<string>()
  });

  const { forms } = useReports();

  const loadData = useCallback(async () => {
    if (!config.formId) return;

    try {
      setLoading(true);
      
      // Load primary form data
      let query = supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', config.formId);

      // Apply drilldown filters if active
      if (drilldownState.activeColumnFilters.length > 0) {
        drilldownState.activeColumnFilters.forEach(filter => {
          query = query.eq(`submission_data->>${filter.fieldId}`, filter.value);
        });
      }

      const { data: submissions, error } = await query.order('submitted_at', { ascending: false });

      if (error) throw error;

      let processedData = submissions || [];

      // If joins are enabled, process joined data
      if (config.joinConfig?.enabled && config.joinConfig.secondaryFormId) {
        const { data: secondarySubmissions, error: secondaryError } = await supabase
          .from('form_submissions')
          .select('*')
          .eq('form_id', config.joinConfig.secondaryFormId);

        if (!secondaryError && secondarySubmissions) {
          // Perform the join based on join type and field mapping
          processedData = performJoin(
            processedData,
            secondarySubmissions,
            config.joinConfig
          );
        }
      }

      setData(processedData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [config.formId, config.joinConfig, drilldownState.activeColumnFilters]);

  const loadFormFields = useCallback(async () => {
    if (!config.formId) return;

    try {
      // Load primary form fields
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', config.formId)
        .order('field_order', { ascending: true });

      if (error) throw error;
      
      let allFields = fields || [];

      // Load secondary form fields if join is enabled
      if (config.joinConfig?.enabled && config.joinConfig.secondaryFormId) {
        const { data: secondaryFields, error: secondaryError } = await supabase
          .from('form_fields')
          .select('*')
          .eq('form_id', config.joinConfig.secondaryFormId)
          .order('field_order', { ascending: true });

        if (!secondaryError && secondaryFields) {
          // Add secondary fields with prefixed IDs
          const prefixedSecondaryFields = secondaryFields.map(field => ({
            ...field,
            id: `secondary_${field.id}`,
            label: `[Joined] ${field.label}`
          }));
          allFields = [...allFields, ...prefixedSecondaryFields];
        }
      }

      setFormFields(allFields);
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  }, [config.formId, config.joinConfig]);

  // Helper function to perform joins
  const performJoin = (primaryData: any[], secondaryData: any[], joinConfig: any) => {
    const { joinType, primaryFieldId, secondaryFieldId } = joinConfig;
    
    return primaryData.map(primaryRow => {
      const matchingSecondary = secondaryData.find(secondaryRow => 
        primaryRow.submission_data?.[primaryFieldId] === secondaryRow.submission_data?.[secondaryFieldId]
      );

      if (matchingSecondary) {
        // Merge the submission data with prefixed keys for secondary form
        return {
          ...primaryRow,
          submission_data: {
            ...primaryRow.submission_data,
            ...Object.keys(matchingSecondary.submission_data || {}).reduce((acc, key) => {
              acc[`secondary_${key}`] = matchingSecondary.submission_data[key];
              return acc;
            }, {} as any)
          }
        };
      }

      // Handle different join types
      switch (joinType) {
        case 'inner':
          return null; // Exclude from results
        case 'left':
        default:
          return primaryRow; // Keep primary row
      }
    }).filter(Boolean);
  };

  const getFieldValue = (row: any, fieldId: string) => {
    // Handle null/undefined fieldId
    if (!fieldId) return 'N/A';
    
    // Handle secondary form fields (prefixed with secondary_)
    if (fieldId.startsWith('secondary_')) {
      return row.submission_data?.[fieldId] || 'N/A';
    }
    return row.submission_data?.[fieldId] || 'N/A';
  };

  const toggleColumnDrilldown = (fieldId: string) => {
    setDrilldownState(prev => {
      const newDrilldownColumns = new Set(prev.drilldownColumns);
      if (newDrilldownColumns.has(fieldId)) {
        newDrilldownColumns.delete(fieldId);
        // Remove any filters for this column
        const newFilters = prev.activeColumnFilters.filter(f => f.fieldId !== fieldId);
        return {
          ...prev,
          drilldownColumns: newDrilldownColumns,
          activeColumnFilters: newFilters
        };
      } else {
        newDrilldownColumns.add(fieldId);
        return {
          ...prev,
          drilldownColumns: newDrilldownColumns
        };
      }
    });
  };

  const handleCellDrilldown = (fieldId: string, value: string, label: string) => {
    // Use external drilldown handler if available (for report editor)
    if (onDrilldown) {
      onDrilldown(fieldId, value);
      return;
    }
    
    // Otherwise use internal state management
    setDrilldownState(prev => {
      // Check if this filter already exists
      const existingFilterIndex = prev.activeColumnFilters.findIndex(f => f.fieldId === fieldId);
      
      let newFilters;
      if (existingFilterIndex >= 0) {
        // Update existing filter
        newFilters = [...prev.activeColumnFilters];
        newFilters[existingFilterIndex] = { fieldId, value, label };
      } else {
        // Add new filter
        newFilters = [...prev.activeColumnFilters, { fieldId, value, label }];
      }

      return {
        ...prev,
        activeColumnFilters: newFilters
      };
    });
  };

  const resetDrilldown = () => {
    setDrilldownState({
      activeColumnFilters: [],
      drilldownColumns: new Set()
    });
  };

  const removeFilter = (fieldId: string) => {
    setDrilldownState(prev => ({
      ...prev,
      activeColumnFilters: prev.activeColumnFilters.filter(f => f.fieldId !== fieldId)
    }));
  };

  const displayFields = useMemo(() => {
    // Filter out fields without valid IDs
    const validFields = formFields.filter(field => field && field.id);
    
    if (config.selectedColumns?.length > 0) {
      return validFields.filter(field => config.selectedColumns.includes(field.id));
    }
    return validFields.slice(0, 10);
  }, [formFields, config.selectedColumns]);

  const filteredData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm && config.enableSearch) {
      filtered = filtered.filter(row => {
        return displayFields.some(field => {
          const value = getFieldValue(row, field.id);
          return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }

    // Apply sorting if configured
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getFieldValue(a, sortConfig.field);
        const bValue = getFieldValue(b, sortConfig.field);
        
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading enhanced table data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {config.title || 'Enhanced Data Table'}
            {config.joinConfig?.enabled && (
              <Badge variant="secondary" className="text-xs">Joins Enabled</Badge>
            )}
            {config.drilldownConfig?.enabled && (
              <Badge variant="secondary" className="text-xs">Drilldown Enabled</Badge>
            )}
          </CardTitle>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Eye className="h-4 w-4 mr-2" />
              Configure
            </Button>
          )}
        </div>

        {config.drilldownConfig?.enabled && drilldownState.activeColumnFilters.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={resetDrilldown}>
              Reset All Filters
            </Button>
            {drilldownState.activeColumnFilters.map((filter, index) => (
              <React.Fragment key={filter.fieldId}>
                <ChevronRight className="h-4 w-4" />
                <div className="flex items-center gap-1">
                  <span className="text-sm">{filter.label}: {filter.value}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => removeFilter(filter.fieldId)}
                  >
                    ×
                  </Button>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {config.enableSearch && (
          <div className="flex items-center gap-2 pt-2">
            <Search className="h-4 w-4" />
            <Input
              placeholder="Search table data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        )}
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                 {displayFields.map(field => {
                   const isDrilldownField = config.drilldownConfig?.enabled && 
                     config.drilldownConfig?.drilldownLevels?.includes(field.id);
                   const isColumnDrilldownActive = drilldownState.drilldownColumns.has(field.id);
                   const hasActiveFilter = drilldownState.activeColumnFilters.some(f => f.fieldId === field.id);
                  
                  return (
                    <TableHead key={field.id}>
                      <div className="flex items-center gap-2">
                        <span>{field.label}</span>
                        {isDrilldownField && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 w-6 p-0 ${isColumnDrilldownActive ? 'bg-blue-100 text-blue-600' : ''}`}
                            onClick={() => toggleColumnDrilldown(field.id)}
                            title={isColumnDrilldownActive ? 'Disable drilldown' : 'Enable drilldown'}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        )}
                        {hasActiveFilter && (
                          <Badge variant="secondary" className="text-xs">Filtered</Badge>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
                {config.showMetadata && (
                  <>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={displayFields.length + (config.showMetadata ? 2 : 0)} className="text-center py-8">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map(row => (
                  <TableRow key={row.id}>
                    {displayFields.map(field => {
                      const fieldValue = getFieldValue(row, field.id);
                      const isColumnDrilldownActive = drilldownState.drilldownColumns.has(field.id);
                      const activeFilter = drilldownState.activeColumnFilters.find(f => f.fieldId === field.id);
                      const isFilteredValue = activeFilter?.value === fieldValue.toString();
                      
                      return (
                        <TableCell key={field.id}>
                          <div className="flex items-center gap-2">
                            <span className={`${isFilteredValue ? 'font-semibold text-blue-600' : ''}`}>
                              {typeof fieldValue === 'object' ? 
                                JSON.stringify(fieldValue) : 
                                fieldValue
                              }
                            </span>
                            
                            {/* Show drilldown button for active drilldown columns */}
                            {isColumnDrilldownActive && !isFilteredValue && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-xs"
                                onClick={() => handleCellDrilldown(field.id, fieldValue.toString(), field.label)}
                                title="Filter by this value"
                              >
                                ⬇
                              </Button>
                            )}
                            
                            {isFilteredValue && (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                    {config.showMetadata && (
                      <>
                        <TableCell>{new Date(row.submitted_at).toLocaleDateString()}</TableCell>
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

        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredData.length} of {data.length} records
        </div>
      </CardContent>
    </Card>
  );
}