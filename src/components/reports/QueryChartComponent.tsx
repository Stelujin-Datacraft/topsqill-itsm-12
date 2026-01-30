import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { executeUserQuery, QueryResult } from '@/services/sqlParser';
import { QueryChartConfig } from '@/types/reports';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, 
  ScatterChart, Scatter, AreaChart, Area,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ZAxis 
} from 'recharts';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface QueryChartComponentProps {
  config: QueryChartConfig;
}

const COLORFUL_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const GRAYSCALE_COLORS = ['#1f2937', '#374151', '#4b5563', '#6b7280', '#111827', '#334155', '#1e293b', '#0f172a'];

export function QueryChartComponent({ config }: QueryChartComponentProps) {
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasExecutedRef = useRef(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    title = 'Query Chart',
    description,
    query = '',
    chartType = 'bar',
    executeOn = 'load',
    colorful = true,
    refreshInterval = 0,
    maxResults = 100
  } = config;

  const COLORS = colorful ? COLORFUL_COLORS : GRAYSCALE_COLORS;
  const barFill = colorful ? 'hsl(var(--primary))' : '#374151';
  const lineStroke = colorful ? 'hsl(var(--primary))' : '#374151';
  const areaFill = colorful ? 'hsl(var(--primary))' : '#374151';

  const executeQuery = useCallback(async () => {
    if (!query.trim()) {
      setError('No query defined');
      return;
    }

    setIsExecuting(true);
    setError(null);
    
    try {
      const result = await executeUserQuery(query);
      
      // Apply max results limit
      if (maxResults && result.rows.length > maxResults) {
        result.rows = result.rows.slice(0, maxResults);
      }
      
      setQueryResult(result);
      setLastExecuted(new Date().toLocaleTimeString());
      
      if (result.errors.length > 0) {
        setError(result.errors[0]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute query';
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [query, maxResults]);

  // Auto-execute on load
  useEffect(() => {
    if (executeOn === 'load' && !hasExecutedRef.current && query.trim()) {
      hasExecutedRef.current = true;
      executeQuery();
    }
  }, [executeOn, query, executeQuery]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        executeQuery();
      }, refreshInterval * 1000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshInterval, executeQuery]);

  // Detect if Y-axis has text values that need encoding
  const yAxisTextMapping = React.useMemo(() => {
    if (!queryResult || queryResult.columns.length < 2) return null;
    
    const secondColumn = queryResult.columns[1];
    const uniqueTextValues: string[] = [];
    let hasTextValues = false;
    
    queryResult.rows.forEach(row => {
      const value = row[1];
      if (value !== null && value !== undefined) {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numericValue) || (typeof value === 'string' && value.trim() !== '' && isNaN(Number(value)))) {
          hasTextValues = true;
          const strValue = String(value);
          if (!uniqueTextValues.includes(strValue)) {
            uniqueTextValues.push(strValue);
          }
        }
      }
    });
    
    if (!hasTextValues) return null;
    
    // Create mapping: text -> index (1-based for visibility)
    const mapping: Record<string, number> = {};
    uniqueTextValues.forEach((text, idx) => {
      mapping[text] = idx + 1;
    });
    
    return { column: secondColumn, mapping, values: uniqueTextValues };
  }, [queryResult]);

  // Transform data for charts
  const chartData = React.useMemo(() => {
    if (!queryResult || queryResult.rows.length === 0) return [];
    
    return queryResult.rows.map(row => {
      const obj: Record<string, any> = {};
      queryResult.columns.forEach((col, idx) => {
        const value = row[idx];
        
        // Check if this is the Y-axis column with text encoding
        if (idx === 1 && yAxisTextMapping) {
          const strValue = String(value);
          obj[col] = yAxisTextMapping.mapping[strValue] ?? 0;
          obj[`${col}_original`] = strValue;
        } else {
          const numericValue = typeof value === 'string' ? parseFloat(value) : value;
          if (typeof numericValue === 'number' && !isNaN(numericValue)) {
            obj[col] = numericValue;
          } else if (typeof value === 'string') {
            obj[col] = value;
          } else {
            obj[col] = 0;
          }
        }
      });
      return obj;
    });
  }, [queryResult, yAxisTextMapping]);

  // Pie/Donut chart data
  const pieChartData = React.useMemo(() => {
    if (!queryResult || queryResult.columns.length < 2) return [];
    
    const firstColumn = queryResult.columns[0];
    const secondColumn = queryResult.columns[1];
    
    return chartData.map((item, index) => {
      const rawValue = item[secondColumn];
      let numValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      if (isNaN(numValue)) numValue = 0;
      return {
        name: String(item[firstColumn] || `Item ${index + 1}`),
        value: numValue
      };
    }).filter(item => item.value > 0);
  }, [chartData, queryResult]);

  // Scatter/Bubble data with text encoding
  const scatterData = React.useMemo(() => {
    if (!queryResult || queryResult.columns.length < 2) return [];
    
    const firstColumn = queryResult.columns[0];
    const secondColumn = queryResult.columns[1];
    const thirdColumn = queryResult.columns[2];
    
    return chartData.map((item, idx) => {
      const xRaw = item[firstColumn];
      // For Y, use the encoded value if text mapping exists
      const yRaw = yAxisTextMapping 
        ? item[secondColumn] 
        : item[secondColumn];
      const yOriginalValue = yAxisTextMapping 
        ? item[`${secondColumn}_original`] 
        : item[secondColumn];
      const sizeRaw = thirdColumn ? item[thirdColumn] : 1;
      
      let x = typeof xRaw === 'number' ? xRaw : parseFloat(xRaw);
      if (isNaN(x)) x = idx + 1;
      
      let y = typeof yRaw === 'number' ? yRaw : parseFloat(yRaw);
      if (isNaN(y)) y = 0;
      
      let size = typeof sizeRaw === 'number' ? sizeRaw : parseFloat(sizeRaw) || 1;
      
      return {
        x,
        y,
        z: size,
        xOriginal: xRaw,
        yOriginal: yOriginalValue,
        sizeOriginal: sizeRaw,
        name: String(xRaw)
      };
    });
  }, [chartData, queryResult, yAxisTextMapping]);

  // Y-axis tick formatter for text encoding
  const yAxisTickFormatter = (value: number) => {
    if (!yAxisTextMapping) return String(value);
    const entry = Object.entries(yAxisTextMapping.mapping).find(([_, v]) => v === value);
    return entry ? entry[0] : String(value);
  };

  // Custom tooltip for showing original text values
  const renderEnhancedTooltip = (firstColumn: string, secondColumn: string) => {
    return ({ active, payload, label }: any) => {
      if (!active || !payload || payload.length === 0) return null;
      const data = payload[0]?.payload;
      if (!data) return null;
      
      const yOriginal = yAxisTextMapping ? data[`${secondColumn}_original`] : data[secondColumn];
      
      return (
        <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{firstColumn}:</span>
              <span className="font-semibold">{label || data[firstColumn]}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{secondColumn}:</span>
              <span className="font-semibold">{yOriginal}</span>
            </div>
          </div>
        </div>
      );
    };
  };

  // Legend sidebar component for text Y-axis encoding
  const renderLegendSidebar = () => {
    if (!yAxisTextMapping) return null;
    
    return (
      <div className="w-32 flex-shrink-0 border-l border-border pl-3 ml-2">
        <div className="text-xs font-medium text-muted-foreground mb-2">Y-Axis Legend</div>
        <ScrollArea className="h-[240px]">
          <div className="space-y-1.5">
            {yAxisTextMapping.values.map((text, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground w-4 text-right">{idx + 1}</span>
                <span className="truncate" title={text}>{text}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderChart = () => {
    if (!queryResult || queryResult.rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          {executeOn === 'manual' ? 'Click refresh to execute query' : 'No data to display'}
        </div>
      );
    }

    const firstColumn = queryResult.columns[0];
    const secondColumn = queryResult.columns[1];
    const thirdColumn = queryResult.columns[2];

    // Calculate Y-axis domain for text encoding
    const yDomain = yAxisTextMapping 
      ? [0, yAxisTextMapping.values.length + 1] 
      : undefined;

    switch (chartType) {
      case 'bar':
        return (
          <div className="flex h-full">
            <ScrollArea className="flex-1 h-full">
              <div style={{ minWidth: Math.max(400, chartData.length * 60), height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={firstColumn} />
                    <YAxis 
                      domain={yDomain}
                      tickFormatter={yAxisTextMapping ? yAxisTickFormatter : undefined}
                      width={yAxisTextMapping ? 60 : undefined}
                    />
                    <Tooltip content={renderEnhancedTooltip(firstColumn, secondColumn)} />
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
            {renderLegendSidebar()}
          </div>
        );

      case 'line':
        return (
          <div className="flex h-full">
            <ScrollArea className="flex-1 h-full">
              <div style={{ minWidth: Math.max(400, chartData.length * 60), height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={firstColumn} />
                    <YAxis 
                      domain={yDomain}
                      tickFormatter={yAxisTextMapping ? yAxisTickFormatter : undefined}
                      width={yAxisTextMapping ? 60 : undefined}
                    />
                    <Tooltip content={renderEnhancedTooltip(firstColumn, secondColumn)} />
                    <Legend />
                    <Line type="monotone" dataKey={secondColumn} stroke={lineStroke} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {renderLegendSidebar()}
          </div>
        );

      case 'area':
        return (
          <div className="flex h-full">
            <ScrollArea className="flex-1 h-full">
              <div style={{ minWidth: Math.max(400, chartData.length * 60), height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={firstColumn} />
                    <YAxis 
                      domain={yDomain}
                      tickFormatter={yAxisTextMapping ? yAxisTickFormatter : undefined}
                      width={yAxisTextMapping ? 60 : undefined}
                    />
                    <Tooltip content={renderEnhancedTooltip(firstColumn, secondColumn)} />
                    <Legend />
                    <Area type="monotone" dataKey={secondColumn} stroke={lineStroke} fill={areaFill} fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {renderLegendSidebar()}
          </div>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'donut' ? 50 : 0}
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
        );

      case 'scatter':
        return (
          <div className="flex h-full">
            <ResponsiveContainer width={yAxisTextMapping ? "calc(100% - 140px)" : "100%"} height={280}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name={firstColumn} />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name={secondColumn}
                  domain={yDomain}
                  tickFormatter={yAxisTextMapping ? yAxisTickFormatter : undefined}
                />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    const yDisplay = yAxisTextMapping 
                      ? yAxisTextMapping.values[data.y - 1] || data.yOriginal
                      : data.yOriginal;
                    return (
                      <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{firstColumn}:</span>
                            <span className="font-semibold">{data.xOriginal}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{secondColumn}:</span>
                            <span className="font-semibold">{yDisplay}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Scatter name="Data" data={scatterData} fill={COLORS[0]}>
                  {colorful && scatterData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            {renderLegendSidebar()}
          </div>
        );

      case 'bubble':
        return (
          <div className="flex h-full">
            <ResponsiveContainer width={yAxisTextMapping ? "calc(100% - 140px)" : "100%"} height={280}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name={firstColumn} />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name={secondColumn}
                  domain={yDomain}
                  tickFormatter={yAxisTextMapping ? yAxisTickFormatter : undefined}
                />
                <ZAxis type="number" dataKey="z" range={[50, 400]} name={thirdColumn || 'Size'} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    const yDisplay = yAxisTextMapping 
                      ? yAxisTextMapping.values[data.y - 1] || data.yOriginal
                      : data.yOriginal;
                    return (
                      <div className="bg-popover text-foreground border border-border rounded-md shadow-md p-3">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{firstColumn}:</span>
                            <span className="font-semibold">{data.xOriginal}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{secondColumn}:</span>
                            <span className="font-semibold">{yDisplay}</span>
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
                <Scatter name="Data" data={scatterData} fill={COLORS[0]}>
                  {colorful && scatterData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            {renderLegendSidebar()}
          </div>
        );

      default:
        return <div className="text-muted-foreground">Unsupported chart type</div>;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              {title}
              <Badge variant="secondary" className="text-xs">Query</Badge>
            </CardTitle>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-2">
            {lastExecuted && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastExecuted}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={executeQuery}
              disabled={isExecuting}
              className="h-7 px-2"
            >
              {isExecuting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pb-2">
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm mb-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {isExecuting && !queryResult ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  );
}
