import { useState, useMemo } from 'react';

interface UseQueryResultFiltersProps {
  rows: any[][];
  columns: string[];
}

export function useQueryResultFilters({ rows, columns }: UseQueryResultFiltersProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');

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
  }, [rows, columns, filterColumn, filterValue, sortColumn, sortDirection]);

  // Convert back to row format for table display
  const processedRows = useMemo(() => {
    return processedData.map(obj => columns.map(col => obj[col]));
  }, [processedData, columns]);

  return {
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    filterColumn,
    setFilterColumn,
    filterValue,
    setFilterValue,
    processedData,
    processedRows,
  };
}
