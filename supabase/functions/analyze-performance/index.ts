// Performance Analysis Edge Function v5 - Single Record Analysis with Enterprise Project Portfolio Tracker Awareness
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

// Enterprise Project Portfolio Tracker field knowledge - always available for context
const ENTERPRISE_PORTFOLIO_TRACKER_CONTEXT = `
You have deep knowledge of the "Enterprise Project Portfolio Tracker" form structure. When analyzing data from this form, apply the following domain expertise:

PAGE 1 – PROJECT INFORMATION:
- Project Name: The unique project title
- Project Number: Unique identifier  
- Project Manager: Person responsible for delivery
- Assigned To: Team or individual assigned
- Status: Project lifecycle status (Not Started, Planning, In Progress, On Hold, Completed, Cancelled)
- Percentage Complete: 0-100% slider indicating overall progress
- Description: Project scope description

PAGE 2 – PROJECT SCHEDULE:
- Schedule Name, Approved/Planned/Actual Start/End Dates
- Planned Duration vs Actual Duration (in days) — compare for schedule variance
- Planned Effort vs Actual Effort (in hours) — compare for effort variance
- Schedule Performance Index (SPI) = Planned Duration / Actual Duration (>1 = ahead, <1 = behind)

PAGE 3 – PORTFOLIO & CLASSIFICATION:
- Portfolio Name, Priority (Critical/High/Medium/Low), Program, Phase
- Investment Class (Strategic/Compliance/Operational/Innovation/Maintenance)
- Department, Business Units, Execution Type (Agile/Waterfall/Hybrid), Expense Type

PAGE 4 – FINANCIAL DETAILS:
- Total Planned Cost vs Actual Cost — Cost Variance = Planned - Actual
- Cost Performance Index (CPI) = Planned Cost / Actual Cost (>1 = under budget)
- Planned Benefits, Planned Capital, Planned Return, Planned Operating
- Planned ROI (%) — compare against industry benchmarks (typically 10-30%)
- Budget Cost, Discount Rate, Net Present Value (NPV), Estimate At Completion (EAC)
- Internal Rate of Return (IRR), Estimate To Completion (ETC)
- Financial Health: NPV should be positive, IRR > Discount Rate

PAGE 5 – STRATEGIC ALIGNMENT:
- Strategic Priority, Primary Goal, Strategies, Business Goal
- Risk of Performing, Out of Scope, Assumptions

PAGE 6 – SCORING METRICS:
- Risk Score (0-100): Higher = more risky
- Size Score (0-100): Project complexity/size
- Value Score (0-100): Business value delivered
- Total Score: Weighted composite
- Scoring Health: Value Score should exceed Risk Score for healthy projects

PAGE 7 – NOTES & ACTIVITIES:
- Watch List items, Work Notes, Activities log

PAGE 8 – CONFIGURATION SETTINGS:
- Time Card Reporting, Auto Effort Update, Calculations mode, Score Recalculation, Date Format

ANALYSIS RULES FOR THIS FORM:
1. Schedule Variance: If Actual Duration > Planned Duration by >10%, flag as schedule overrun
2. Cost Variance: If Actual Cost > Planned Cost by >10%, flag as budget overrun
3. Effort Variance: If Actual Effort > Planned Effort by >15%, flag as resource concern
4. ROI Assessment: If Planned ROI < 10%, flag as low-return project
5. Financial Health: If NPV < 0 or IRR < Discount Rate, flag financial concern
6. Risk-Value Balance: If Risk Score > Value Score, the project may not be worth pursuing
7. Progress Check: Compare Percentage Complete against schedule timeline position
8. EAC vs Budget: If Estimate At Completion > Budget Cost, flag potential overrun
`;

