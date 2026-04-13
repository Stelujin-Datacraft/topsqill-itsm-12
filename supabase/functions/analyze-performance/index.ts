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

// Independent threshold breach check — evaluates each threshold against actual data
async function checkThresholdBreaches(
  supabase: any, projectId: string, perfProjectId: string | null,
  thresholds: any[], analysisContext: any, isAllRecords: boolean, recordRef: string
) {
  if (!thresholds || thresholds.length === 0) return [];

  const breachAlerts: any[] = [];
  const orgId = null; // Will be set from data source

  for (const th of thresholds) {
    const fieldId = th.form_field_id;
    const fieldLabel = th.form_field_label || th.metric_name;
    const operator = th.operator;
    const thresholdValue = parseFloat(th.threshold_value);
    if (isNaN(thresholdValue)) continue;

    let actualValue: number | null = null;

    if (isAllRecords && analysisContext?.aggregatedMetrics) {
      // For portfolio mode, check against aggregated avg
      for (const [label, stats] of Object.entries(analysisContext.aggregatedMetrics as Record<string, any>)) {
        if (label === fieldLabel || label === th.metric_name) {
          actualValue = stats.avg;
          break;
        }
      }
    } else if (!isAllRecords && analysisContext?.recordData) {
      // For single record, check the actual field value
      const raw = analysisContext.recordData[fieldId];
      if (raw != null) {
        const parsed = parseFloat(String(raw));
        if (!isNaN(parsed)) actualValue = parsed;
      }
      // Also try mapped fields
      if (actualValue === null && analysisContext.mappedFields) {
        for (const [label, info] of Object.entries(analysisContext.mappedFields as Record<string, any>)) {
          if (label === fieldLabel || label === th.metric_name) {
            const v = parseFloat(String((info as any).value));
            if (!isNaN(v)) actualValue = v;
            break;
          }
        }
      }
    }

    if (actualValue === null) continue;

    let breached = false;
    switch (operator) {
      case '>': breached = actualValue > thresholdValue; break;
      case '>=': breached = actualValue >= thresholdValue; break;
      case '<': breached = actualValue < thresholdValue; break;
      case '<=': breached = actualValue <= thresholdValue; break;
      case '==': breached = actualValue === thresholdValue; break;
      case '!=': breached = actualValue !== thresholdValue; break;
    }

    if (breached) {
      breachAlerts.push({
        project_id: projectId,
        alert_type: "threshold_breach",
        severity: th.severity || "medium",
        title: `Threshold Breach: ${fieldLabel} (${recordRef})`,
        description: `${fieldLabel} = ${actualValue} (threshold: ${operator} ${thresholdValue})`,
        ai_generated: false,
        metric_name: fieldLabel,
        threshold_value: thresholdValue,
        actual_value: actualValue,
        status: "active",
        ...(perfProjectId ? { performance_project_id: perfProjectId } : {}),
        // Carry threshold metadata for role-based notifications
        _threshold: th,
      });
    }
  }

  return breachAlerts;
}

