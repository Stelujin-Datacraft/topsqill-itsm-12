/**
 * Helpers for AI Report Builder → Grouping mode (multi-level count drilldown).
 */

export const MAX_GROUPING_LEVELS = 5;

export function groupingDrilldownConfig(dimensions: string[]) {
  const levels = dimensions.filter(Boolean).slice(0, MAX_GROUPING_LEVELS);
  return {
    enabled: levels.length > 0,
    levels,
    drilldownLevels: levels,
  };
}

/** Finalize chart config for apply / copilot insert. */
export function finalizeAiChartConfig(
  chartConfig: Record<string, any>,
  formId: string,
): Record<string, any> {
  const isGrouping = chartConfig.groupingMode === true;
  const isCompare = !isGrouping && chartConfig.compareMode === true;
  const dimensions = isCompare
    ? []
    : (chartConfig.dimensions || []).filter(Boolean).slice(0, isGrouping ? MAX_GROUPING_LEVELS : undefined);
  const metric = chartConfig.metrics?.[0] || chartConfig.yAxis || '';
  const dimension = dimensions[0] || chartConfig.xAxis || '';

  if (isGrouping) {
    const drill = groupingDrilldownConfig(dimensions);
    return {
      ...chartConfig,
      formId,
      xAxis: dimension || undefined,
      yAxis: undefined,
      groupingMode: true,
      compareMode: false,
      aggregationEnabled: true,
      aggregationType: 'count',
      aggregation: 'count',
      dimensions,
      metrics: [],
      metricAggregations: [{ field: 'count', aggregation: 'count' }],
      drilldownConfig: drill,
      drilldownEnabled: drill.enabled,
      drilldownLevels: drill.drilldownLevels,
    };
  }

  return {
    ...chartConfig,
    formId,
    xAxis: dimension || chartConfig.xAxis,
    yAxis: metric || chartConfig.yAxis,
    groupingMode: false,
    compareMode: isCompare,
    aggregationEnabled: !isCompare && (chartConfig.aggregationEnabled !== false),
    dimensions,
    metrics: (chartConfig.metrics || []).filter(Boolean),
    metricAggregations: isCompare
      ? []
      : (chartConfig.metricAggregations?.length
        ? chartConfig.metricAggregations
        : metric
          ? [{ field: metric, aggregation: chartConfig.aggregationType || 'count' }]
          : []),
    drilldownEnabled: chartConfig.drilldownConfig?.enabled || false,
    drilldownLevels: chartConfig.drilldownConfig?.levels || chartConfig.drilldownConfig?.drilldownLevels || [],
  };
}