async function fetchAllRecordsData(supabase: any, dataSources: any[]) {
  if (!dataSources || dataSources.length === 0) return null;
  const ds = dataSources[0];
  const fieldMappings = Array.isArray(ds.field_mappings) ? ds.field_mappings : [];

  const { data: allSubs } = await supabase
    .from("form_submissions")
    .select("id, submission_data, submitted_at, submission_ref_id")
    .eq("form_id", ds.source_form_id)
    .order("submitted_at", { ascending: false })
    .limit(500);

  if (!allSubs || allSubs.length === 0) return null;

  // Aggregate numeric fields
  const aggregated: Record<string, any> = {};
  for (const mapping of fieldMappings) {
    if (mapping.metricRole !== 'numeric_metric') continue;
    const label = mapping.label || mapping.formFieldLabel;
    const values = allSubs
      .map((s: any) => parseFloat(s.submission_data?.[mapping.formFieldId]))
      .filter((v: number) => !isNaN(v));
    if (values.length === 0) continue;
    const sum = values.reduce((a: number, b: number) => a + b, 0);
    const avg = sum / values.length;
    aggregated[label] = { avg: Math.round(avg * 100) / 100, sum: Math.round(sum * 100) / 100, min: Math.min(...values), max: Math.max(...values), count: values.length };
  }

  // Collect all record data summaries
  const recordSummaries = allSubs.slice(0, 20).map((s: any) => {
    const mapped: Record<string, any> = {};
    for (const m of fieldMappings) {
      const val = s.submission_data?.[m.formFieldId];
      if (val != null) mapped[m.label || m.formFieldLabel] = val;
    }
    return { ref: s.submission_ref_id, data: mapped };
  });

  return {
    formName: ds.source_form_name,
    totalRecords: allSubs.length,
    aggregatedMetrics: aggregated,
    recordSummaries,
  };
}

