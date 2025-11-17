import { QueryResult } from '@/services/sqlParser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface QueryResultChartProps {
  result: QueryResult;
  chartType: 'bar' | 'line' | 'pie';
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

export function QueryResultChart({ result, chartType }: QueryResultChartProps) {
  if (!result || result.rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">No data to display</p>
        </CardContent>
      </Card>
    );
  }

  // Transform data for charts
  const chartData = result.rows.map(row => {
    const obj: Record<string, any> = {};
    result.columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });

  const firstColumn = result.columns[0];
  const secondColumn = result.columns[1];

  if (chartType === 'bar') {
    return (
      <Card>
        <CardHeader>
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
        <CardHeader>
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
        <CardHeader>
          <CardTitle className="text-sm">Pie Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={secondColumn}
                nameKey={firstColumn}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return null;
}
