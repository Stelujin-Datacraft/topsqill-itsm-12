/**
 * AI Builder report confirmation helpers.
 * Mirrors Report Editor AI Report Builder: generate draft → confirm → create.
 */

export type ReportChartType = 'bar' | 'line' | 'pie' | 'table' | 'area' | 'donut';

export interface PendingReportDraft {
  action: 'create_report' | 'update_report';
  params: Record<string, any>;
  prompt: string;
  formId: string;
  formName?: string;
  step: 'confirm' | 'chart_type' | 'dimension' | 'metric';
}

export function fieldLabelFromId(
  fields: Array<{ id: string; label: string }>,
  id: string | undefined,
): string {
  if (!id) return '(not set)';
  return fields.find((f) => f.id === id)?.label || id;
}

export function summarizeReportDraft(
  params: Record<string, any>,
  formName: string,
  fields: Array<{ id: string; label: string }>,
): string {
  const chart = params.chartConfig || {};
  const chartType = String(chart.chartType || chart.type || 'bar');
  const name = String(params.name || chart.title || 'Untitled report');
  const isGrouping = chart.groupingMode === true;
  const dim = chart.dimensions?.[0] || chart.xAxis;
  const metric = chart.metrics?.[0] || chart.yAxis;
  const dimLabel = fieldLabelFromId(fields, dim);
  const metricLabel = isGrouping
    ? 'Count'
    : fieldLabelFromId(fields, metric);

  const lines = [
    `I'll create a **${chartType}** report from **${formName}**:`,
    '',
    `• **Name:** ${name}`,
    `• **Chart type:** ${chartType}`,
    isGrouping
      ? `• **Grouping:** ${dimLabel}${(chart.dimensions || []).length > 1 ? ` (+${(chart.dimensions || []).length - 1} more)` : ''}`
      : `• **X / dimension:** ${dimLabel}`,
    `• **Y / metric:** ${metricLabel}`,
    '',
    'Confirm to create, or adjust chart type / fields first.',
  ];
  return lines.join('\n');
}

export function reportConfirmChoices(): Array<{ label: string; value: string }> {
  return [
    { label: 'Create report', value: '__confirm_report__' },
    { label: 'Change chart type', value: '__ask_chart_type__' },
    { label: 'Change X / grouping field', value: '__ask_dimension__' },
    { label: 'Change Y / metric field', value: '__ask_metric__' },
    { label: 'Cancel', value: '__cancel_report__' },
  ];
}

export function reportChartTypeChoices(): Array<{ label: string; value: string }> {
  return [
    { label: 'Bar', value: 'bar' },
    { label: 'Line', value: 'line' },
    { label: 'Pie', value: 'pie' },
    { label: 'Donut', value: 'donut' },
    { label: 'Area', value: 'area' },
    { label: 'Table', value: 'table' },
  ];
}

export function reportFieldChoices(
  fields: Array<{ id: string; label: string; type?: string }>,
): Array<{ label: string; value: string }> {
  return fields.map((f) => ({
    value: f.id,
    label: f.type ? `${f.label} (${f.type})` : f.label,
  }));
}