// Native SMTP send using Deno.connect + Deno.startTls (works in edge functions)
async function sendSmtpEmail(smtpConfig: any, to: string, subject: string, textContent: string, htmlContent: string) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function readLine(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    let result = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      result += decoder.decode(value);
      if (result.includes('\r\n')) break;
    }
    return result.trim();
  }

  async function writeCmd(writer: WritableStreamDefaultWriter<Uint8Array>, cmd: string) {
    await writer.write(encoder.encode(cmd + '\r\n'));
  }

  async function readAndCheck(reader: ReadableStreamDefaultReader<Uint8Array>, expectedCode: string) {
    const line = await readLine(reader);
    if (!line.startsWith(expectedCode)) {
      throw new Error(`SMTP error: expected ${expectedCode}, got: ${line}`);
    }
    return line;
  }

  const port = smtpConfig.port || 587;
  const hostname = smtpConfig.host;

  let conn: Deno.TcpConn | Deno.TlsConn;

  if (port === 465) {
    // Direct TLS
    conn = await Deno.connectTls({ hostname, port });
  } else {
    // STARTTLS (port 587)
    conn = await Deno.connect({ hostname, port });
  }

  let reader = conn.readable.getReader();
  let writer = conn.writable.getWriter();

  try {
    await readAndCheck(reader, '220');
    await writeCmd(writer, `EHLO localhost`);
    // Read all EHLO response lines
    let ehloResp = '';
    while (true) {
      const line = await readLine(reader);
      ehloResp += line + '\n';
      if (line.match(/^250 /)) break; // last line has space not dash
      if (!line.match(/^250[-\s]/)) throw new Error(`EHLO failed: ${line}`);
    }

    // STARTTLS for port 587
    if (port !== 465) {
      await writeCmd(writer, 'STARTTLS');
      await readAndCheck(reader, '220');
      reader.releaseLock();
      writer.releaseLock();
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname });
      reader = conn.readable.getReader();
      writer = conn.writable.getWriter();
      await writeCmd(writer, `EHLO localhost`);
      while (true) {
        const line = await readLine(reader);
        if (line.match(/^250 /)) break;
        if (!line.match(/^250[-\s]/)) throw new Error(`EHLO2 failed: ${line}`);
      }
    }

    // AUTH LOGIN
    await writeCmd(writer, 'AUTH LOGIN');
    await readAndCheck(reader, '334');
    await writeCmd(writer, btoa(smtpConfig.username));
    await readAndCheck(reader, '334');
    await writeCmd(writer, btoa(smtpConfig.password));
    await readAndCheck(reader, '235');

    const fromAddr = smtpConfig.from_email;
    const fromHeader = smtpConfig.from_name ? `${smtpConfig.from_name} <${fromAddr}>` : fromAddr;
    const boundary = `boundary_${Date.now()}`;

    await writeCmd(writer, `MAIL FROM:<${fromAddr}>`);
    await readAndCheck(reader, '250');
    await writeCmd(writer, `RCPT TO:<${to}>`);
    await readAndCheck(reader, '250');
    await writeCmd(writer, 'DATA');
    await readAndCheck(reader, '354');

    const msg = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      textContent,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlContent,
      ``,
      `--${boundary}--`,
      `.`,
    ].join('\r\n');

    await writeCmd(writer, msg);
    await readAndCheck(reader, '250');
    await writeCmd(writer, 'QUIT');
  } finally {
    try { reader.releaseLock(); } catch (_) {}
    try { writer.releaseLock(); } catch (_) {}
    try { conn.close(); } catch (_) {}
  }
}

