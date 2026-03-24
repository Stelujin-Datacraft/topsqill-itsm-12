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

// Role-based alert routing configuration
const ALERT_ROLE_ROUTING: Record<string, string[]> = {
  'task_delayed': ['Engineer', 'Project Manager'],
  'budget_overrun': ['Project Manager', 'Finance'],
  'schedule_variance_critical': ['Project Manager'],
  'predicted_delay': ['Senior Management'],
  'high_risk': ['Risk Compliance'],
  // Fallback categories derived from alert content
  'cost': ['Project Manager', 'Finance'],
  'schedule': ['Project Manager'],
  'risk': ['Risk Compliance', 'Senior Management'],
  'resource': ['Engineer', 'Project Manager'],
  'quality': ['Engineer'],
};

function classifyAlertType(alert: any): string {
  const title = (alert.title || '').toLowerCase();
  const desc = (alert.description || '').toLowerCase();
  const metric = (alert.metric_name || '').toLowerCase();
  const combined = `${title} ${desc} ${metric}`;

  if (combined.includes('task') && (combined.includes('delay') || combined.includes('overdue') || combined.includes('late'))) return 'task_delayed';
  if (combined.includes('budget') && (combined.includes('overrun') || combined.includes('exceed') || combined.includes('over'))) return 'budget_overrun';
  if (combined.includes('schedule') && (combined.includes('critical') || combined.includes('variance') || combined.includes('slip'))) return 'schedule_variance_critical';
  if (combined.includes('predict') && combined.includes('delay')) return 'predicted_delay';
  if (combined.includes('high') && combined.includes('risk')) return 'high_risk';
  if (combined.includes('cost') || combined.includes('budget') || combined.includes('eac') || combined.includes('etc') || combined.includes('cpi')) return 'cost';
  if (combined.includes('schedule') || combined.includes('spi') || combined.includes('duration')) return 'schedule';
  if (combined.includes('risk')) return 'risk';
  if (combined.includes('resource') || combined.includes('utilization') || combined.includes('hours')) return 'resource';
  if (combined.includes('quality') || combined.includes('defect')) return 'quality';
  return 'schedule'; // default fallback
}

async function getUsersByRoles(supabase: any, roleNames: string[], orgId: string): Promise<string[]> {
  const { data: roles } = await supabase
    .from('roles')
    .select('id')
    .in('name', roleNames)
    .eq('organization_id', orgId);

  if (!roles || roles.length === 0) return [];

  const roleIds = roles.map((r: any) => r.id);
  const { data: assignments } = await supabase
    .from('user_role_assignments')
    .select('user_id')
    .in('role_id', roleIds);

  return assignments?.map((a: any) => a.user_id) || [];
}

