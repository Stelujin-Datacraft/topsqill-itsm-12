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
}

export function EnhancedDynamicTable({ config, onEdit }: EnhancedDynamicTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [drilldownState, setDrilldownState] = useState({
    currentLevel: 0,
    filters: [] as any[],
    breadcrumbs: [] as any[]
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
      if (drilldownState.filters.length > 0) {
        drilldownState.filters.forEach(filter => {
          query = query.eq(`submission_data->>${filter.field}`, filter.value);
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
  }, [config.formId, config.joinConfig, drilldownState.filters]);

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

  const handleDrilldown = (fieldId: string, value: string, label: string) => {
    if (!config.drilldownConfig?.enabled) return;

    setDrilldownState(prev => ({
      currentLevel: prev.currentLevel + 1,
      filters: [...prev.filters, { field: fieldId, value, label }],
      breadcrumbs: [...prev.breadcrumbs, { field: fieldId, value, label }]
    }));
  };

  const resetDrilldown = () => {
    setDrilldownState({
      currentLevel: 0,
      filters: [],
      breadcrumbs: []
    });
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

    // Apply drilldown aggregation if enabled and at appropriate level
    if (config.drilldownConfig?.enabled && Array.isArray(config.drilldownConfig.levels) && 
        drilldownState.currentLevel < config.drilldownConfig.levels.length) {
      const currentLevelConfig = config.drilldownConfig.levels[drilldownState.currentLevel];
      if (currentLevelConfig) {
        // Group data by the current drilldown field
        const groupedData = filtered.reduce((groups, row) => {
          const key = getFieldValue(row, currentLevelConfig.field);
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(row);
          return groups;
        }, {} as Record<string, any[]>);

        // Convert to summary rows for drilldown
        filtered = Object.entries(groupedData).map(([key, rowsGroup]) => {
          const rows = rowsGroup as any[];
          return {
            id: `drilldown_${key}`,
            submission_data: {
              [currentLevelConfig.field]: key,
              _count: rows.length,
              _isGrouped: true
            },
            submitted_at: rows[0]?.submitted_at
          };
        });
      }
    }

    return filtered;
  }, [data, searchTerm, displayFields, config.enableSearch, config.drilldownConfig, drilldownState]);

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

        {config.drilldownConfig?.enabled && drilldownState.breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={resetDrilldown}>
              All Data
            </Button>
            {drilldownState.breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="h-4 w-4" />
                <span className="text-sm">{crumb.label}: {crumb.value}</span>
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
                {displayFields.map(field => (
                  <TableHead key={field.id}>
                    {field.label}
                    {config.drilldownConfig?.enabled && (
                      <ChevronDown className="h-3 w-3 inline ml-1 text-blue-500" />
                    )}
                  </TableHead>
                ))}
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
                    {displayFields.map(field => (
                  <TableCell 
                    key={field.id}
                    className={config.drilldownConfig?.enabled ? 'cursor-pointer text-blue-600 hover:bg-blue-50' : ''}
                    onClick={() => config.drilldownConfig?.enabled && handleDrilldown(field.id, getFieldValue(row, field.id), field.label)}
                  >
                    <div className="flex items-center gap-2">
                      {typeof getFieldValue(row, field.id) === 'object' ? 
                        JSON.stringify(getFieldValue(row, field.id)) : 
                        getFieldValue(row, field.id)
                      }
                      {row.submission_data?._isGrouped && (
                        <Badge variant="secondary" className="text-xs">
                          {row.submission_data._count} records
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                    ))}
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