// Send role-based notifications for threshold breaches
async function sendThresholdBreachNotifications(
  supabase: any, projectId: string, perfProjectId: string | null,
  breachAlerts: any[], userId: string
) {
  if (!breachAlerts || breachAlerts.length === 0) return;

  try {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (!userProfile?.organization_id) return;
    const orgId = userProfile.organization_id;

    const roleIdSet = new Set<string>();
    for (const alert of breachAlerts) {
      const th = alert._threshold;
      if (th?.notify_role_ids && Array.isArray(th.notify_role_ids)) {
        th.notify_role_ids.forEach((rid: string) => roleIdSet.add(rid));
      }
    }

    let targetUserIds: string[] = [];
    if (roleIdSet.size > 0 && perfProjectId) {
      const roleTypes = [...roleIdSet];
      const { data: roleUsers } = await supabase
        .from('performance_user_roles')
        .select('user_id')
        .eq('performance_project_id', perfProjectId)
        .in('role_type', roleTypes);
      if (roleUsers) {
        targetUserIds = [...new Set(roleUsers.map((r: any) => r.user_id))];
      }
    }

    if (targetUserIds.length === 0) {
      const { data: orgUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('organization_id', orgId);
      targetUserIds = orgUsers?.map((u: any) => u.id) || [userId];
    }

    const uniqueIds = [...new Set(targetUserIds)];

    // In-app notifications
    const notifInserts = uniqueIds.map((uid: string) => ({
      user_id: uid,
      type: 'performance_alert',
      title: `⚠️ Threshold Breach: ${breachAlerts.length} violation${breachAlerts.length > 1 ? 's' : ''}`,
      message: breachAlerts.map((a: any) => `${a.severity.toUpperCase()}: ${a.title}`).join(' | '),
      data: { source: 'performance_threshold', project_id: projectId, performance_project_id: perfProjectId, alert_count: breachAlerts.length },
      read: false,
    }));
    await supabase.from('notifications').insert(notifInserts);

    // Email for breaches with send_email enabled
    const emailBreaches = breachAlerts.filter((a: any) => a._threshold?.send_email);
    if (emailBreaches.length > 0) {
      let { data: smtpConfigs } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .eq('is_default', true)
        .limit(1);
      if (!smtpConfigs || smtpConfigs.length === 0) {
        const fallback = await supabase.from('smtp_configs').select('*').eq('organization_id', orgId).eq('is_active', true).limit(1);
        smtpConfigs = fallback.data;
      }

      if (smtpConfigs && smtpConfigs.length > 0) {
        const { data: memberProfiles } = await supabase.from('user_profiles').select('email').in('id', uniqueIds);
        const emails = memberProfiles?.map((p: any) => p.email).filter(Boolean) || [];
        if (emails.length > 0) {
          const smtpConfig = smtpConfigs[0];
          const htmlAlerts = emailBreaches.map((a: any) =>
            `<tr><td style="padding:8px;border:1px solid #e5e7eb;"><span style="color:${a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : '#3b82f6'};font-weight:bold;">${a.severity.toUpperCase()}</span></td><td style="padding:8px;border:1px solid #e5e7eb;">${a.title}</td><td style="padding:8px;border:1px solid #e5e7eb;">${a.description || ''}</td></tr>`
          ).join('');
          const subject = `🚨 Threshold Breach: ${emailBreaches.length} violation${emailBreaches.length > 1 ? 's' : ''} detected`;
          const textContent = `Threshold Breach Alert\n\n${emailBreaches.map((a: any) => `• ${a.severity.toUpperCase()}: ${a.title} — ${a.description}`).join('\n')}\n\nPlease review the Performance Dashboard.`;
          const htmlContent = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:20px;"><h2 style="color:#ef4444;">🚨 Threshold Breach Alert</h2><p>${emailBreaches.length} threshold violation${emailBreaches.length > 1 ? 's' : ''} detected.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr style="background:#f3f4f6;"><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Severity</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Alert</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Details</th></tr></thead><tbody>${htmlAlerts}</tbody></table><p style="color:#6b7280;font-size:12px;">This is an automated alert from your Performance Monitoring system.</p></body></html>`;

          for (const email of emails) {
            try {
              await sendSmtpEmail(smtpConfig, email, subject, textContent, htmlContent);
              console.log('Threshold breach email sent to', email);
            } catch (emailErr) {
              console.error('Email send failed for', email, emailErr);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Threshold notification error (non-blocking):', err);
  }
}

// Send notifications for AI-detected anomalies
async function sendAlertNotifications(supabase: any, projectId: string, perfProjectId: string | null, alerts: any[], userId: string) {
  try {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, email, organization_id')
      .eq('id', userId)
      .single();

    if (!userProfile) return;

    // Get project members
    const { data: members } = await supabase
      .from('project_users')
      .select('user_id')
      .eq('project_id', projectId);

    const memberIds = members?.map((m: any) => m.user_id) || [userId];
    const uniqueIds = [...new Set(memberIds)];

    // Create in-app notifications for high/critical
    const criticalAlerts = alerts.filter((a: any) => a.severity === 'high' || a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      const notifInserts = uniqueIds.map((uid: string) => ({
        user_id: uid,
        type: 'performance_alert',
        title: `⚠️ AI Alert: ${criticalAlerts.length} issue${criticalAlerts.length > 1 ? 's' : ''} detected`,
        message: criticalAlerts.map((a: any) => `${a.severity.toUpperCase()}: ${a.title}`).join(' | '),
        data: { source: 'performance_monitoring', project_id: projectId, performance_project_id: perfProjectId, alert_count: criticalAlerts.length },
        read: false,
      }));
      await supabase.from('notifications').insert(notifInserts);
    }

    // Send email via SMTP for critical/high alerts
    if (criticalAlerts.length > 0 && userProfile.organization_id) {
      // Prefer the default SMTP config
      let { data: smtpConfigs } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .limit(1);
      if (!smtpConfigs || smtpConfigs.length === 0) {
        const fallback = await supabase
          .from('smtp_configs')
          .select('*')
          .eq('organization_id', userProfile.organization_id)
          .eq('is_active', true)
          .limit(1);
        smtpConfigs = fallback.data;
      }

      if (smtpConfigs && smtpConfigs.length > 0) {
        const { data: memberProfiles } = await supabase
          .from('user_profiles')
          .select('email')
          .in('id', uniqueIds);

        const emails = memberProfiles?.map((p: any) => p.email).filter(Boolean) || [];
        if (emails.length > 0) {
          const smtpConfig = smtpConfigs[0];
          const htmlAlerts = criticalAlerts.map((a: any) =>
            `<tr><td style="padding:8px;border:1px solid #e5e7eb;"><span style="color:${a.severity === 'critical' ? '#ef4444' : '#f59e0b'};font-weight:bold;">${a.severity.toUpperCase()}</span></td><td style="padding:8px;border:1px solid #e5e7eb;">${a.title}</td><td style="padding:8px;border:1px solid #e5e7eb;">${a.description || ''}</td></tr>`
          ).join('');

          try {
            const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
            const useDirectTls2 = smtpConfig.port === 465;
            const client = new SMTPClient({
              connection: {
                hostname: smtpConfig.host,
                port: smtpConfig.port,
                tls: useDirectTls2,
                auth: { username: smtpConfig.username, password: smtpConfig.password },
              },
            });

            for (const email of emails) {
              try {
                await client.send({
                  from: smtpConfig.from_name ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` : smtpConfig.from_email,
                  to: email,
                  subject: `🚨 Performance Alert: ${criticalAlerts.length} issue${criticalAlerts.length > 1 ? 's' : ''} detected`,
                  content: `Performance Monitoring Alert\n\n${criticalAlerts.map((a: any) => `• ${a.severity.toUpperCase()}: ${a.title} — ${a.description}`).join('\n')}\n\nPlease review the Performance Dashboard.`,
                  html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:20px;"><h2 style="color:#ef4444;">🚨 Performance Alert</h2><p>${criticalAlerts.length} issue${criticalAlerts.length > 1 ? 's' : ''} detected.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr style="background:#f3f4f6;"><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Severity</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Alert</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Details</th></tr></thead><tbody>${htmlAlerts}</tbody></table><p style="color:#6b7280;font-size:12px;">This is an automated alert from your Performance Monitoring system.</p></body></html>`,
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

      // Independent threshold breach check (not relying on AI)
      const breachAlerts = await checkThresholdBreaches(
        supabase, project_id, performance_project_id || null,
        thresholds || [], analysisContext, isAllRecords, recordRef
      );

      if (breachAlerts.length > 0) {
        const orgId = dataSources?.[0]?.organization_id;
        const breachInserts = breachAlerts.map((a: any) => {
          const { _threshold, ...alertData } = a;
          return { ...alertData, organization_id: orgId };
        });

        const { error: breachError } = await supabase.from("performance_alerts").insert(breachInserts);
        if (breachError) console.error("Error saving threshold breach alerts:", breachError);

        // Send role-based notifications for threshold breaches
        await sendThresholdBreachNotifications(supabase, project_id, performance_project_id || null, breachAlerts, user.id);
      }
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
