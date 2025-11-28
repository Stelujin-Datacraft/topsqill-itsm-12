import { useMemo } from 'react';
import { QueryResult } from '@/services/sqlParser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface QueryResultChartProps {
  result: QueryResult;
  chartType: 'bar' | 'line' | 'pie';
  colorful?: boolean;
}

const COLORFUL_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];
const GRAYSCALE_COLORS = ['#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#4B5563', '#1F2937', '#111827', '#E5E7EB'];

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
        obj[col] = !isNaN(numericValue) && typeof numericValue === 'number' ? numericValue : value;
      });
      return obj;
    });
  }, [result.rows, result.columns]);

  // Pie chart data
  const pieChartData = useMemo(() => {
    return chartData.map((item, index) => ({
      name: String(item[firstColumn] || `Item ${index + 1}`),
      value: typeof item[secondColumn] === 'number' ? item[secondColumn] : parseFloat(item[secondColumn]) || 0
    })).filter(item => item.value > 0);
  }, [chartData, firstColumn, secondColumn]);

  if (chartType === 'bar') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Bar Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={firstColumn} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={secondColumn} fill={barFill} />
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
