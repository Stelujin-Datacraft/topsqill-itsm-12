import { QueryResult } from '@/services/sqlParser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, Info } from 'lucide-react';
import { useMemo } from 'react';

interface QueryResultChartProps {
  result: QueryResult;
  chartType: 'bar' | 'line' | 'pie';
}

const COLORS = [
  'hsl(var(--primary))', 
  'hsl(var(--chart-2))', 
  'hsl(var(--chart-3))', 
  'hsl(var(--chart-4))', 
  'hsl(var(--chart-5))',
  '#82ca9d', 
  '#ffc658', 
  '#ff8042', 
  '#0088FE', 
  '#00C49F'
];

// Check if a value is numeric
const isNumeric = (value: any): boolean => {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(Number(value)) && isFinite(Number(value));
};

// Format number for display
const formatNumber = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toFixed(value % 1 === 0 ? 0 : 2);
};

// Analyze data for chart compatibility
interface DataAnalysis {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  dimensionColumn: string;
  metricColumns: string[];
  chartData: Record<string, any>[];
  hasNegativeValues: boolean;
  maxCategories: number;
}

function analyzeChartData(result: QueryResult, chartType: string): DataAnalysis {
  const analysis: DataAnalysis = {
    isValid: true,
    warnings: [],
    errors: [],
    dimensionColumn: '',
    metricColumns: [],
    chartData: [],
    hasNegativeValues: false,
    maxCategories: result.rows.length
  };

  // Check minimum columns
  if (result.columns.length < 2) {
    analysis.isValid = false;
    analysis.errors.push('Charts require at least 2 columns (dimension + metric)');
    return analysis;
  }

  // Check minimum rows
  if (result.rows.length === 0) {
    analysis.isValid = false;
    analysis.errors.push('No data to display');
    return analysis;
  }

  // First column is dimension (label/category)
  analysis.dimensionColumn = result.columns[0];

  // Find numeric columns for metrics (skip first column)
  for (let i = 1; i < result.columns.length; i++) {
    const columnValues = result.rows.map(row => row[i]);
    const numericCount = columnValues.filter(v => isNumeric(v)).length;
    
    // If more than 80% of values are numeric, consider it a metric column
    if (numericCount / result.rows.length >= 0.8) {
      analysis.metricColumns.push(result.columns[i]);
    }
  }

  // Check if we have at least one metric column
  if (analysis.metricColumns.length === 0) {
    analysis.isValid = false;
    analysis.errors.push('No numeric columns found for chart metrics. Second column onwards should contain numeric values.');
    return analysis;
  }

  // Transform data for charts
  analysis.chartData = result.rows.map(row => {
    const obj: Record<string, any> = {};
    result.columns.forEach((col, idx) => {
      const value = row[idx];
      // Convert numeric values
      if (idx > 0 && isNumeric(value)) {
        const numValue = Number(value);
        obj[col] = numValue;
        if (numValue < 0) {
          analysis.hasNegativeValues = true;
        }
      } else {
        obj[col] = value !== null && value !== undefined ? String(value) : '';
      }
    });
    return obj;
  });

  // Chart-specific validations
  if (chartType === 'pie') {
    if (analysis.hasNegativeValues) {
      analysis.warnings.push('Pie charts cannot display negative values properly. Consider using a bar chart instead.');
    }
    if (result.rows.length > 10) {
      analysis.warnings.push(`Pie chart has ${result.rows.length} slices. Consider limiting to 10 or fewer categories for better readability.`);
    }
    if (analysis.metricColumns.length > 1) {
      analysis.warnings.push('Pie charts only display the first metric column. Other metrics are ignored.');
    }
  }

  if (chartType === 'line' && result.rows.length < 2) {
    analysis.warnings.push('Line charts work best with 2+ data points to show trends.');
  }

  return analysis;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover border rounded-md shadow-md p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-muted-foreground">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-medium text-foreground">
            {typeof entry.value === 'number' ? formatNumber(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function QueryResultChart({ result, chartType }: QueryResultChartProps) {
  const analysis = useMemo(() => analyzeChartData(result, chartType), [result, chartType]);

  // Show errors
  if (!analysis.isValid) {
    return (
      <Card>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {analysis.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { chartData, dimensionColumn, metricColumns, warnings } = analysis;
  const primaryMetric = metricColumns[0];

  const renderWarnings = () => {
    if (warnings.length === 0) return null;
    return (
      <Alert className="mb-3">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <ul className="list-disc list-inside text-xs">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  };

  const chartTitle = chartType === 'bar' ? 'Bar Chart' : chartType === 'line' ? 'Line Chart' : 'Pie Chart';

  if (chartType === 'bar') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{chartTitle}</CardTitle>
            <div className="flex gap-1">
              {metricColumns.map((col, i) => (
                <Badge key={col} variant="outline" className="text-xs" style={{ borderColor: COLORS[i % COLORS.length] }}>
                  {col}
                </Badge>
              ))}
            </div>
          </div>
          <CardDescription className="text-xs">
            Showing {chartData.length} categories by {dimensionColumn}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          {renderWarnings()}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey={dimensionColumn} 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ className: 'stroke-border' }}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ className: 'stroke-border' }}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              {metricColumns.length > 1 && <Legend />}
              {metricColumns.map((metric, index) => (
                <Bar 
                  key={metric}
                  dataKey={metric} 
                  fill={COLORS[index % COLORS.length]} 
                  radius={[4, 4, 0, 0]}
                />
              ))}
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{chartTitle}</CardTitle>
            <div className="flex gap-1">
              {metricColumns.map((col, i) => (
                <Badge key={col} variant="outline" className="text-xs" style={{ borderColor: COLORS[i % COLORS.length] }}>
                  {col}
                </Badge>
              ))}
            </div>
          </div>
          <CardDescription className="text-xs">
            Trend of {metricColumns.join(', ')} by {dimensionColumn}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          {renderWarnings()}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey={dimensionColumn} 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ className: 'stroke-border' }}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ className: 'stroke-border' }}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              {metricColumns.length > 1 && <Legend />}
              {metricColumns.map((metric, index) => (
                <Line 
                  key={metric}
                  type="monotone" 
                  dataKey={metric} 
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[index % COLORS.length], strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{chartTitle}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {primaryMetric}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Distribution by {dimensionColumn}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          {renderWarnings()}
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={primaryMetric}
                nameKey={dimensionColumn}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={0}
                paddingAngle={1}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              >
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ paddingTop: 20 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return null;
}
