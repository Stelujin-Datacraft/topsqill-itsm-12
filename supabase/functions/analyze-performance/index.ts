// Performance Analysis Edge Function v4 - Performance Project Scoped + Improved AI
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractJsonFromResponse(response: string): unknown {
  let cleaned = response.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonStart = cleaned.search(/[\{\[]/);
  const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found in response");
  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

async function fetchFormData(supabase: any, dataSources: any[]) {
  const formDataSections: string[] = [];
  
  for (const ds of dataSources) {
    const fieldMappings = Array.isArray(ds.field_mappings) ? ds.field_mappings : [];
    const linkedForms = Array.isArray(ds.linked_forms) ? ds.linked_forms : [];
    const limit = ds.data_limit || 500;

    const { data: submissions, error: subError } = await supabase
      .from("form_submissions")
      .select("id, submission_data, submitted_at, submission_ref_id")
      .eq("form_id", ds.source_form_id)
      .order("submitted_at", { ascending: false })
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
        _submitted_at: sub.submitted_at,
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
        .select("id, submission_data, submitted_at, submission_ref_id")
        .eq("form_id", lf.formId)
        .order("submitted_at", { ascending: false })
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

  return formDataSections;
}

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

    const { project_id, action, performance_project_id } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    if (action === "analyze") {
      // Fetch data sources - scoped by performance_project_id if provided
      let dsQuery = supabase
        .from("performance_data_sources")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);
      
      if (performance_project_id) {
        dsQuery = dsQuery.eq("performance_project_id", performance_project_id);
      }
      
      const { data: dataSources } = await dsQuery;

      // Fetch thresholds - scoped
      let thQuery = supabase
        .from("performance_thresholds")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);
      
      if (performance_project_id) {
        thQuery = thQuery.eq("performance_project_id", performance_project_id);
      }
      
      const { data: thresholds } = await thQuery;

      // Collect form data
      const formDataSections = dataSources && dataSources.length > 0
        ? await fetchFormData(supabase, dataSources)
        : [];

      if (formDataSections.length === 0) {
        return new Response(JSON.stringify({
          summary: "Not enough data for analysis. Configure your data source field mappings and ensure the form has submissions.",
          anomalies: [],
          predictions: [],
          risk_score: 0,
          health_status: "green",
          recommendations: [{
            priority: "high",
            title: "Configure Data Source",
            description: "Go to the Data Sources tab, map your form fields (especially numeric ones), then run analysis again.",
          }],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const prompt = `You are a project performance analyst. Analyze ALL the form submission data below thoroughly and provide accurate, data-driven insights.

IMPORTANT RULES:
- Base ALL analysis on the ACTUAL data provided below. Do NOT make up values.
- For anomaly detection, compare individual values against the computed averages and standard deviations.
- For predictions, use the actual trends visible in the data.
- risk_score must be 0-100 based on data health.
- confidence values must be between 0 and 1 (e.g., 0.85 = 85%).
- Be specific with numbers - reference actual values from the data.

FORM-BASED DATA SOURCES:
${formDataSections.join('\n---\n')}

CONFIGURED ALERT THRESHOLDS:
${JSON.stringify(thresholds || [], null, 2)}

Analyze using:
1. ANOMALY DETECTION: Identify values that deviate >2 standard deviations from mean. Reference actual values.
2. TREND ANALYSIS: Identify patterns from recent records ordering. Use actual metric trends (increasing/decreasing/stable).
3. PREDICTIVE INSIGHTS: Based on actual trends, forecast next likely values with confidence levels.
4. THRESHOLD VIOLATIONS: Compare each threshold against the AGGREGATED METRICS values.
5. RISK ASSESSMENT: Score 0-100 based on anomaly count, threshold violations, and trend direction.
6. CROSS-REFERENCE: If linked data exists, find correlations.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-preview",
          messages: [
            { role: "system", content: "You are an expert project performance analyst. Always respond with valid JSON. Be precise and reference actual data values." },
            { role: "user", content: prompt },
          ],
          max_tokens: 8192,
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
                  summary: { type: "string", description: "2-3 sentence executive summary referencing actual data values" },
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
                        source: { type: "string" },
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
                        confidence: { type: "number", description: "Value between 0 and 1" },
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
        const rawArgs = typeof toolCall.function.arguments === "string"
          ? toolCall.function.arguments
          : JSON.stringify(toolCall.function.arguments);
        try {
          analysis = JSON.parse(rawArgs);
        } catch {
          // Fallback: try extracting JSON robustly
          analysis = extractJsonFromResponse(rawArgs);
        }
      } else {
        // Try to extract from content if no tool call
        const content = aiData.choices?.[0]?.message?.content;
        if (content) {
          analysis = extractJsonFromResponse(content);
        } else {
          throw new Error("AI did not return structured analysis");
        }
      }

      // Validate and normalize
      analysis.risk_score = Math.max(0, Math.min(100, Number(analysis.risk_score) || 0));
      if (!['green', 'yellow', 'orange', 'red'].includes(analysis.health_status)) {
        analysis.health_status = analysis.risk_score > 70 ? 'red' : analysis.risk_score > 40 ? 'orange' : analysis.risk_score > 20 ? 'yellow' : 'green';
      }
      analysis.anomalies = Array.isArray(analysis.anomalies) ? analysis.anomalies : [];
      analysis.predictions = Array.isArray(analysis.predictions) ? analysis.predictions : [];
      analysis.recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];

      // Normalize confidence values (ensure 0-1 range)
      analysis.predictions = analysis.predictions.map((p: any) => ({
        ...p,
        confidence: p.confidence > 1 ? p.confidence / 100 : p.confidence,
      }));

      // Store anomalies as alerts
      if (analysis.anomalies?.length > 0) {
        const orgId = dataSources?.[0]?.organization_id;
        const alertInserts = analysis.anomalies.map((a: any) => ({
          project_id,
          organization_id: orgId,
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
          ...(performance_project_id ? { performance_project_id } : {}),
        }));

        await supabase.from("performance_alerts").insert(alertInserts);
      }

      // Store predictions
      if (analysis.predictions?.length > 0) {
        const orgId = dataSources?.[0]?.organization_id;
        const predInserts = analysis.predictions.map((p: any) => ({
          project_id,
          organization_id: orgId,
          prediction_type: p.type,
          predicted_value: p.predicted_value || 0,
          confidence_level: p.confidence,
          reasoning: p.description,
          model_used: "gemini-2.5-flash-preview",
          input_data_points: formDataSections.length,
          ...(performance_project_id ? { performance_project_id } : {}),
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
