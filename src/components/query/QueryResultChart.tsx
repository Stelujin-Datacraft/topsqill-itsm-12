import { useMemo } from 'react';
import { QueryResult } from '@/services/sqlParser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from 'recharts';

interface QueryResultChartProps {
  result: QueryResult;
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'bubble';
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
  const thirdColumn = result.columns[2]; // For bubble chart size

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

  // Scatter/Bubble chart data with text field encoding
  const { scatterData, xMapping, yMapping, hasXMapping, hasYMapping, sizeRange } = useMemo(() => {
    // Check if X values are text (non-numeric)
    const xValues = chartData.map(d => d[firstColumn]);
    const yValues = chartData.map(d => d[secondColumn]);
    const hasTextX = xValues.some(v => typeof v === 'string' && isNaN(Number(v)));
    const hasTextY = yValues.some(v => typeof v === 'string' && isNaN(Number(v)));
    
    // Create mappings for text values
    let xMap: { number: number; label: string }[] = [];
    let yMap: { number: number; label: string }[] = [];
    
    if (hasTextX) {
      const uniqueX = [...new Set(xValues.map(v => String(v)))].sort();
      xMap = uniqueX.map((label, idx) => ({ number: idx + 1, label }));
    }
    if (hasTextY) {
      const uniqueY = [...new Set(yValues.map(v => String(v)))].sort();
      yMap = uniqueY.map((label, idx) => ({ number: idx + 1, label }));
    }
    
    // Calculate size range for bubble chart
    let minSize = Infinity, maxSize = -Infinity;
    if (chartType === 'bubble' && thirdColumn) {
      chartData.forEach(d => {
        const size = typeof d[thirdColumn] === 'number' ? d[thirdColumn] : parseFloat(d[thirdColumn]) || 0;
        if (size < minSize) minSize = size;
        if (size > maxSize) maxSize = size;
      });
    }
    
    // Transform data with encoding
    const transformed = chartData.map((item, idx) => {
      const xRaw = item[firstColumn];
      const yRaw = item[secondColumn];
      const sizeRaw = thirdColumn ? item[thirdColumn] : 1;
      
      // Encode x value
      let x = typeof xRaw === 'number' ? xRaw : parseFloat(xRaw);
      if (hasTextX) {
        const mapping = xMap.find(m => m.label === String(xRaw));
        x = mapping ? mapping.number : idx + 1;
      }
      if (isNaN(x)) x = idx + 1;
      
      // Encode y value
      let y = typeof yRaw === 'number' ? yRaw : parseFloat(yRaw);
      if (hasTextY) {
        const mapping = yMap.find(m => m.label === String(yRaw));
        y = mapping ? mapping.number : idx + 1;
      }
      if (isNaN(y)) y = 0;
      
      // Size for bubble chart
      let size = typeof sizeRaw === 'number' ? sizeRaw : parseFloat(sizeRaw) || 1;
      
      return {
        x,
        y,
        z: size,
        xOriginal: xRaw,
        yOriginal: yRaw,
        sizeOriginal: sizeRaw,
        name: String(xRaw)
      };
    });
    
    return {
      scatterData: transformed,
      xMapping: xMap,
      yMapping: yMap,
      hasXMapping: xMap.length > 0,
      hasYMapping: yMap.length > 0,
      sizeRange: { min: minSize === Infinity ? 0 : minSize, max: maxSize === -Infinity ? 100 : maxSize }
    };
  }, [chartData, firstColumn, secondColumn, thirdColumn, chartType]);

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

  if (chartType === 'scatter') {
    const xDomain: [number, number] = hasXMapping 
      ? [0.5, xMapping.length + 0.5] 
      : ['auto', 'auto'] as any;
    const yDomain: [number, number] = hasYMapping 
      ? [0.5, yMapping.length + 0.5] 
      : ['auto', 'auto'] as any;
    
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Scatter Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name={firstColumn}
                domain={xDomain}
                ticks={hasXMapping ? xMapping.map(m => m.number) : undefined}
                tickFormatter={hasXMapping ? (val) => {
                  const mapping = xMapping.find(m => m.number === val);
                  return mapping?.label || String(val);
                } : undefined}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name={secondColumn}
                domain={yDomain}
                ticks={hasYMapping ? yMapping.map(m => m.number) : undefined}
                tickFormatter={hasYMapping ? (val) => {
                  const mapping = yMapping.find(m => m.number === val);
                  return mapping?.label || String(val);
                } : undefined}
              />
              <Tooltip 
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const data = payload[0]?.payload;
                  if (!data) return null;
                  return (
                    <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{firstColumn}:</span>
                          <span className="font-semibold">{data.xOriginal}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{secondColumn}:</span>
                          <span className="font-semibold">{data.yOriginal}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend />
              <Scatter 
                name="Data" 
                data={scatterData} 
                fill={colorful ? COLORS[0] : GRAYSCALE_COLORS[0]}
              >
                {colorful && scatterData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  if (chartType === 'bubble') {
    const xDomain: [number, number] = hasXMapping 
      ? [0.5, xMapping.length + 0.5] 
      : ['auto', 'auto'] as any;
    const yDomain: [number, number] = hasYMapping 
      ? [0.5, yMapping.length + 0.5] 
      : ['auto', 'auto'] as any;
    
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Bubble Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name={firstColumn}
                domain={xDomain}
                ticks={hasXMapping ? xMapping.map(m => m.number) : undefined}
                tickFormatter={hasXMapping ? (val) => {
                  const mapping = xMapping.find(m => m.number === val);
                  return mapping?.label || String(val);
                } : undefined}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name={secondColumn}
                domain={yDomain}
                ticks={hasYMapping ? yMapping.map(m => m.number) : undefined}
                tickFormatter={hasYMapping ? (val) => {
                  const mapping = yMapping.find(m => m.number === val);
                  return mapping?.label || String(val);
                } : undefined}
              />
              <ZAxis 
                type="number" 
                dataKey="z" 
                range={[50, 400]} 
                name={thirdColumn || 'Size'}
              />
              <Tooltip 
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const data = payload[0]?.payload;
                  if (!data) return null;
                  return (
                    <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{firstColumn}:</span>
                          <span className="font-semibold">{data.xOriginal}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{secondColumn}:</span>
                          <span className="font-semibold">{data.yOriginal}</span>
                        </div>
                        {thirdColumn && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{thirdColumn}:</span>
                            <span className="font-semibold">{data.sizeOriginal}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend />
              <Scatter 
                name="Data" 
                data={scatterData} 
                fill={colorful ? COLORS[0] : GRAYSCALE_COLORS[0]}
              >
                {colorful && scatterData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return null;
}
