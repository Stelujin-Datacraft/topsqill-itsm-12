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
      // Fetch last 30 snapshots for trend analysis
      const { data: snapshots, error: snapError } = await supabase
        .from("performance_snapshots")
        .select("*")
        .eq("project_id", project_id)
        .order("snapshot_date", { ascending: true })
        .limit(30);

      if (snapError) throw snapError;

      if (!snapshots || snapshots.length < 2) {
        return new Response(JSON.stringify({
          insights: "Not enough data points for analysis. Add at least 2 performance snapshots to enable AI analysis.",
          anomalies: [],
          predictions: [],
          risk_score: 0,
          recommendations: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch active thresholds
      const { data: thresholds } = await supabase
        .from("performance_thresholds")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);

      const prompt = `You are a project performance analyst. Analyze this project data and provide insights.

PROJECT PERFORMANCE DATA (chronological snapshots):
${JSON.stringify(snapshots.map(s => ({
  date: s.snapshot_date,
  planned_budget: s.planned_budget,
  actual_budget: s.actual_budget,
  budget_variance: s.budget_variance,
  schedule_variance_days: s.schedule_variance_days,
  planned_resources: s.planned_resources,
  actual_resources: s.actual_resources,
  resource_utilization_pct: s.resource_utilization_pct,
  total_tasks: s.total_tasks,
  completed_tasks: s.completed_tasks,
  blocked_tasks: s.blocked_tasks,
  completion_pct: s.completion_pct,
  total_milestones: s.total_milestones,
  completed_milestones: s.completed_milestones,
  overdue_milestones: s.overdue_milestones,
  risk_score: s.risk_score,
  health_status: s.health_status,
})), null, 2)}

CONFIGURED ALERT THRESHOLDS:
${JSON.stringify(thresholds || [], null, 2)}

Analyze this data using these techniques:
1. ANOMALY DETECTION: Identify statistical outliers in budget, schedule, and resource metrics. Flag any values that deviate significantly from the trend.
2. TREND ANALYSIS: Identify patterns - is the project trending toward overrun, delay, or resource shortage?
3. PREDICTIVE INSIGHTS: Based on current trends, predict likely budget at completion, projected end date variance, and resource needs.
4. THRESHOLD VIOLATIONS: Check if any configured thresholds are currently being violated.
5. RISK ASSESSMENT: Calculate an overall risk score (0-100) based on all factors.`;

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
                  summary: { type: "string", description: "Brief 2-3 sentence executive summary" },
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
                      },
                      required: ["metric", "description", "severity"],
                    },
                  },
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["budget_forecast", "completion_date", "resource_need", "risk_trend", "milestone_delay"] },
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
        const latestSnapshot = snapshots[snapshots.length - 1];
        const alertInserts = analysis.anomalies.map((a: any) => ({
          project_id,
          organization_id: latestSnapshot.organization_id,
          snapshot_id: latestSnapshot.id,
          alert_type: "anomaly",
          severity: a.severity,
          title: `Anomaly: ${a.metric}`,
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
        const predInserts = analysis.predictions.map((p: any) => ({
          project_id,
          organization_id: snapshots[0].organization_id,
          prediction_type: p.type,
          predicted_value: p.predicted_value || 0,
          confidence_level: p.confidence,
          reasoning: p.description,
          model_used: "gemini-3-flash-preview",
          input_data_points: snapshots.length,
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
