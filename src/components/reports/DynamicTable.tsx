
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Search, Filter, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useReports } from '@/hooks/useReports';

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
  const [data, setData] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const { forms } = useReports();

  useEffect(() => {
    if (config.formId) {
      loadData();
      loadFormFields();
    }
  }, [config.formId]);

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

  const displayFields = useMemo(() => {
    if (config.selectedColumns && config.selectedColumns.length > 0) {
      return formFields.filter(field => config.selectedColumns.includes(field.id));
    }
    return formFields;
  }, [formFields, config.selectedColumns]);

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

    // Apply sorting
    if (sortField && config.enableSorting) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a.submission_data?.[sortField] || '';
        const bValue = b.submission_data?.[sortField] || '';
        
        if (sortDirection === 'asc') {
          return aValue.toString().localeCompare(bValue.toString());
        } else {
          return bValue.toString().localeCompare(aValue.toString());
        }
      });
    }

    return filtered;
  }, [data, searchTerm, columnFilters, sortField, sortDirection, displayFields, config]);

  const handleSort = (fieldId: string) => {
    if (!config.enableSorting) return;
    
    if (sortField === fieldId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(fieldId);
      setSortDirection('asc');
    }
  };

  const handleColumnFilter = (fieldId: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [fieldId]: value
    }));
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>{config.title || 'Dynamic Table'}</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {filteredAndSortedData.length} records
            </Badge>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            )}
          </div>
        </CardTitle>
        
        {config.enableSearch && (
          <div className="flex items-center space-x-2 mt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {displayFields.map(field => (
                  <TableHead key={field.id}>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-1">
                        <span>{field.label}</span>
                        {config.enableSorting && (
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
                      {config.enableFiltering && (
                        <Input
                          placeholder={`Filter ${field.label}...`}
                          value={columnFilters[field.id] || ''}
                          onChange={(e) => handleColumnFilter(field.id, e.target.value)}
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
                {config.showMetadata && (
                  <>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Submitted By</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={displayFields.length + (config.showMetadata ? 2 : 0)} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {data.length === 0 ? 'No data available' : 'No records match your filters'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((row) => (
                  <TableRow key={row.id}>
                    {displayFields.map(field => (
                      <TableCell key={field.id}>
                        {row.submission_data?.[field.id] || '-'}
                      </TableCell>
                    ))}
                    {config.showMetadata && (
                      <>
                        <TableCell>
                          {new Date(row.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {row.submitted_by || 'Anonymous'}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