async function fetchSingleRecordData(supabase: any, dataSources: any[], submissionId: string) {
  if (!dataSources || dataSources.length === 0) return null;

  const ds = dataSources[0];
  const fieldMappings = Array.isArray(ds.field_mappings) ? ds.field_mappings : [];

  const { data: submission, error } = await supabase
    .from("form_submissions")
    .select("id, submission_data, submitted_at, submission_ref_id")
    .eq("id", submissionId)
    .eq("form_id", ds.source_form_id)
    .single();

  if (error || !submission) return null;

  const allData = submission.submission_data || {};
  const mappedData: Record<string, any> = {};
  for (const mapping of fieldMappings) {
    const val = allData[mapping.formFieldId];
    mappedData[mapping.label || mapping.formFieldLabel] = {
      value: val,
      role: mapping.metricRole,
      aggregation: mapping.aggregation,
      fieldType: mapping.formFieldType,
    };
  }

  const { data: allSubs } = await supabase
    .from("form_submissions")
    .select("submission_data")
    .eq("form_id", ds.source_form_id)
    .order("submitted_at", { ascending: false })
    .limit(500);

  const portfolioStats: Record<string, any> = {};
  if (allSubs && allSubs.length > 0) {
    for (const mapping of fieldMappings) {
      if (mapping.metricRole !== 'numeric_metric') continue;
      const values = allSubs
        .map((s: any) => parseFloat(s.submission_data?.[mapping.formFieldId]))
        .filter((v: number) => !isNaN(v));
      if (values.length === 0) continue;
      const label = mapping.label || mapping.formFieldLabel;
      const sum = values.reduce((a: number, b: number) => a + b, 0);
      const avg = sum / values.length;
      const variance = values.reduce((a: number, b: number) => a + Math.pow(b - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      portfolioStats[label] = { count: values.length, avg: Math.round(avg * 100) / 100, min: Math.min(...values), max: Math.max(...values), stdDev: Math.round(stdDev * 100) / 100, sum: Math.round(sum * 100) / 100 };
    }
  }

  return {
    formName: ds.source_form_name,
    submissionRefId: submission.submission_ref_id,
    submittedAt: submission.submitted_at,
    recordData: allData,
    mappedFields: mappedData,
    portfolioStats,
    totalRecords: allSubs?.length || 0,
  };
}

async function sendAlertNotifications(supabase: any, projectId: string, perfProjectId: string | null, alerts: any[], userId: string) {
  try {
    // In-app notifications for all org members
    const { data: orgMembers } = await supabase
      .from('profiles')
      .select('id, email, organization_id')
      .eq('id', userId)
      .single();

    if (!orgMembers) return;

    // Get project members
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId);

    const memberIds = members?.map((m: any) => m.user_id) || [userId];
    const uniqueIds = [...new Set(memberIds)];

    // Create in-app notifications
    const criticalAlerts = alerts.filter((a: any) => a.severity === 'high' || a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      const notifInserts = uniqueIds.map((uid: string) => ({
        user_id: uid,
        type: 'workflow_notification',
        title: `⚠️ Performance Alert: ${criticalAlerts.length} issue${criticalAlerts.length > 1 ? 's' : ''} detected`,
        message: criticalAlerts.map((a: any) => `${a.severity.toUpperCase()}: ${a.title}`).join(' | '),
        data: { source: 'performance_monitoring', project_id: projectId, performance_project_id: perfProjectId, alert_count: criticalAlerts.length },
        read: false,
      }));
      await supabase.from('notifications').insert(notifInserts);
    }

    // Send email via SMTP for critical/high alerts
    if (criticalAlerts.length > 0 && orgMembers.organization_id) {
      const { data: smtpConfigs } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', orgMembers.organization_id)
        .eq('is_active', true)
        .limit(1);

      if (smtpConfigs && smtpConfigs.length > 0) {
        // Get emails of members
        const { data: memberProfiles } = await supabase
          .from('profiles')
          .select('email')
          .in('id', uniqueIds);

        const emails = memberProfiles?.map((p: any) => p.email).filter(Boolean) || [];
        if (emails.length > 0) {
          const smtpConfig = smtpConfigs[0];
          const alertSummary = criticalAlerts.map((a: any) => `• ${a.severity.toUpperCase()}: ${a.title} — ${a.description}`).join('\n');
          const htmlAlerts = criticalAlerts.map((a: any) =>
            `<tr><td style="padding:8px;border:1px solid #e5e7eb;"><span style="color:${a.severity === 'critical' ? '#ef4444' : '#f59e0b'};font-weight:bold;">${a.severity.toUpperCase()}</span></td><td style="padding:8px;border:1px solid #e5e7eb;">${a.title}</td><td style="padding:8px;border:1px solid #e5e7eb;">${a.description || ''}</td></tr>`
          ).join('');

          try {
            const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
            const client = new SMTPClient({
              connection: {
                hostname: smtpConfig.host,
                port: smtpConfig.port,
                tls: smtpConfig.use_tls,
                auth: { username: smtpConfig.username, password: smtpConfig.password },
              },
            });

            for (const email of emails) {
              try {
                await client.send({
                  from: smtpConfig.from_name ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` : smtpConfig.from_email,
                  to: email,
                  subject: `🚨 Performance Alert: ${criticalAlerts.length} issue${criticalAlerts.length > 1 ? 's' : ''} detected`,
                  content: `Performance Monitoring Alert\n\n${alertSummary}\n\nPlease review the Performance Dashboard for details.`,
                  html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:20px;"><h2 style="color:#ef4444;">🚨 Performance Alert</h2><p>${criticalAlerts.length} issue${criticalAlerts.length > 1 ? 's' : ''} detected in your project performance monitoring.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr style="background:#f3f4f6;"><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Severity</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Alert</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Details</th></tr></thead><tbody>${htmlAlerts}</tbody></table><p style="color:#6b7280;font-size:12px;">This is an automated alert from your Performance Monitoring system.</p></body></html>`,
                });
              } catch (emailErr) {
                console.error('Email send failed for', email, emailErr);
              }
            }
            await client.close();
          } catch (smtpErr) {
            console.error('SMTP connection failed (non-blocking):', smtpErr);
          }
        }
      }
    }
  } catch (err) {
    console.error('Alert notification error (non-blocking):', err);
  }
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

    const { project_id, action, performance_project_id, submission_id } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    if (action === "analyze") {
      if (!submission_id) throw new Error("submission_id is required — select a record to analyze");

      // Fetch data sources (limited to 1 per performance project)
      let dsQuery = supabase
        .from("performance_data_sources")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);
      
      if (performance_project_id) {
        dsQuery = dsQuery.eq("performance_project_id", performance_project_id);
      }
      
      const { data: dataSources } = await dsQuery;

      // Fetch thresholds
      let thQuery = supabase
        .from("performance_thresholds")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);
      
      if (performance_project_id) {
        thQuery = thQuery.eq("performance_project_id", performance_project_id);
      }
      
      const { data: thresholds } = await thQuery;

      // Fetch single record data with portfolio context
      const recordAnalysis = await fetchSingleRecordData(supabase, dataSources || [], submission_id);

      if (!recordAnalysis) {
        return new Response(JSON.stringify({
          summary: "Could not find the selected record. Ensure the data source is configured and the record exists.",
          anomalies: [],
          predictions: [],
          risk_score: 0,
          health_status: "green",
          recommendations: [{
            priority: "high",
            title: "Configure Data Source",
            description: "Go to the Data Sources tab, map your form fields, then select a record to analyze.",
          }],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const prompt = `You are an expert project performance analyst conducting a DETAILED SINGLE RECORD ANALYSIS.

${ENTERPRISE_PORTFOLIO_TRACKER_CONTEXT}

SELECTED RECORD FOR ANALYSIS:
Form: "${recordAnalysis.formName}"
Record Reference: ${recordAnalysis.submissionRefId}
Submitted At: ${recordAnalysis.submittedAt}

FULL RECORD DATA (all fields):
${JSON.stringify(recordAnalysis.recordData, null, 2)}

MAPPED FIELD DETAILS (with roles and types):
${JSON.stringify(recordAnalysis.mappedFields, null, 2)}

PORTFOLIO CONTEXT (statistics from ${recordAnalysis.totalRecords} total records for comparison):
${JSON.stringify(recordAnalysis.portfolioStats, null, 2)}

CONFIGURED ALERT THRESHOLDS:
${JSON.stringify(thresholds || [], null, 2)}

ANALYSIS INSTRUCTIONS:
1. ANOMALY DETECTION: Compare this record's values against the portfolio averages. Flag any value that deviates >2 standard deviations. Also apply the Enterprise Portfolio Tracker rules (schedule variance, cost variance, ROI checks, etc.).
2. FINANCIAL HEALTH: Analyze cost performance (Actual vs Planned), ROI, NPV, IRR vs Discount Rate. Provide specific dollar amounts.
3. SCHEDULE HEALTH: Compare Actual Duration vs Planned Duration, Actual Effort vs Planned Effort. Calculate SPI and variance %.
4. RISK ASSESSMENT: Use the Risk Score, Size Score, Value Score to evaluate risk-value balance. Score 0-100 overall.
5. PREDICTIONS: Based on current trajectory, predict likely completion date, final cost, and resource needs.
6. THRESHOLD VIOLATIONS: Check configured thresholds against this record's values.
7. RECOMMENDATIONS: Provide actionable, specific recommendations referencing actual values from this record.

Be SPECIFIC — reference actual field values, dollar amounts, dates, and percentages from the record data.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert project performance analyst specializing in enterprise project portfolio management. You have deep knowledge of project financial metrics (NPV, IRR, ROI, EAC, ETC), schedule performance (SPI, duration/effort variance), and risk scoring. Always respond with precise, data-driven analysis referencing actual values." },
            { role: "user", content: prompt },
          ],
          max_tokens: 8192,
          tools: [{
            type: "function",
            function: {
              name: "performance_analysis",
              description: "Return structured single-record performance analysis results",
              parameters: {
                type: "object",
                properties: {
                  risk_score: { type: "number", description: "Overall risk score 0-100 for this specific record" },
                  health_status: { type: "string", enum: ["green", "yellow", "orange", "red"] },
                  summary: { type: "string", description: "3-5 sentence executive summary of this record's health, referencing actual values (costs, dates, scores)" },
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
          analysis = extractJsonFromResponse(rawArgs);
        }
      } else {
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

      const VALID_PREDICTION_TYPES = ["budget_forecast", "completion_date", "resource_need", "risk_trend", "milestone_delay"];
      const PREDICTION_TYPE_MAP: Record<string, string> = {
        cost_overrun: "budget_forecast",
        schedule_slip: "milestone_delay",
        general: "risk_trend",
      };
      analysis.predictions = analysis.predictions.map((p: any) => ({
        ...p,
        type: VALID_PREDICTION_TYPES.includes(p.type) ? p.type : (PREDICTION_TYPE_MAP[p.type] || "risk_trend"),
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
          title: `Anomaly: ${a.metric} (Record: ${recordAnalysis.submissionRefId})`,
          description: a.description,
          ai_generated: true,
          ai_confidence: a.expected_value ? 85 : 70,
          ai_reasoning: a.description,
          ai_recommendation: analysis.recommendations?.[0]?.description || null,
          metric_name: a.metric,
          threshold_value: a.expected_value ?? null,
          actual_value: a.value ?? null,
          status: "active",
          ...(performance_project_id ? { performance_project_id } : {}),
        }));

        const { error: alertError } = await supabase.from("performance_alerts").insert(alertInserts);
        if (alertError) console.error("Error saving alerts:", alertError);
      }

      // Store predictions
      if (analysis.predictions?.length > 0) {
        const orgId = dataSources?.[0]?.organization_id;
        const predInserts = analysis.predictions.map((p: any) => ({
          project_id,
          organization_id: orgId,
          prediction_type: p.type || 'general',
          predicted_value: p.predicted_value ?? null,
          confidence_level: p.confidence ?? null,
          reasoning: `[Record: ${recordAnalysis.submissionRefId}] ${p.description}`,
          model_used: "gemini-3-flash-preview",
          input_data_points: 1,
          ...(performance_project_id ? { performance_project_id } : {}),
        }));

        const { error: predError } = await supabase.from("performance_predictions").insert(predInserts);
        if (predError) console.error("Error saving predictions:", predError);
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
