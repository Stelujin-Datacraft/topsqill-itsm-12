// Performance Analysis Edge Function v3 - Form Data Integration
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { project_id, action } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    if (action === "analyze") {
      // Fetch data sources for form-based analysis
      const { data: dataSources } = await supabase
        .from("performance_data_sources")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);

      // Fetch snapshots for trend analysis
      const { data: snapshots, error: snapError } = await supabase
        .from("performance_snapshots")
        .select("*")
        .eq("project_id", project_id)
        .order("snapshot_date", { ascending: true })
        .limit(30);

      if (snapError) throw snapError;

      // Fetch active thresholds
      const { data: thresholds } = await supabase
        .from("performance_thresholds")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);

      // Collect form submission data from data sources
      let formDataSections: string[] = [];

      if (dataSources && dataSources.length > 0) {
        for (const ds of dataSources) {
          const fieldMappings = Array.isArray(ds.field_mappings) ? ds.field_mappings : [];
          const linkedForms = Array.isArray(ds.linked_forms) ? ds.linked_forms : [];
          const limit = ds.data_limit || 500;

          // Fetch submissions from the source form
          const { data: submissions, error: subError } = await supabase
            .from("form_submissions")
            .select("id, submission_data, created_at, updated_at, submission_ref_id")
            .eq("form_id", ds.source_form_id)
            .order("created_at", { ascending: false })
            .limit(limit);

          if (subError) {
            console.error("Error fetching submissions for form", ds.source_form_id, subError);
            continue;
          }

          if (!submissions || submissions.length === 0) continue;

          // Extract mapped field values
          const mappedData = submissions.map((sub: any) => {
            const row: Record<string, any> = {
              _ref_id: sub.submission_ref_id,
              _created_at: sub.created_at,
            };
            for (const mapping of fieldMappings) {
              const val = sub.submission_data?.[mapping.formFieldId];
              row[mapping.label || mapping.formFieldLabel] = val;
            }
            return row;
          });

          // Compute aggregations
          const aggregations: Record<string, any> = {};
          for (const mapping of fieldMappings) {
            if (mapping.metricRole !== 'numeric_metric') continue;
            const values = mappedData
              .map((r: any) => parseFloat(r[mapping.label || mapping.formFieldLabel]))
              .filter((v: number) => !isNaN(v));

            if (values.length === 0) continue;
            const label = mapping.label || mapping.formFieldLabel;
            aggregations[label] = {
              count: values.length,
              sum: values.reduce((a: number, b: number) => a + b, 0),
              avg: values.reduce((a: number, b: number) => a + b, 0) / values.length,
              min: Math.min(...values),
              max: Math.max(...values),
              latest: values[0],
              trend: values.length >= 3 ? (values[0] > values[values.length - 1] ? 'increasing' : 'decreasing') : 'stable',
            };
          }

          // Fetch linked form data
          let linkedDataSections: string[] = [];
          for (const lf of linkedForms) {
            const { data: linkedSubs } = await supabase
              .from("form_submissions")
              .select("id, submission_data, created_at, submission_ref_id")
              .eq("form_id", lf.formId)
              .order("created_at", { ascending: false })
              .limit(Math.min(limit, 200));

            if (linkedSubs && linkedSubs.length > 0) {
              linkedDataSections.push(`\nLinked Form: ${lf.formName} (via ${lf.crossRefFieldLabel})
Records: ${linkedSubs.length}
Sample data (first 5): ${JSON.stringify(linkedSubs.slice(0, 5).map((s: any) => s.submission_data), null, 2)}`);
            }
          }

          formDataSections.push(`
FORM DATA SOURCE: "${ds.source_form_name}"
Total Records: ${submissions.length} (limit: ${limit})
Field Mappings: ${fieldMappings.map((m: any) => `${m.label || m.formFieldLabel} [${m.metricRole}/${m.aggregation}]`).join(', ')}

AGGREGATED METRICS:
${JSON.stringify(aggregations, null, 2)}

RECENT RECORDS (last 10):
${JSON.stringify(mappedData.slice(0, 10), null, 2)}
${linkedDataSections.join('\n')}`);
        }
      }

      const hasSnapshots = snapshots && snapshots.length >= 2;
      const hasFormData = formDataSections.length > 0;

      if (!hasSnapshots && !hasFormData) {
        return new Response(JSON.stringify({
          summary: "Not enough data for analysis. Either add performance snapshots or configure form data sources.",
          anomalies: [],
          predictions: [],
          risk_score: 0,
          health_status: "green",
          recommendations: [{
            priority: "high",
            title: "Configure Data Sources",
            description: "Go to the Data Sources tab to connect your forms, or add manual snapshots for analysis.",
          }],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let snapshotSection = "";
      if (hasSnapshots) {
        snapshotSection = `\nPROJECT PERFORMANCE SNAPSHOTS (${snapshots!.length} data points):
${JSON.stringify(snapshots!.map(s => ({
  date: s.snapshot_date,
  planned_budget: s.planned_budget,
  actual_budget: s.actual_budget,
  budget_variance: s.budget_variance,
  schedule_variance_days: s.schedule_variance_days,
  resource_utilization_pct: s.resource_utilization_pct,
  total_tasks: s.total_tasks,
  completed_tasks: s.completed_tasks,
  blocked_tasks: s.blocked_tasks,
  completion_pct: s.completion_pct,
  overdue_milestones: s.overdue_milestones,
  risk_score: s.risk_score,
  health_status: s.health_status,
})), null, 2)}`;
      }

      const prompt = `You are a project performance analyst. Analyze ALL available data and provide insights.

${snapshotSection}

${hasFormData ? 'FORM-BASED DATA SOURCES:\n' + formDataSections.join('\n---\n') : ''}

CONFIGURED ALERT THRESHOLDS:
${JSON.stringify(thresholds || [], null, 2)}

Analyze this data using these techniques:
1. ANOMALY DETECTION: Identify statistical outliers across all metrics (both snapshots and form data). Flag values that deviate significantly from trends or expected ranges.
2. TREND ANALYSIS: Identify patterns in form submission data - growing/declining metrics, seasonal patterns, workflow bottlenecks.
3. PREDICTIVE INSIGHTS: Based on form data trends, predict future values for key metrics.
4. THRESHOLD VIOLATIONS: Check configured thresholds against both snapshot metrics AND form field aggregated values.
5. RISK ASSESSMENT: Calculate overall risk score (0-100) based on all available data.
6. CROSS-REFERENCE INSIGHTS: If linked form data is available, identify correlations between related datasets.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert project performance analyst. Always respond with valid JSON." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "performance_analysis",
              description: "Return structured performance analysis results",
              parameters: {
                type: "object",
                properties: {
                  risk_score: { type: "number", description: "Overall risk score 0-100" },
                  health_status: { type: "string", enum: ["green", "yellow", "orange", "red"] },
                  summary: { type: "string", description: "Brief 2-3 sentence executive summary covering both snapshot and form data insights" },
                  anomalies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        metric: { type: "string" },
                        description: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        value: { type: "number" },
                        expected_value: { type: "number" },
                        source: { type: "string", description: "snapshot or form_name" },
                      },
                      required: ["metric", "description", "severity"],
                    },
                  },
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["budget_forecast", "completion_date", "resource_need", "risk_trend", "milestone_delay", "form_metric_forecast"] },
                        description: { type: "string" },
                        predicted_value: { type: "number" },
                        confidence: { type: "number" },
                        timeframe: { type: "string" },
                      },
                      required: ["type", "description", "confidence"],
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        impact: { type: "string" },
                      },
                      required: ["priority", "title", "description"],
                    },
                  },
                  threshold_violations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        metric_name: { type: "string" },
                        threshold_value: { type: "number" },
                        actual_value: { type: "number" },
                        severity: { type: "string" },
                        source: { type: "string" },
                      },
                      required: ["metric_name", "actual_value"],
                    },
                  },
                },
                required: ["risk_score", "health_status", "summary", "anomalies", "predictions", "recommendations"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "performance_analysis" } },
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errText);
        throw new Error("AI analysis failed");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let analysis;

      if (toolCall?.function?.arguments) {
        analysis = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } else {
        throw new Error("AI did not return structured analysis");
      }

      // Store anomalies as alerts
      if (analysis.anomalies?.length > 0) {
        const orgId = snapshots?.[0]?.organization_id || dataSources?.[0]?.organization_id;
        const snapshotId = snapshots?.[snapshots.length - 1]?.id;
        const alertInserts = analysis.anomalies.map((a: any) => ({
          project_id,
          organization_id: orgId,
          snapshot_id: snapshotId || null,
          alert_type: "anomaly",
          severity: a.severity,
          title: `Anomaly: ${a.metric}${a.source ? ` (${a.source})` : ''}`,
          description: a.description,
          ai_generated: true,
          ai_confidence: a.expected_value ? 85 : 70,
          ai_reasoning: a.description,
          ai_recommendation: analysis.recommendations?.[0]?.description || null,
          metric_name: a.metric,
          threshold_value: a.expected_value,
          actual_value: a.value,
          status: "active",
        }));

        await supabase.from("performance_alerts").insert(alertInserts);
      }

      // Store predictions
      if (analysis.predictions?.length > 0) {
        const orgId = snapshots?.[0]?.organization_id || dataSources?.[0]?.organization_id;
        const predInserts = analysis.predictions.map((p: any) => ({
          project_id,
          organization_id: orgId,
          prediction_type: p.type,
          predicted_value: p.predicted_value || 0,
          confidence_level: p.confidence,
          reasoning: p.description,
          model_used: "gemini-3-flash-preview",
          input_data_points: (snapshots?.length || 0) + formDataSections.length,
        }));

        await supabase.from("performance_predictions").insert(predInserts);
      }

      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-performance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