async function sendAlertNotifications(supabase: any, projectId: string, perfProjectId: string | null, alerts: any[], userId: string) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, email, organization_id')
      .eq('id', userId)
      .single();

    if (!userProfile?.organization_id) return;
    const orgId = userProfile.organization_id;

    // Classify alerts and group by target roles
    const roleAlertMap: Record<string, any[]> = {};
    for (const alert of alerts) {
      const alertType = classifyAlertType(alert);
      const targetRoles = ALERT_ROLE_ROUTING[alertType] || ['Project Manager'];
      for (const role of targetRoles) {
        if (!roleAlertMap[role]) roleAlertMap[role] = [];
        roleAlertMap[role].push(alert);
      }
    }

    // Get all unique role names
    const allTargetRoles = [...new Set(Object.keys(roleAlertMap))];
    const roleUserIds = await getUsersByRoles(supabase, allTargetRoles, orgId);

    // Also include project members as fallback
    const { data: projectMembers } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId);
    const projectMemberIds = projectMembers?.map((m: any) => m.user_id) || [];

    // Build per-user notification with role-specific alerts
    const userAlertMap: Record<string, any[]> = {};

    // Add role-based user notifications
    for (const [roleName, roleAlerts] of Object.entries(roleAlertMap)) {
      const usersForRole = await getUsersByRoles(supabase, [roleName], orgId);
      for (const uid of usersForRole) {
        if (!userAlertMap[uid]) userAlertMap[uid] = [];
        for (const alert of roleAlerts) {
          if (!userAlertMap[uid].some((a: any) => a.title === alert.title)) {
            userAlertMap[uid].push(alert);
          }
        }
      }
    }

    // Fallback: if no role-based users found, notify the triggering user
    if (Object.keys(userAlertMap).length === 0) {
      userAlertMap[userId] = alerts;
    }

    // Create in-app notifications per user
    const criticalAlerts = alerts.filter((a: any) => a.severity === 'high' || a.severity === 'critical');
    if (criticalAlerts.length > 0 || alerts.length > 0) {
      const notifInserts: any[] = [];
      for (const [uid, userAlerts] of Object.entries(userAlertMap)) {
        const highAlerts = userAlerts.filter((a: any) => a.severity === 'high' || a.severity === 'critical');
        const alertsToNotify = highAlerts.length > 0 ? highAlerts : userAlerts;
        if (alertsToNotify.length > 0) {
          notifInserts.push({
            user_id: uid,
            type: 'performance_alert',
            title: `⚠️ Performance Alert: ${alertsToNotify.length} issue${alertsToNotify.length > 1 ? 's' : ''} detected`,
            message: alertsToNotify.map((a: any) => `${a.severity.toUpperCase()}: ${a.title}`).join(' | '),
            data: {
              source: 'performance_monitoring',
              project_id: projectId,
              performance_project_id: perfProjectId,
              alert_count: alertsToNotify.length,
              alert_types: alertsToNotify.map((a: any) => classifyAlertType(a)),
            },
            read: false,
          });
        }
      }
      if (notifInserts.length > 0) {
        await supabase.from('notifications').insert(notifInserts);
      }
    }

    // Send email via SMTP for critical/high alerts
    if (criticalAlerts.length > 0) {
      const { data: smtpConfigs } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1);

      if (smtpConfigs && smtpConfigs.length > 0) {
        // Get emails of role-targeted users
        const targetUserIds = [...new Set(Object.keys(userAlertMap))];
        const { data: targetProfiles } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', targetUserIds);

        const emailRecipients = targetProfiles?.filter((p: any) => p.email) || [];
        if (emailRecipients.length > 0) {
          const smtpConfig = smtpConfigs[0];

          // Build role-based alert summary
          const alertsByType: Record<string, any[]> = {};
          for (const alert of criticalAlerts) {
            const aType = classifyAlertType(alert);
            if (!alertsByType[aType]) alertsByType[aType] = [];
            alertsByType[aType].push(alert);
          }

          const htmlAlertRows = criticalAlerts.map((a: any) => {
            const aType = classifyAlertType(a);
            const targetRoles = ALERT_ROLE_ROUTING[aType] || ['Project Manager'];
            const severityColor = a.severity === 'critical' ? '#dc2626' : '#f59e0b';
            const severityBg = a.severity === 'critical' ? '#fef2f2' : '#fffbeb';
            return `<tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${severityBg};color:${severityColor};font-weight:600;font-size:12px;text-transform:uppercase;">${a.severity}</span>
              </td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#111827;">${a.title}</td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${a.description || '—'}</td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                ${targetRoles.map((r: string) => `<span style="display:inline-block;padding:2px 6px;border-radius:3px;background:#eff6ff;color:#1d4ed8;font-size:11px;margin:1px 2px;">${r}</span>`).join('')}
              </td>
            </tr>`;
          }).join('');

          const htmlEmail = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f3f4f6;">
  <div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">🚨 Performance Threshold Alert</h1>
      <p style="margin:8px 0 0;color:#fecaca;font-size:14px;">
        ${criticalAlerts.length} critical/high severity issue${criticalAlerts.length > 1 ? 's' : ''} detected in your project
      </p>
    </div>

    <!-- Alert Summary Stats -->
    <div style="padding:20px 32px;background:#fef2f2;border-bottom:1px solid #fecaca;">
      <table style="width:100%;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:700;color:#dc2626;">${criticalAlerts.filter((a: any) => a.severity === 'critical').length}</div>
            <div style="font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;">Critical</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:700;color:#f59e0b;">${criticalAlerts.filter((a: any) => a.severity === 'high').length}</div>
            <div style="font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">High</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:700;color:#4b5563;">${alerts.length}</div>
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Total Alerts</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Alert Details Table -->
    <div style="padding:24px 32px;">
      <h2 style="margin:0 0 16px;font-size:16px;color:#111827;font-weight:600;">Alert Details</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Severity</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Alert</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Details</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Assigned To</th>
          </tr>
        </thead>
        <tbody>${htmlAlertRows}</tbody>
      </table>
    </div>

    <!-- Threshold Violations Section -->
    <div style="padding:0 32px 24px;">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;color:#92400e;font-weight:600;">⚡ Threshold Violation Summary</h3>
        <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
          ${criticalAlerts.map((a: any) => {
            const actual = a.actual_value != null ? `Actual: ₹${Number(a.actual_value).toLocaleString('en-IN')}` : '';
            const threshold = a.threshold_value != null ? `Threshold: ₹${Number(a.threshold_value).toLocaleString('en-IN')}` : '';
            return `<strong>${a.metric_name || a.title}</strong>: ${[actual, threshold].filter(Boolean).join(' | ')}`;
          }).join('<br>')}
        </p>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding:0 32px 32px;text-align:center;">
      <a href="#" style="display:inline-block;padding:12px 32px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Review in Performance Dashboard
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        This is an automated alert from TopSqill Performance Monitoring System.
        <br>Alerts are routed based on your assigned role. Contact your admin to update role assignments.
      </p>
    </div>
  </div>
</body>
</html>`;

          const textContent = `Performance Threshold Alert\n\n${criticalAlerts.length} critical/high severity issues detected.\n\n${criticalAlerts.map((a: any) => `${a.severity.toUpperCase()}: ${a.title} — ${a.description || ''}`).join('\n')}\n\nPlease review the Performance Dashboard for details.`;

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

            for (const recipient of emailRecipients) {
              try {
                const recipientName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || 'Team Member';
                const personalizedHtml = htmlEmail.replace(
                  '🚨 Performance Threshold Alert',
                  `🚨 Performance Threshold Alert — ${recipientName}`
                );
                await client.send({
                  from: smtpConfig.from_name ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` : smtpConfig.from_email,
                  to: recipient.email,
                  subject: `🚨 Performance Alert: ${criticalAlerts.length} threshold violation${criticalAlerts.length > 1 ? 's' : ''} detected`,
                  content: textContent,
                  html: personalizedHtml,
                });
              } catch (emailErr) {
                console.error('Email send failed for', recipient.email, emailErr);
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

      const isAllRecords = submission_id === '__all__';

      // Fetch data sources
      let dsQuery = supabase
        .from("performance_data_sources")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);
      if (performance_project_id) dsQuery = dsQuery.eq("performance_project_id", performance_project_id);
      const { data: dataSources } = await dsQuery;

      // Fetch thresholds
      let thQuery = supabase
        .from("performance_thresholds")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", true);
      if (performance_project_id) thQuery = thQuery.eq("performance_project_id", performance_project_id);
      const { data: thresholds } = await thQuery;

      // CLEAR old alerts and predictions for this perf project before generating fresh ones
      let delAlertQuery = supabase.from("performance_alerts").delete().eq("project_id", project_id).eq("ai_generated", true);
      let delPredQuery = supabase.from("performance_predictions").delete().eq("project_id", project_id);
      if (performance_project_id) {
        delAlertQuery = delAlertQuery.eq("performance_project_id", performance_project_id);
        delPredQuery = delPredQuery.eq("performance_project_id", performance_project_id);
      }
      await delAlertQuery;
      await delPredQuery;

      let prompt: string;
      let analysisContext: any;

      if (isAllRecords) {
        // Aggregated analysis across all records
        analysisContext = await fetchAllRecordsData(supabase, dataSources || []);
        if (!analysisContext) {
          return new Response(JSON.stringify({
            summary: "No records found. Ensure the data source is configured and submissions exist.",
            anomalies: [], predictions: [], risk_score: 0, health_status: "green",
            recommendations: [{ priority: "high", title: "Add Data", description: "Submit data through your form first." }],
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        prompt = `You are an expert project performance analyst conducting a PORTFOLIO-WIDE AGGREGATED ANALYSIS across ${analysisContext.totalRecords} records.

${ENTERPRISE_PORTFOLIO_TRACKER_CONTEXT}

PORTFOLIO ANALYSIS:
Form: "${analysisContext.formName}"
Total Records: ${analysisContext.totalRecords}

AGGREGATED METRICS (avg, sum, min, max across all records):
${JSON.stringify(analysisContext.aggregatedMetrics, null, 2)}

SAMPLE RECORDS (first 20):
${JSON.stringify(analysisContext.recordSummaries, null, 2)}

CONFIGURED ALERT THRESHOLDS:
${JSON.stringify(thresholds || [], null, 2)}

ANALYSIS INSTRUCTIONS:
1. ANOMALY DETECTION: Identify outliers and unusual patterns across the portfolio.
2. FINANCIAL HEALTH: Analyze aggregate cost performance, budget utilization, ROI trends.
3. SCHEDULE HEALTH: Evaluate overall schedule performance across projects.
4. RISK ASSESSMENT: Score the overall portfolio risk (0-100).
5. PREDICTIONS: Based on portfolio trends, predict future performance.
6. THRESHOLD VIOLATIONS: Check configured thresholds against aggregated values.
7. RECOMMENDATIONS: Provide strategic recommendations for portfolio-level improvements.

Be SPECIFIC — reference actual aggregated values, averages, and trends.`;
      } else {
        // Single record analysis
        analysisContext = await fetchSingleRecordData(supabase, dataSources || [], submission_id);
        if (!analysisContext) {
          return new Response(JSON.stringify({
            summary: "Could not find the selected record.",
            anomalies: [], predictions: [], risk_score: 0, health_status: "green",
            recommendations: [{ priority: "high", title: "Configure Data Source", description: "Go to the Data Sources tab." }],
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        prompt = `You are an expert project performance analyst conducting a DETAILED SINGLE RECORD ANALYSIS.

${ENTERPRISE_PORTFOLIO_TRACKER_CONTEXT}

SELECTED RECORD FOR ANALYSIS:
Form: "${analysisContext.formName}"
Record Reference: ${analysisContext.submissionRefId}
Submitted At: ${analysisContext.submittedAt}

FULL RECORD DATA (all fields):
${JSON.stringify(analysisContext.recordData, null, 2)}

MAPPED FIELD DETAILS (with roles and types):
${JSON.stringify(analysisContext.mappedFields, null, 2)}

PORTFOLIO CONTEXT (statistics from ${analysisContext.totalRecords} total records for comparison):
${JSON.stringify(analysisContext.portfolioStats, null, 2)}

CONFIGURED ALERT THRESHOLDS:
${JSON.stringify(thresholds || [], null, 2)}

ANALYSIS INSTRUCTIONS:
1. ANOMALY DETECTION: Compare this record's values against the portfolio averages. Flag any value that deviates >2 standard deviations.
2. FINANCIAL HEALTH: Analyze cost performance (Actual vs Planned), ROI, NPV, IRR vs Discount Rate.
3. SCHEDULE HEALTH: Compare Actual Duration vs Planned Duration, Actual Effort vs Planned Effort.
4. RISK ASSESSMENT: Use the Risk Score, Size Score, Value Score to evaluate risk-value balance. Score 0-100 overall.
5. PREDICTIONS: Based on current trajectory, predict likely completion date, final cost, and resource needs.
6. THRESHOLD VIOLATIONS: Check configured thresholds against this record's values.
7. RECOMMENDATIONS: Provide actionable, specific recommendations referencing actual values.

Be SPECIFIC — reference actual field values, dollar amounts, dates, and percentages from the record data.`;
      }

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

      // Store anomalies as fresh alerts
      const recordRef = isAllRecords ? 'All Records' : (analysisContext.submissionRefId || submission_id.slice(0, 8));
      if (analysis.anomalies?.length > 0) {
        const orgId = dataSources?.[0]?.organization_id;
        const alertInserts = analysis.anomalies.map((a: any) => ({
          project_id,
          organization_id: orgId,
          alert_type: "anomaly",
          severity: a.severity,
          title: `Anomaly: ${a.metric} (${recordRef})`,
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

        // Send in-app and email notifications for alerts
        await sendAlertNotifications(supabase, project_id, performance_project_id || null, alertInserts, user.id);
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
          reasoning: `[${recordRef}] ${p.description}`,
          model_used: "gemini-3-flash-preview",
          input_data_points: isAllRecords ? analysisContext.totalRecords : 1,
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
