import { useState, useMemo } from 'react';

interface UseQueryResultFiltersProps {
  rows: any[][];
  columns: string[];
}

export type AggregationType = 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max';

export function useQueryResultFilters({ rows, columns }: UseQueryResultFiltersProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');
  const [groupByColumn, setGroupByColumn] = useState<string | null>(null);
  const [aggregateColumn, setAggregateColumn] = useState<string | null>(null);
  const [aggregationType, setAggregationType] = useState<AggregationType>('count');

  const processedData = useMemo(() => {
    // Transform raw data
    let data = rows.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        const value = row[idx];
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;
        obj[col] = !isNaN(numericValue) && typeof numericValue === 'number' ? numericValue : value;
      });
      return obj;
    });

    // Apply filter
    if (filterColumn && filterValue) {
      data = data.filter(item => {
        const cellValue = String(item[filterColumn] ?? '').toLowerCase();
        return cellValue.includes(filterValue.toLowerCase());
      });
    }

    // Apply group by with aggregation
    if (groupByColumn) {
      const groups: Record<string, any[]> = {};
      data.forEach(item => {
        const key = String(item[groupByColumn] ?? 'null');
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      data = Object.entries(groups).map(([key, items]) => {
        const result: Record<string, any> = { [groupByColumn]: key === 'null' ? null : key };
        
        // Calculate aggregation for the selected column or count
        if (aggregationType === 'count') {
          result['count'] = items.length;
        } else if (aggregateColumn) {
          const values = items
            .map(item => item[aggregateColumn])
            .filter(v => typeof v === 'number');
          
          switch (aggregationType) {
            case 'sum':
              result[`sum_${aggregateColumn}`] = values.reduce((a, b) => a + b, 0);
              break;
            case 'avg':
              result[`avg_${aggregateColumn}`] = values.length > 0 
                ? values.reduce((a, b) => a + b, 0) / values.length 
                : 0;
              break;
            case 'min':
              result[`min_${aggregateColumn}`] = values.length > 0 ? Math.min(...values) : 0;
              break;
            case 'max':
              result[`max_${aggregateColumn}`] = values.length > 0 ? Math.max(...values) : 0;
              break;
          }
        }
        
        return result;
      });
    }

    // Apply sort
    if (sortColumn) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal ?? '');
        const bStr = String(bVal ?? '');
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return data;
  }, [rows, columns, filterColumn, filterValue, sortColumn, sortDirection, groupByColumn, aggregateColumn, aggregationType]);

  // Get columns for display (may change when grouped)
  const displayColumns = useMemo(() => {
    if (groupByColumn && processedData.length > 0) {
      return Object.keys(processedData[0]);
    }
    return columns;
  }, [groupByColumn, processedData, columns]);

  // Convert back to row format for table display
  const processedRows = useMemo(() => {
    return processedData.map(obj => displayColumns.map(col => obj[col]));
  }, [processedData, displayColumns]);

  return {
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    filterColumn,
    setFilterColumn,
    filterValue,
    setFilterValue,
    groupByColumn,
    setGroupByColumn,
    aggregateColumn,
    setAggregateColumn,
    aggregationType,
    setAggregationType,
    processedData,
    processedRows,
    displayColumns,
  };
}
