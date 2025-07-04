
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  LineChart as RechartsLineChart, 
  Line, 
  AreaChart as RechartsAreaChart,
  Area,
  ScatterChart as RechartsScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  FunnelChart,
  Funnel,
  Treemap,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { useReports } from '@/hooks/useReports';
import { ChartConfig } from '@/types/reports';

interface ChartPreviewProps {
  config: ChartConfig;
  onEdit?: () => void;
}

const colorSchemes = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#d084d0', '#8dd1e1', '#ffb347'],
  vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'],
  pastel: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFB3FF', '#D5AAFF', '#FFD3A5', '#AAFFE6'],
  monochrome: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7', '#85929E', '#5D6D7E', '#AEB6BF'],
};

export function ChartPreview({ config, onEdit }: ChartPreviewProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { getFormSubmissionData } = useReports();

  useEffect(() => {
    const loadChartData = async () => {
      // Use sample data if provided, otherwise fetch from form
      if ((config as any).data) {
        setChartData((config as any).data);
        setLoading(false);
        return;
      }

      if (!config.formId || (!config.dimensions?.length && !config.xAxis) || (!config.metrics?.length && !config.yAxis && config.aggregationType !== 'count')) {
        setLoading(false);
        return;
      }

      try {
        const submissions = await getFormSubmissionData(config.formId);
        const processedData = processSubmissionData(submissions);
        setChartData(processedData);
      } catch (error) {
        console.error('Error loading chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [config.formId, config.dimensions, config.metrics, config.filters, config.xAxis, config.yAxis, config.aggregationType, (config as any).data]);

  const processSubmissionData = (submissions: any[]) => {
    if (!submissions.length) return [];

    const processedData: { [key: string]: any } = {};

    submissions.forEach(submission => {
      const submissionData = submission.submission_data;
      
      // Apply filters
      const passesFilters = config.filters?.every(filter => {
        const value = submissionData[filter.field];
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).includes(filter.value);
          case 'greater_than':
            return Number(value) > Number(filter.value);
          case 'less_than':
            return Number(value) < Number(filter.value);
          default:
            return true;
        }
      }) ?? true;

      if (!passesFilters) return;

      // Create dimension key - use xAxis if dimensions not set
      const dimensionFields = config.dimensions && config.dimensions.length > 0 ? config.dimensions : [config.xAxis];
      const dimensionKey = dimensionFields
        .map(dim => submissionData[dim] || 'Unknown')
        .join(' - ');

      if (!processedData[dimensionKey]) {
        processedData[dimensionKey] = {
          name: dimensionKey,
        };
        
        // Initialize metrics - use yAxis/aggregationType if metrics not set
        const metricFields = config.metrics && config.metrics.length > 0 
          ? config.metrics 
          : config.aggregationType === 'count' 
            ? ['count'] 
            : config.yAxis ? [config.yAxis] : ['count'];

        metricFields.forEach(metric => {
          processedData[dimensionKey][metric] = 0;
        });
      }

      // Aggregate metrics
      const metricFields = config.metrics && config.metrics.length > 0 
        ? config.metrics 
        : config.aggregationType === 'count' 
          ? ['count'] 
          : config.yAxis ? [config.yAxis] : ['count'];

      metricFields.forEach(metric => {
        if (metric === 'count' || config.aggregationType === 'count') {
          processedData[dimensionKey][metric] += 1;
        } else {
          const value = submissionData[metric] || submissionData[config.yAxis];
          if (typeof value === 'number') {
            processedData[dimensionKey][metric] += value;
          } else if (value) {
            processedData[dimensionKey][metric] += 1;
          }
        }
      });
    });

    return Object.values(processedData);
  };

  const colors = colorSchemes[config.colorTheme || 'default'];

  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading chart data...</div>
        </div>
      );
    }

    if (!chartData.length) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">No data available</div>
            <div className="text-sm text-muted-foreground">Configure the chart settings to display data</div>
          </div>
        </div>
      );
    }

    const primaryMetric = (config.metrics && config.metrics.length > 0) ? config.metrics[0] : 
                         config.yAxis || 
                         (config.aggregationType === 'count' ? 'count' : 'value');
    const chartType = config.type || config.chartType || 'bar';

    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {(config.metrics || [primaryMetric]).map((metric, index) => (
              <Bar 
                key={metric} 
                dataKey={metric} 
                fill={colors[index % colors.length]} 
                name={metric}
              />
            ))}
          </BarChart>
        );

      case 'column':
        return (
          <BarChart data={chartData} layout="horizontal">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={80} />
            <Tooltip />
            <Legend />
            {(config.metrics || [primaryMetric]).map((metric, index) => (
              <Bar 
                key={metric} 
                dataKey={metric} 
                fill={colors[index % colors.length]} 
                name={metric}
              />
            ))}
          </BarChart>
        );
      
      case 'pie':
        return (
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey={primaryMetric}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </RechartsPieChart>
        );

      case 'donut':
        return (
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={config.innerRadius || 40}
              outerRadius={80}
              fill="#8884d8"
              dataKey={primaryMetric}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </RechartsPieChart>
        );
      
      case 'line':
        return (
          <RechartsLineChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {(config.metrics || [primaryMetric]).map((metric, index) => (
              <Line 
                key={metric}
                type="monotone" 
                dataKey={metric} 
                stroke={colors[index % colors.length]} 
                strokeWidth={2}
                name={metric}
              />
            ))}
          </RechartsLineChart>
        );
      
      case 'area':
        return (
          <RechartsAreaChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {(config.metrics || [primaryMetric]).map((metric, index) => (
              <Area 
                key={metric}
                type="monotone" 
                dataKey={metric} 
                stroke={colors[index % colors.length]} 
                fill={colors[index % colors.length]} 
                fillOpacity={0.6}
                name={metric}
              />
            ))}
          </RechartsAreaChart>
        );
      
      case 'scatter':
        return (
          <RechartsScatterChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis dataKey={primaryMetric} />
            <Tooltip />
            <Scatter dataKey={primaryMetric} fill={colors[0]} />
          </RechartsScatterChart>
        );

      case 'bubble':
        // For bubble chart, use multiple scatter components with different sizes
        const sizeField = config.sizeField || primaryMetric;
        const bubbleData = chartData.map(item => ({
          ...item,
          size: item[sizeField] || 10
        }));
        
        return (
          <RechartsScatterChart data={bubbleData}>
            <XAxis dataKey="name" />
            <YAxis dataKey={primaryMetric} />
            <Tooltip 
              formatter={(value, name, props) => [
                `${name}: ${value}`,
                `Size: ${props.payload.size}`
              ]}
            />
            {bubbleData.map((entry, index) => (
              <Scatter
                key={index}
                data={[entry]}
                fill={colors[index % colors.length]}
                r={Math.max(5, Math.min(20, entry.size / 2))}
              />
            ))}
          </RechartsScatterChart>
        );

      case 'heatmap':
        // Generate heatmap data grid
        const heatmapData = chartData.map((item, index) => ({
          ...item,
          x: index % (config.gridColumns || 5),
          y: Math.floor(index / (config.gridColumns || 5)),
          value: item[config.heatmapIntensityField || primaryMetric]
        }));
        
        return (
          <div className="relative">
            <div className="grid gap-1" style={{ 
              gridTemplateColumns: `repeat(${config.gridColumns || 5}, 1fr)`,
              maxWidth: '100%'
            }}>
              {heatmapData.map((cell, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-sm flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: colors[Math.floor((cell.value / Math.max(...heatmapData.map(d => d.value))) * (colors.length - 1))],
                    color: cell.value > (Math.max(...heatmapData.map(d => d.value)) / 2) ? 'white' : 'black'
                  }}
                  title={`${cell.name}: ${cell.value}`}
                >
                  {cell.value}
                </div>
              ))}
            </div>
          </div>
        );

      case 'table':
        return (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Category
                  </th>
                  {(config.metrics || [primaryMetric]).map((metric) => (
                    <th key={metric} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {metric}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {chartData.map((row, index) => (
                  <tr key={index} className="hover:bg-muted/50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      {row.name}
                    </td>
                    {(config.metrics || [primaryMetric]).map((metric) => (
                      <td key={metric} className="px-4 py-2 whitespace-nowrap text-sm">
                        {row[metric]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      default:
        return (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Chart type "{chartType}" not implemented yet
          </div>
        );
    }
  };

  return (
    <div className="space-y-4 relative group">
      {onEdit && (
        <Button
          size="sm"
          variant="outline"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}
      {config.title && (
        <div>
          <h3 className="text-lg font-semibold">{config.title}</h3>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </div>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