/** Apply a confirm-step answer onto draft params. Returns null if cancelled. */
export function applyReportConfirmAnswer(
  draft: PendingReportDraft,
  answer: string,
  fields: Array<{ id: string; label: string }>,
): { draft: PendingReportDraft | null; ready: boolean; cancelled: boolean; assistantMessage?: string } {
  const value = String(answer || '').trim();
  const lower = value.toLowerCase();
  const chart = { ...(draft.params.chartConfig || {}) };

  if (value === '__cancel_report__' || /^(cancel|no|stop)\b/i.test(lower)) {
    return { draft: null, ready: false, cancelled: true, assistantMessage: 'Okay — report creation cancelled.' };
  }

  if (draft.step === 'confirm') {
    if (
      value === '__confirm_report__'
      || /^(y|yes|ok|create|confirm|go|do it|looks good)\b/i.test(lower)
    ) {
      return {
        draft: {
          ...draft,
          params: { ...draft.params, chartConfig: chart, __reportConfirmed: true },
        },
        ready: true,
        cancelled: false,
      };
    }
    if (value === '__ask_chart_type__' || /chart\s*type/i.test(lower)) {
      return {
        draft: { ...draft, step: 'chart_type', params: { ...draft.params, chartConfig: chart } },
        ready: false,
        cancelled: false,
        assistantMessage: 'Which **chart type** should this report use?',
      };
    }
    if (value === '__ask_dimension__' || /\b(x|dimension|group|axis)\b/i.test(lower)) {
      return {
        draft: { ...draft, step: 'dimension', params: { ...draft.params, chartConfig: chart } },
        ready: false,
        cancelled: false,
        assistantMessage: 'Which form field should be the **X-axis / grouping** field?',
      };
    }
    if (value === '__ask_metric__' || /\b(y|metric|value|count|measure)\b/i.test(lower)) {
      return {
        draft: { ...draft, step: 'metric', params: { ...draft.params, chartConfig: chart } },
        ready: false,
        cancelled: false,
        assistantMessage: 'Which form field should be the **Y-axis / metric**? (Or reply **count** for a count aggregation.)',
      };
    }
    // Unknown text on confirm → treat as freeform tweak request, stay on confirm
    return {
      draft,
      ready: false,
      cancelled: false,
      assistantMessage: 'Pick **Create report**, or choose what to change (chart type / X field / Y field).',
    };
  }

  if (draft.step === 'chart_type') {
    const type = (reportChartTypeChoices().find((c) =>
      c.value === lower || c.label.toLowerCase() === lower,
    )?.value || lower.replace(/[^a-z]/g, '')) as ReportChartType;
    const allowed = new Set(reportChartTypeChoices().map((c) => c.value));
    if (!allowed.has(type)) {
      return {
        draft,
        ready: false,
        cancelled: false,
        assistantMessage: 'Pick a chart type: Bar, Line, Pie, Donut, Area, or Table.',
      };
    }
    chart.chartType = type;
    chart.type = type;
    return {
      draft: {
        ...draft,
        step: 'confirm',
        params: {
          ...draft.params,
          chartConfig: chart,
          name: draft.params.name || chart.title,
        },
      },
      ready: false,
      cancelled: false,
      assistantMessage: summarizeReportDraft(
        { ...draft.params, chartConfig: chart },
        draft.formName || 'form',
        fields,
      ),
    };
  }

  if (draft.step === 'dimension') {
    const field = fields.find((f) =>
      f.id === value
      || f.label.toLowerCase() === lower
      || f.label.toLowerCase().includes(lower),
    );
    if (!field) {
      return {
        draft,
        ready: false,
        cancelled: false,
        assistantMessage: 'Pick a form field for the X-axis / grouping.',
      };
    }
    const dims = [field.id, ...((chart.dimensions || []).slice(1))].filter(Boolean);
    chart.xAxis = field.id;
    chart.dimensions = dims;
    return {
      draft: {
        ...draft,
        step: 'confirm',
        params: { ...draft.params, chartConfig: chart },
      },
      ready: false,
      cancelled: false,
      assistantMessage: summarizeReportDraft(
        { ...draft.params, chartConfig: chart },
        draft.formName || 'form',
        fields,
      ),
    };
  }

  if (draft.step === 'metric') {
    if (/^count\b/i.test(lower) || value === '__count__') {
      chart.groupingMode = true;
      chart.aggregationType = 'count';
      chart.aggregationEnabled = true;
      chart.metrics = [];
      chart.yAxis = undefined;
      chart.metricAggregations = [{ field: 'count', aggregation: 'count' }];
    } else {
      const field = fields.find((f) =>
        f.id === value
        || f.label.toLowerCase() === lower
        || f.label.toLowerCase().includes(lower),
      );
      if (!field) {
        return {
          draft,
          ready: false,
          cancelled: false,
          assistantMessage: 'Pick a form field for the Y-axis / metric, or reply **count**.',
        };
      }
      chart.groupingMode = false;
      chart.yAxis = field.id;
      chart.metrics = [field.id];
      chart.aggregationEnabled = true;
      chart.metricAggregations = [{
        field: field.id,
        aggregation: chart.aggregationType || 'count',
      }];
    }
    return {
      draft: {
        ...draft,
        step: 'confirm',
        params: { ...draft.params, chartConfig: chart },
      },
      ready: false,
      cancelled: false,
      assistantMessage: summarizeReportDraft(
        { ...draft.params, chartConfig: chart },
        draft.formName || 'form',
        fields,
      ),
    };
  }

  return { draft, ready: false, cancelled: false };
}
