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
      const { data: submissions, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', config.formId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setData(submissions || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [config.formId]);

  const loadFormFields = useCallback(async () => {
    if (!config.formId) return;

    try {
      const { data: fields, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', config.formId)
        .order('field_order', { ascending: true });

      if (error) throw error;
      setFormFields(fields || []);
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  }, [config.formId]);

  const getFieldValue = (row: any, fieldId: string) => {
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
    if (config.selectedColumns?.length > 0) {
      return formFields.filter(field => config.selectedColumns.includes(field.id));
    }
    return formFields.slice(0, 10);
  }, [formFields, config.selectedColumns]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (searchTerm && config.enableSearch) {
        return displayFields.some(field => {
          const value = getFieldValue(row, field.id);
          return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
      }
      return true;
    });
  }, [data, searchTerm, displayFields, config.enableSearch]);

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
                        {getFieldValue(row, field.id)}
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