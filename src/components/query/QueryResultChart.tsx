import { useMemo } from 'react';
import { QueryResult } from '@/services/sqlParser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface QueryResultChartProps {
  result: QueryResult;
  chartType: 'bar' | 'line' | 'pie';
  colorful?: boolean;
}

const COLORFUL_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const GRAYSCALE_COLORS = ['#1f2937', '#374151', '#4b5563', '#6b7280', '#111827', '#334155', '#1e293b', '#0f172a'];

export function QueryResultChart({ result, chartType, colorful = true }: QueryResultChartProps) {
  const COLORS = colorful ? COLORFUL_COLORS : GRAYSCALE_COLORS;
  const barFill = colorful ? 'hsl(var(--primary))' : '#374151';
  const lineStroke = colorful ? 'hsl(var(--primary))' : '#374151';
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

  // Transform data for charts (filtering is done at parent level)
  const chartData = useMemo(() => {
    return result.rows.map(row => {
      const obj: Record<string, any> = {};
      result.columns.forEach((col, idx) => {
        const value = row[idx];
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;
        // Ensure NaN values are replaced with 0 to prevent Recharts crash
        if (typeof numericValue === 'number' && !isNaN(numericValue)) {
          obj[col] = numericValue;
        } else if (typeof value === 'string') {
          obj[col] = value;
        } else {
          obj[col] = 0;
        }
      });
      return obj;
    });
  }, [result.rows, result.columns]);

  // Pie chart data
  const pieChartData = useMemo(() => {
    return chartData.map((item, index) => {
      const rawValue = item[secondColumn];
      let numValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      // Ensure NaN values become 0
      if (isNaN(numValue)) numValue = 0;
      return {
        name: String(item[firstColumn] || `Item ${index + 1}`),
        value: numValue
      };
    }).filter(item => item.value > 0);
  }, [chartData, firstColumn, secondColumn]);

  if (chartType === 'bar') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Bar Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div style={{ minWidth: Math.max(400, chartData.length * 60) }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={firstColumn} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={secondColumn} fill={barFill}>
                    {colorful && chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
          <ScrollArea className="w-full">
            <div style={{ minWidth: Math.max(400, chartData.length * 60) }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={firstColumn} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={secondColumn} stroke={lineStroke} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
