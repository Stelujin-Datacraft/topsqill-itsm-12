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

CURRENCY: All monetary values are in Indian Rupees (₹ / INR). Always use the ₹ symbol — never use $ or USD.

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

const PERFORMANCE_ROLE_LABELS: Record<string, string> = {
  senior_management: 'Senior Management',
  project_manager: 'Project Manager',
  discipline_engineer: 'Discipline Engineer',
  finance_contract: 'Finance / Contract',
  risk_governance: 'Risk / Governance',
};

function buildAlertEmailHtml(alerts: any[], projectName: string, perfProjectName: string | null): string {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });
  
  const severityColors: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
    high: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
    medium: { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
    low: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  };

  const alertRows = alerts.map((a: any) => {
    const colors = severityColors[a.severity] || severityColors.medium;
    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:${colors.bg};color:${colors.text};border:1px solid ${colors.border};">${a.severity}</span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1f2937;">${a.title}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:13px;">${a.description || '—'}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:13px;">
          ${a.metric_name || '—'}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">
          ${a.threshold_value != null ? `<span style="color:#6b7280;">Threshold: ${a.threshold_value}</span><br>` : ''}
          ${a.actual_value != null ? `<span style="font-weight:600;color:${a.severity === 'critical' || a.severity === 'high' ? '#dc2626' : '#d97706'};">Actual: ${a.actual_value}</span>` : '—'}
        </td>
      </tr>`;
  }).join('');

  const criticalCount = alerts.filter((a: any) => a.severity === 'critical').length;
  const highCount = alerts.filter((a: any) => a.severity === 'high').length;
  const mediumCount = alerts.filter((a: any) => a.severity === 'medium').length;

  const headerColor = criticalCount > 0 ? '#dc2626' : highCount > 0 ? '#ea580c' : '#d97706';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Alert</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <div style="max-width:700px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%);color:#ffffff;padding:32px 28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td>
            <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">🚨 Performance Alert</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">
              ${alerts.length} threshold violation${alerts.length > 1 ? 's' : ''} detected
            </p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="background:rgba(255,255,255,0.2);border-radius:6px;padding:8px 14px;display:inline-block;">
              <span style="font-size:24px;font-weight:800;">${alerts.length}</span>
              <br><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Alert${alerts.length > 1 ? 's' : ''}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Project Info -->
    <div style="padding:20px 28px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;">
            <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600;">Project</span><br>
            <span style="font-size:14px;font-weight:600;color:#1f2937;">${projectName}</span>
          </td>
          ${perfProjectName ? `
          <td style="padding:4px 0;">
            <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600;">Performance Module</span><br>
            <span style="font-size:14px;font-weight:600;color:#1f2937;">${perfProjectName}</span>
          </td>` : ''}
          <td style="padding:4px 0;text-align:right;">
            <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600;">Generated</span><br>
            <span style="font-size:13px;color:#1f2937;">${timestamp}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Summary Badges -->
    <div style="padding:20px 28px;border-bottom:1px solid #e5e7eb;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          ${criticalCount > 0 ? `<td style="text-align:center;padding:8px;">
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
              <div style="font-size:24px;font-weight:800;color:#991b1b;">${criticalCount}</div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#b91c1c;font-weight:600;">Critical</div>
            </div>
          </td>` : ''}
          ${highCount > 0 ? `<td style="text-align:center;padding:8px;">
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;">
              <div style="font-size:24px;font-weight:800;color:#9a3412;">${highCount}</div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#c2410c;font-weight:600;">High</div>
            </div>
          </td>` : ''}
          ${mediumCount > 0 ? `<td style="text-align:center;padding:8px;">
            <div style="background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:12px;">
              <div style="font-size:24px;font-weight:800;color:#854d0e;">${mediumCount}</div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#a16207;font-weight:600;">Medium</div>
            </div>
          </td>` : ''}
        </tr>
      </table>
    </div>

    <!-- Alert Table -->
    <div style="padding:24px 28px;">
      <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1f2937;">Alert Details</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Severity</th>
            <th style="padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Alert</th>
            <th style="padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Details</th>
            <th style="padding:10px 16px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Metric</th>
            <th style="padding:10px 16px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Values</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows}
        </tbody>
      </table>
    </div>

    <!-- AI Recommendation -->
    ${alerts[0]?.ai_recommendation ? `
    <div style="padding:0 28px 24px;">
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1e40af;">💡 AI Recommendation</h3>
        <p style="margin:0;font-size:13px;color:#1e3a5f;line-height:1.5;">${alerts[0].ai_recommendation}</p>
      </div>
    </div>` : ''}

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 28px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        This is an automated alert from the <strong>Performance Monitoring System</strong>.<br>
        You received this email because you are assigned to a performance role configured for threshold notifications.<br>
        To manage alert preferences, go to the Thresholds tab in your KPI Dashboard.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendAlertNotifications(supabase: any, projectId: string, perfProjectId: string | null, alerts: any[], userId: string) {
  try {
    // Get current user's org
    const { data: orgMembers } = await supabase
      .from('user_profiles')
      .select('id, email, organization_id')
      .eq('id', userId)
      .single();

    if (!orgMembers) return;

    // Get project info for email context
    const { data: projectInfo } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    let perfProjectName: string | null = null;
    if (perfProjectId) {
      const { data: perfProject } = await supabase
        .from('performance_projects')
        .select('name')
        .eq('id', perfProjectId)
        .single();
      perfProjectName = perfProject?.name || null;
    }

    const projectName = projectInfo?.name || 'Unknown Project';

    // Get project members for in-app notifications
    const { data: members } = await supabase
      .from('project_users')
      .select('user_id')
      .eq('project_id', projectId);

    const memberIds = members?.map((m: any) => m.user_id) || [userId];
    const uniqueIds = [...new Set(memberIds)];

    // Create in-app notifications for all members
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

    // --- Role-based email notifications via SMTP ---
    // Fetch thresholds that have notify_role_ids configured
    let thQuery = supabase
      .from('performance_thresholds')
      .select('notify_role_ids, metric_name, form_field_label')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .eq('send_email', true);
    if (perfProjectId) thQuery = thQuery.eq('performance_project_id', perfProjectId);
    const { data: emailThresholds } = await thQuery;

    if (!emailThresholds || emailThresholds.length === 0) {
      console.log('No thresholds with email notifications configured');
      return;
    }

    // Collect all unique role_types that need notifying
    const allRoleTypes = new Set<string>();
    for (const th of emailThresholds) {
      if (th.notify_role_ids && Array.isArray(th.notify_role_ids)) {
        th.notify_role_ids.forEach((r: string) => allRoleTypes.add(r));
      }
    }

    if (allRoleTypes.size === 0) {
      console.log('No roles configured for email notifications');
      return;
    }

    console.log('Roles to notify:', [...allRoleTypes]);

    // Find users assigned to these performance roles
    let roleQuery = supabase
      .from('performance_user_roles')
      .select('user_id, role_type')
      .eq('project_id', projectId)
      .in('role_type', [...allRoleTypes]);
    if (perfProjectId) roleQuery = roleQuery.eq('performance_project_id', perfProjectId);
    const { data: roleAssignments } = await roleQuery;

    if (!roleAssignments || roleAssignments.length === 0) {
      console.log('No users assigned to the notified performance roles');
      return;
    }

    // Get unique user IDs and their roles
    const userRoleMap = new Map<string, Set<string>>();
    for (const ra of roleAssignments) {
      if (!userRoleMap.has(ra.user_id)) userRoleMap.set(ra.user_id, new Set());
      userRoleMap.get(ra.user_id)!.add(ra.role_type);
    }

    const targetUserIds = [...userRoleMap.keys()];

    // Get email addresses
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name')
      .in('id', targetUserIds);

    const emailTargets = userProfiles?.filter((p: any) => p.email) || [];
    if (emailTargets.length === 0) {
      console.log('No email addresses found for notified users');
      return;
    }

    // Fetch SMTP config
    const { data: smtpConfigs } = await supabase
      .from('smtp_configs')
      .select('*')
      .eq('organization_id', orgMembers.organization_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1);

    if (!smtpConfigs || smtpConfigs.length === 0) {
      console.error('No active SMTP configuration found — cannot send alert emails');
      return;
    }

    const smtpConfig = smtpConfigs[0];
    console.log('Using SMTP config:', smtpConfig.name, smtpConfig.host);

    // Build email content
    const emailHtml = buildAlertEmailHtml(alerts, projectName, perfProjectName);
    const critCount = alerts.filter((a: any) => a.severity === 'critical').length;
    const highCount = alerts.filter((a: any) => a.severity === 'high').length;

    const severityLabel = critCount > 0 ? '🔴 CRITICAL' : highCount > 0 ? '🟠 HIGH' : '🟡 MEDIUM';
    const emailSubject = `${severityLabel} | ${alerts.length} Performance Alert${alerts.length > 1 ? 's' : ''} — ${projectName}${perfProjectName ? ` / ${perfProjectName}` : ''}`;

    const plainText = alerts.map((a: any) => {
      const roles = userRoleMap.get(userId);
      const roleLabels = roles ? [...roles].map(r => PERFORMANCE_ROLE_LABELS[r] || r).join(', ') : '';
      return `• [${a.severity.toUpperCase()}] ${a.title}\n  ${a.description || ''}\n  Metric: ${a.metric_name || '—'} | Threshold: ${a.threshold_value ?? '—'} | Actual: ${a.actual_value ?? '—'}`;
    }).join('\n\n');

    // Send emails
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      
      // For port 587 (Gmail/STARTTLS), use tls:false so denomailer upgrades via STARTTLS
      // For port 465, use tls:true for implicit TLS
      const useDirectTls = smtpConfig.port === 465;
      
      console.log(`SMTP connecting: ${smtpConfig.host}:${smtpConfig.port} tls=${useDirectTls}`);
      
      const client = new SMTPClient({
        connection: {
          hostname: smtpConfig.host,
          port: smtpConfig.port,
          tls: useDirectTls,
          auth: { username: smtpConfig.username, password: smtpConfig.password },
        },
      });

      for (const target of emailTargets) {
        const userRoles = userRoleMap.get(target.id);
        const roleLabels = userRoles ? [...userRoles].map((r: string) => PERFORMANCE_ROLE_LABELS[r] || r).join(', ') : '';
        
        try {
          await client.send({
            from: smtpConfig.from_name ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` : smtpConfig.from_email,
            to: target.email,
            subject: emailSubject,
            content: `Performance Alert — ${projectName}\n\nHello ${target.first_name || 'Team Member'},\n\nYou are receiving this alert because of your performance role: ${roleLabels}\n\n${plainText}\n\nPlease review the Performance Dashboard for details.\n\nThis is an automated alert from the Performance Monitoring System.`,
            html: emailHtml,
          });
          console.log(`✅ Alert email sent to ${target.email} (Roles: ${roleLabels})`);
        } catch (emailErr) {
          console.error(`❌ Email send failed for ${target.email}:`, emailErr);
        }
      }
      await client.close();
      console.log(`📧 Alert emails completed: ${emailTargets.length} recipient(s)`);
    } catch (smtpErr) {
      console.error('SMTP connection failed (non-blocking):', smtpErr);
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

IMPORTANT: All monetary values are in Indian Rupees (₹ / INR). Always use the ₹ symbol when referencing currency amounts — never use $ or USD.

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

IMPORTANT: All monetary values are in Indian Rupees (₹ / INR). Always use the ₹ symbol when referencing currency amounts — never use $ or USD.

Be SPECIFIC — reference actual field values, rupee amounts (₹), dates, and percentages from the record data.`;
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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

      // --- Threshold breach check (independent of AI anomalies) ---
      // Check actual submission data against configured thresholds and send email alerts
      try {
        const { data: thresholds } = await supabase
          .from('performance_thresholds')
          .select('*')
          .eq('project_id', project_id)
          .eq('is_active', true)
          .eq('send_email', true)
          .eq('performance_project_id', performance_project_id || '');
        
        // Also try without perf project filter if none found
        let allThresholds = thresholds || [];
        if (allThresholds.length === 0) {
          const { data: th2 } = await supabase
            .from('performance_thresholds')
            .select('*')
            .eq('project_id', project_id)
            .eq('is_active', true)
            .eq('send_email', true);
          allThresholds = th2 || [];
        }

        if (allThresholds.length > 0 && submissionData) {
          const breachedAlerts: any[] = [];

          for (const th of allThresholds) {
            const fieldId = th.form_field_id;
            const actualValue = fieldId ? parseFloat(submissionData[fieldId]) : null;
            
            if (actualValue === null || isNaN(actualValue)) continue;

            const thresholdVal = parseFloat(th.threshold_value);
            if (isNaN(thresholdVal)) continue;

            let breached = false;
            switch (th.operator) {
              case '>': breached = actualValue > thresholdVal; break;
              case '<': breached = actualValue < thresholdVal; break;
              case '>=': breached = actualValue >= thresholdVal; break;
              case '<=': breached = actualValue <= thresholdVal; break;
              case '=': case '==': breached = actualValue === thresholdVal; break;
              case '!=': breached = actualValue !== thresholdVal; break;
            }

            if (breached) {
              breachedAlerts.push({
                severity: th.severity || 'medium',
                title: `Threshold Breach: ${th.form_field_label || th.metric_name}`,
                description: `${th.form_field_label || th.metric_name} value ${actualValue} ${th.operator} ${thresholdVal} (${th.severity})`,
                metric_name: th.metric_name,
                threshold_value: thresholdVal,
                actual_value: actualValue,
                ai_recommendation: analysis.recommendations?.[0]?.description || null,
              });
            }
          }

          if (breachedAlerts.length > 0) {
            console.log(`🚨 ${breachedAlerts.length} threshold breach(es) detected — sending email alerts`);
            await sendAlertNotifications(supabase, project_id, performance_project_id || null, breachedAlerts, user.id);
          } else {
            console.log('✅ No threshold breaches detected in submission data');
          }
        }
      } catch (thErr) {
        console.error('Threshold breach check error (non-blocking):', thErr);
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
