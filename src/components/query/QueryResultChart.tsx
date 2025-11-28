import { useState, useMemo } from 'react';
import { QueryResult } from '@/services/sqlParser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';

interface QueryResultChartProps {
  result: QueryResult;
  chartType: 'bar' | 'line' | 'pie';
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

export function QueryResultChart({ result, chartType }: QueryResultChartProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');

  if (!result || result.rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">No data to display</p>
        </CardContent>
      </Card>
    );
  }

  const firstColumn = result.columns[0];
  const secondColumn = result.columns[1];

  // Transform, filter, and sort data
  const processedData = useMemo(() => {
    // Transform raw data
    let data = result.rows.map(row => {
      const obj: Record<string, any> = {};
      result.columns.forEach((col, idx) => {
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
  }, [result.rows, result.columns, filterColumn, filterValue, sortColumn, sortDirection]);

  // Pie chart data
  const pieChartData = useMemo(() => {
    return processedData.map((item, index) => ({
      name: String(item[firstColumn] || `Item ${index + 1}`),
      value: typeof item[secondColumn] === 'number' ? item[secondColumn] : parseFloat(item[secondColumn]) || 0
    })).filter(item => item.value > 0);
  }, [processedData, firstColumn, secondColumn]);

  const clearFilters = () => {
    setFilterColumn(null);
    setFilterValue('');
    setSortColumn(null);
    setSortDirection('asc');
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const FilterControls = () => (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterColumn || ''} onValueChange={(val) => setFilterColumn(val || null)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Filter by..." />
          </SelectTrigger>
          <SelectContent>
            {result.columns.map(col => (
              <SelectItem key={col} value={col}>{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterColumn && (
          <Input
            placeholder="Filter value..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="w-[140px] h-8 text-xs"
          />
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <Select value={sortColumn || ''} onValueChange={(val) => { setSortColumn(val || null); setSortDirection('asc'); }}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {result.columns.map(col => (
              <SelectItem key={col} value={col}>{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sortColumn && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            <SortIcon column={sortColumn} />
          </Button>
        )}
      </div>

      {(filterColumn || sortColumn) && (
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearFilters}>
          <X className="h-3 w-3 mr-1" /> Clear
        </Button>
      )}
      
      <span className="text-xs text-muted-foreground ml-auto">
        {processedData.length} of {result.rows.length} records
      </span>
    </div>
  );

  if (chartType === 'bar') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Bar Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterControls />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={firstColumn} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={secondColumn} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  if (chartType === 'line') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Line Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterControls />
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={firstColumn} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={secondColumn} stroke="hsl(var(--primary))" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  if (chartType === 'pie') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pie Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterControls />
          {pieChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No valid numeric data for pie chart</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
