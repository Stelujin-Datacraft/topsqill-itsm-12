import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowRight, ArrowLeft, FileText, Workflow, Mail, Database,
  BookOpen, BarChart3, Monitor, Network, CheckCircle, Sparkles,
  ShieldCheck, AlertTriangle, ListChecks, FolderLock, ClipboardList,
  Timer, FileSignature, ShieldAlert, Bug, CalendarCheck, Award,
  LogOut, UserPlus,
} from 'lucide-react';

// Onboarding images
import onbForm from '@/assets/solution-onboarding/01-form-builder.jpg';
import onbWorkflow from '@/assets/solution-onboarding/02-workflow.jpg';
import onbEmail from '@/assets/solution-onboarding/03-email.jpg';
import onbData from '@/assets/solution-onboarding/04-datafeed.jpg';
import onbKb from '@/assets/solution-onboarding/05-knowledge.jpg';
import onbReports from '@/assets/solution-onboarding/06-reports.jpg';
import onbItam from '@/assets/solution-onboarding/07-itam.jpg';
import onbRel from '@/assets/solution-onboarding/08-relationships.jpg';

// GRC images
import grcPolicy from '@/assets/solution-grc/01-policy-form.jpg';
import grcFrameworks from '@/assets/solution-grc/02-frameworks.jpg';
import grcRisk from '@/assets/solution-grc/03-risk-register.jpg';
import grcWorkflow from '@/assets/solution-grc/04-workflow.jpg';
import grcControls from '@/assets/solution-grc/05-controls.jpg';
import grcEvidence from '@/assets/solution-grc/06-evidence.jpg';
import grcFindings from '@/assets/solution-grc/07-audit-findings.jpg';
import grcDash from '@/assets/solution-grc/08-dashboard.jpg';

// ITSM images
import itsmIntake from '@/assets/solution-itsm/01-intake-form.jpg';
import itsmWorkflow from '@/assets/solution-itsm/02-workflow.jpg';
import itsmSla from '@/assets/solution-itsm/03-sla.jpg';
import itsmAsset from '@/assets/solution-itsm/04-asset-link.jpg';
import itsmKb from '@/assets/solution-itsm/05-kb-deflection.jpg';
import itsmEmail from '@/assets/solution-itsm/06-email.jpg';
import itsmReports from '@/assets/solution-itsm/07-reports.jpg';
import itsmRel from '@/assets/solution-itsm/08-relationships.jpg';

// Vendor images
import venForm from '@/assets/solution-vendor/01-vendor-form.jpg';
import venWorkflow from '@/assets/solution-vendor/02-workflow.jpg';
import venContracts from '@/assets/solution-vendor/03-contracts.jpg';
import venData from '@/assets/solution-vendor/04-datafeed.jpg';
import venRisk from '@/assets/solution-vendor/05-risk.jpg';
import venEmail from '@/assets/solution-vendor/06-email.jpg';
import venReports from '@/assets/solution-vendor/07-reports.jpg';
import venRel from '@/assets/solution-vendor/08-relationships.jpg';

// Security images
import secIntake from '@/assets/solution-security/01-incident-form.jpg';
import secWorkflow from '@/assets/solution-security/02-workflow.jpg';
import secSla from '@/assets/solution-security/03-sla.jpg';
import secVuln from '@/assets/solution-security/04-vuln.jpg';
import secAsset from '@/assets/solution-security/05-asset.jpg';
import secRunbook from '@/assets/solution-security/06-runbook.jpg';
import secDash from '@/assets/solution-security/07-dashboard.jpg';
import secRel from '@/assets/solution-security/08-relationships.jpg';

// HR images
import hrEmp from '@/assets/solution-hr/01-employee-form.jpg';
import hrLifecycle from '@/assets/solution-hr/02-lifecycle.jpg';
import hrLeave from '@/assets/solution-hr/03-leave.jpg';
import hrPerf from '@/assets/solution-hr/04-performance.jpg';
import hrPolicy from '@/assets/solution-hr/05-policy-kb.jpg';
import hrHelp from '@/assets/solution-hr/06-helpdesk.jpg';
import hrDash from '@/assets/solution-hr/07-dashboard.jpg';
import hrExit from '@/assets/solution-hr/08-exit.jpg';

type Step = {
  num: string;
  module: string;
  title: string;
  description: string;
  bullets: string[];
  image: string;
  alt: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Solution = {
  id: string;
  label: string;
  title: React.ReactNode;
  tagline: string;
  chips: string[];
  scenarioTitle: string;
  scenarioBody: string;
  steps: Step[];
};

const solutions: Solution[] = [
  {
    id: 'onboarding',
    label: 'Employee Onboarding',
    title: <>Employee Onboarding,<br /><span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">end-to-end on one platform</span></>,
    tagline: 'Follow a single new hire from form submission to first day — Forms, Workflows, ITAM, Email, KB, Data Feeds, and Reports working together with zero glue code.',
    chips: ['Forms', 'Cross-Reference', 'Workflows', 'ITAM', 'Email', 'Knowledge Base', 'Data Feeds', 'Reports'],
    scenarioTitle: 'The scenario: Sarah joins as a Software Engineer',
    scenarioBody: "HR submits Sarah's onboarding form. Within minutes, IT has a laptop request in the queue, her manager gets an email, the right KB folder is assigned, HRMS is in sync, and the leadership dashboard reflects the new hire — without anyone touching a spreadsheet.",
    steps: [
      { num: '01', module: 'Forms + Cross-Reference', title: 'New hire submits the Onboarding form', description: 'HR builds an Employee Onboarding form with drag-and-drop. Cross-reference fields link the new hire to the Departments and Users tables so data stays consistent — no duplicate dropdowns to maintain.', bullets: ['Drag-and-drop fields: text, email, date, file upload, cross-reference', 'Cross-ref to Departments and Reporting Manager records', 'Conditional logic, validation, and field-level access control'], image: onbForm, alt: 'Drag-and-drop form builder for Employee Onboarding', icon: FileText },
      { num: '02', module: 'Workflow Automation', title: 'A visual workflow takes over instantly', description: 'The moment the form is submitted, a visual workflow kicks off. No code — just connected nodes that create the IT request, notify the manager, and queue HR tasks in parallel.', bullets: ['Trigger on form submission — runs in seconds', 'Branch into IT, Email, KB, and Tasks in parallel', 'Versioned, testable, and fully audited'], image: onbWorkflow, alt: 'Visual workflow automation canvas', icon: Workflow },
      { num: '03', module: 'IT Asset Management', title: 'Laptop, monitor & licenses get assigned', description: 'The workflow opens an asset request in ITAM. IT picks the right hardware, assigns software licenses, and tags everything to the new hire.', bullets: ['Auto-create asset requests from workflow nodes', 'Hardware + software license assignment in one view', 'Full asset lifecycle: requested → active → returned'], image: onbItam, alt: 'IT Asset Management with assigned hardware', icon: Monitor },
      { num: '04', module: 'Email Templates', title: 'Personalised welcome emails go out', description: 'Manager and welcome emails fire from reusable templates with merge tags — straight from the submission, no copy-paste.', bullets: ['Reusable templates with merge tags', 'Triggered from workflow with delivery logs', 'SMTP support: Gmail, Hostinger, custom providers'], image: onbEmail, alt: 'Email template editor', icon: Mail },
      { num: '05', module: 'Knowledge Base', title: 'Onboarding docs assigned automatically', description: 'The new hire lands in the KB with the right folder pre-assigned: Welcome Guide, IT Setup, Code of Conduct, Benefits — all version-controlled.', bullets: ['Folder-based docs with rich content and video', 'Versioning, approvals, and acknowledgement tracking', 'Granular access by role or department'], image: onbKb, alt: 'Knowledge Base onboarding folder', icon: BookOpen },
      { num: '06', module: 'Data Feed', title: 'HRMS stays in sync, every 15 minutes', description: 'A scheduled data feed pulls employee master data from your HRMS, maps fields, resolves cross-references, and writes back — no manual re-entry.', bullets: ['5-step pipeline: source → mapping → resolver → schedule → run', 'Cross-reference resolver up to 10 levels deep', 'Run history with row counts, errors, and replay'], image: onbData, alt: 'Data feed pipeline', icon: Database },
      { num: '07', module: 'Reports & Dashboards', title: 'HR leaders see the full picture', description: 'Every step becomes a data point. The Onboarding Insights dashboard surfaces hires by department, cycle time, completion rate, and pending tasks — live.', bullets: ['KPI cards, charts, drill-down tables', 'Custom ranges, filters, and exports', 'Embed dashboards into the home page'], image: onbReports, alt: 'Onboarding analytics dashboard', icon: BarChart3 },
      { num: '08', module: 'Relationship Map', title: 'One graph shows everything connected', description: 'Open the relationship map for any new hire to see every linked record — department, manager, assets, KB articles, and emails sent. Audit-ready.', bullets: ['Bidirectional record map up to 3 levels deep', 'Click any node to open the source record', 'Perfect for audits, handoffs, and offboarding'], image: onbRel, alt: 'Relationship map for a new hire', icon: Network },
    ],
  },
  {
    id: 'grc',
    label: 'GRC',
    title: <>Governance, Risk &amp; Compliance,<br /><span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">run on one connected platform</span></>,
    tagline: 'Follow a policy from draft to audit-ready — Policies, Frameworks, Risk, Controls, Workflows, Evidence, Findings, and Dashboards with full traceability.',
    chips: ['Policies', 'Frameworks', 'Risk Register', 'Controls', 'Workflows', 'Evidence', 'Findings', 'Dashboards'],
    scenarioTitle: 'The scenario: Getting ISO 27001 ready in 90 days',
    scenarioBody: 'The compliance lead drafts an Information Security Policy, maps it to ISO 27001 controls, logs related risks, routes it through approval, attaches evidence, tracks findings — and watches the compliance score climb on the executive dashboard.',
    steps: [
      { num: '01', module: 'Policy Form + Cross-Reference', title: 'Author a policy with the right structure from day one', description: 'The compliance team drafts a policy using a form built in minutes. Cross-references connect it to Controls, Owners, and Frameworks — every policy born linked.', bullets: ['Drag-and-drop intake: name, category, owner, effective date', 'Cross-ref to Controls, Frameworks, Departments', 'Versioning, attachments, and approval tracking'], image: grcPolicy, alt: 'Policy form with cross-references', icon: FileText },
      { num: '02', module: 'Compliance Frameworks', title: 'Map to ISO 27001, SOC 2, GDPR, HIPAA, NIST', description: 'Spin up any framework, import controls, and watch implementation progress roll up live. Each policy inherits the controls it satisfies.', bullets: ['ISO 27001, SOC 2, NIST CSF, HIPAA, GDPR, PCI DSS', 'Live implementation %, effectiveness, ownership', 'Custom frameworks for industry-specific needs'], image: grcFrameworks, alt: 'Compliance frameworks dashboard', icon: ShieldCheck },
      { num: '03', module: 'Risk Register', title: 'Quantify risk with a living heatmap', description: 'Capture risks in a structured register — likelihood, impact, score, owner. The heatmap surfaces what to act on first; every risk links to its mitigating controls.', bullets: ['Likelihood × Impact scoring with auto-coloured heatmap', 'Owner, mitigation status, and due-date tracking', 'Bidirectional links to policies, controls, findings'], image: grcRisk, alt: 'Risk register heatmap', icon: AlertTriangle },
      { num: '04', module: 'Workflow Automation', title: 'Policies route themselves for review and approval', description: 'Submission triggers a workflow: Compliance Review → Legal + Security approval → publish → auto-schedule next annual review. Zero email chasing.', bullets: ['Parallel approvals with role-based routing', 'Auto-publish and auto-schedule review cycles', 'Every step logged with comments and signatures'], image: grcWorkflow, alt: 'Policy approval workflow', icon: Workflow },
      { num: '05', module: 'Controls Library', title: 'Test controls, track effectiveness', description: 'Each control has an owner, status, and test history. Schedule tests, log results, and a failed test auto-creates a finding with a remediation task.', bullets: ['Granular attributes: status, effectiveness, last/next test', 'Test procedures with expected vs actual results', 'Failed test → finding → remediation task'], image: grcControls, alt: 'Controls library', icon: ListChecks },
      { num: '06', module: 'Evidence Locker', title: 'Audit-ready evidence in one place', description: 'Pen-test reports, access reviews, certificates, vendor SOC 2s — each tagged to controls. Expiry tracking nudges owners before evidence goes stale.', bullets: ['File, screenshot, log, certificate — all types', 'Map each artefact to controls or findings', 'Expiry alerts and collection-date tracking'], image: grcEvidence, alt: 'Evidence locker', icon: FolderLock },
      { num: '07', module: 'Audit Findings & Remediation', title: 'From finding to closure, tracked end-to-end', description: 'Auditors log findings with severity, root cause, and recommendation. Remediation fans out, evidence attaches, and closure requires verification.', bullets: ['Non-conformity, observation, OFI, strength', 'Severity, status, assignee, due, root cause, response', 'Verification gate before closure'], image: grcFindings, alt: 'Audit findings management', icon: ClipboardList },
      { num: '08', module: 'GRC Executive Dashboard', title: 'One screen the CISO actually trusts', description: 'Compliance score, open findings, overdue controls, policies pending review, risk heatmap — live. Drill into any tile. Board reports become one-click exports.', bullets: ['KPI cards, risk heatmap, donuts, trend lines', 'Drill-down from any chart to source records', 'Export to PDF / Excel for board reviews'], image: grcDash, alt: 'GRC executive dashboard', icon: BarChart3 },
    ],
  },
  {
    id: 'itsm',
    label: 'ITSM',
    title: <>IT Service Management,<br /><span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">from ticket to resolution</span></>,
    tagline: 'Replace the patchwork of help-desk tool, asset CMDB, knowledge wiki, and reporting scripts with one connected platform — incident to MTTR in days, not quarters.',
    chips: ['Incident', 'Service Request', 'SLA', 'ITAM', 'Knowledge Base', 'Workflows', 'Reports'],
    scenarioTitle: "The scenario: Priya can't connect to VPN",
    scenarioBody: 'Priya submits "VPN won\'t connect". TopSqill suggests two KB articles. She submits anyway. A workflow categorises it as Network/High, attaches her MacBook from ITAM, pages L1, and starts a 4-hour SLA. L1 resolves it in 22 minutes using the KB article. CSAT goes out automatically.',
    steps: [
      { num: '01', module: 'Forms + Cross-Reference', title: 'A user files an incident in seconds', description: 'The Incident form captures the issue with smart defaults — category, urgency, impacted asset (cross-referenced from ITAM), and attachments.', bullets: ['Drag-and-drop intake for incidents & requests', 'Cross-ref to Asset, Requester, and Site', 'File uploads, conditional fields, validation'], image: itsmIntake, alt: 'Incident intake form', icon: FileText },
      { num: '02', module: 'Workflow Automation', title: 'Auto-route, auto-assign, auto-escalate', description: 'The moment a ticket hits, a visual workflow categorises it, pages the right team, opens parallel sub-tasks, and starts the SLA clock — no manual triage.', bullets: ['Conditional routing by category, priority, location', 'Parallel branches for IT, Facilities, Security', 'Versioned and fully audited'], image: itsmWorkflow, alt: 'Incident routing workflow', icon: Workflow },
      { num: '03', module: 'SLA Management', title: 'Business-hour SLAs with predictive breach', description: 'Response and resolution targets respect business hours, holidays, and priority. Predictive breach warns you before you miss. L1→L4 escalation fires automatically.', bullets: ['Business-hour aware clocks per priority', 'Predictive breach warnings on at-risk tickets', 'L1–L4 escalation with email + in-app alerts'], image: itsmSla, alt: 'SLA management dashboard', icon: Timer },
      { num: '04', module: 'IT Asset Management', title: 'Every ticket linked to the affected asset', description: 'The agent sees the laptop, monitor, and licenses tied to the requester. One click opens warranty, prior incidents, installed software.', bullets: ['Tickets bound to hardware, software, contracts', 'Full asset history from the ticket', 'Asset-aware reports: MTTR by laptop model'], image: itsmAsset, alt: 'Asset linked to incident', icon: Monitor },
      { num: '05', module: 'Knowledge Base', title: 'Deflect tickets before they cost anyone time', description: 'Relevant KB articles surface inside the ticket and on the self-service portal. Users self-resolve common issues; agents close repeats with one click.', bullets: ['Suggested articles per category and keyword', 'Self-service portal with search and folders', 'Version-controlled with acknowledgements'], image: itsmKb, alt: 'KB suggestions in ticket', icon: BookOpen },
      { num: '06', module: 'Email Templates', title: 'Every status change communicates itself', description: 'Acknowledgement, assignment, on-hold, resolved, CSAT — all from reusable templates with merge tags.', bullets: ['Triggered from workflow with delivery logs', 'Merge tags: ticket_id, requester, eta, agent', 'SMTP: Gmail, Hostinger, custom providers'], image: itsmEmail, alt: 'Email template for tickets', icon: Mail },
      { num: '07', module: 'Reports & Dashboards', title: 'Service desk leaders see every signal', description: 'MTTR, first response, backlog, SLA compliance, agent leaderboard, CSAT — all live, drill-down.', bullets: ['KPI cards, trend lines, leaderboards, heatmaps', 'Filter by team, priority, asset model, location', 'Embed dashboards by role'], image: itsmReports, alt: 'ITSM analytics dashboard', icon: BarChart3 },
      { num: '08', module: 'Relationship Map', title: 'Audit-ready: one graph per ticket', description: 'Open the map for any ticket and trace it to the user, asset, KB article that resolved it, workflow run, and SLA result.', bullets: ['Bidirectional record map up to 3 levels deep', 'Click any node to open the source record', 'Perfect for post-mortems and audits'], image: itsmRel, alt: 'Relationship map for a ticket', icon: Network },
    ],
  },
  {
    id: 'vendor',
    label: 'Vendor Mgmt',
    title: <>Vendor &amp; Contract Management,<br /><span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">onboarded, audited, and renewed</span></>,
    tagline: 'One platform for vendor onboarding, contracts, risk, renewals, and spend — procurement, legal, finance, and security on one source of truth.',
    chips: ['Vendor Onboarding', 'Contracts', 'Risk', 'Renewals', 'Spend', 'Data Feeds', 'Reports'],
    scenarioTitle: 'The scenario: Onboarding a new SaaS vendor',
    scenarioBody: 'Procurement submits "Acme Analytics" with a draft MSA and SOC 2 report. A workflow opens Legal, Security and Finance reviews in parallel. Risk scoring tags Acme as Tier-2. Activation files the MSA with 90/60/30-day renewal reminders, ERP sync brings spend nightly, and the CFO dashboard updates live.',
    steps: [
      { num: '01', module: 'Forms + Cross-Reference', title: 'Vendor onboarding starts with one clean form', description: 'Procurement captures vendor info — category, risk tier, contacts, tax, certifications — with cross-references to Contracts and Internal Owner.', bullets: ['Drag-and-drop form for vendor master data', 'Cross-ref to Contracts, Categories, Owner', 'Required certifications, GDPR & W-9 uploads'], image: venForm, alt: 'Vendor onboarding form', icon: FileText },
      { num: '02', module: 'Workflow Automation', title: 'Due-diligence runs itself', description: 'Submission triggers compliance screening → legal review → security questionnaire → finance approval → activation. Every step timed and audited.', bullets: ['Parallel reviews for Legal, Security, Finance', 'Rejection routes back with comments', 'Auto-activate on final approval'], image: venWorkflow, alt: 'Due diligence workflow', icon: Workflow },
      { num: '03', module: 'Contract Repository', title: 'Every MSA, NDA, and SOW in one place', description: 'Contracts live as records linked to the vendor — versioned, signed, searchable. Track value, term, auto-renewal, obligations.', bullets: ['MSA / NDA / SOW / DPA types', 'Versioned files with audit history', 'Obligation tracking with owner + due dates'], image: venContracts, alt: 'Contract repository', icon: FileSignature },
      { num: '04', module: 'Data Feed', title: 'Vendor master stays in sync with ERP', description: 'A scheduled feed pulls payment status, spend, and bank details nightly. Cross-references resolve cleanly — no manual reconciliation.', bullets: ['5-step pipeline: source → mapping → resolver → schedule → run', 'Cross-reference resolver up to 10 levels deep', 'Run history with row counts and replay'], image: venData, alt: 'ERP data feed', icon: Database },
      { num: '05', module: 'Risk Assessment', title: 'Risk-tier every vendor — quantitatively', description: 'Score across financial, security, compliance, operational. Heatmap surfaces high-risk relationships. Re-assess on schedule.', bullets: ['Configurable scoring across 4 categories', 'Heatmap and risk-tier classification', 'Periodic re-assessment workflows'], image: venRisk, alt: 'Vendor risk heatmap', icon: ShieldAlert },
      { num: '06', module: 'Email Templates', title: 'Renewal reminders 90 / 60 / 30 days out', description: 'Scheduled emails ping the owner and vendor with term, value, and renewal link. No contract auto-renews by accident.', bullets: ['Scheduled reminders driven by contract dates', 'Merge tags: vendor, value, end-date, owner', 'Delivery logs and bounce tracking'], image: venEmail, alt: 'Renewal reminder email', icon: Mail },
      { num: '07', module: 'Reports & Dashboards', title: 'Spend, risk, and renewals on one screen', description: 'Live dashboards for total spend, vendor count, expiring contracts, risk distribution, and category breakdown.', bullets: ['KPI cards, charts, drill-down tables', 'Filter by category, region, owner, risk', 'Exports to PDF and Excel'], image: venReports, alt: 'Vendor analytics dashboard', icon: BarChart3 },
      { num: '08', module: 'Relationship Map', title: 'See everything connected to a vendor', description: 'One graph for any vendor: all contracts, internal owners, IT assets and licenses, related services, active workflows.', bullets: ['Bidirectional record map up to 3 levels deep', 'Trace spend, assets, and obligations in one view', 'Click any node to open the source record'], image: venRel, alt: 'Vendor relationship map', icon: Network },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    title: <>Information Security,<br /><span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">from first report to post-mortem</span></>,
    tagline: 'Replace the patchwork of inboxes, spreadsheets and chat threads with one connected security operations platform — detect, respond, remediate, and prove it.',
    chips: ['Incident Response', 'Vulnerabilities', 'Runbooks', 'SLA', 'Evidence', 'Workflows', 'CISO Reports'],
    scenarioTitle: 'The scenario: Suspected phishing in finance',
    scenarioBody: 'Rahul forwards a suspicious invoice email via "Report Phishing". TopSqill opens a P2 incident, attaches his laptop, starts a 1-hour SLA. SOC analyses the header, IT disables the URL, Comms drafts a warning. 47 minutes later it\'s contained, evidence captured, CISO dashboard live.',
    steps: [
      { num: '01', module: 'Forms + Cross-Reference', title: 'Anyone can report a security incident in seconds', description: 'Phishing, lost device, suspicious access — captured with severity, category, affected asset, and screenshots. Routed instantly, never lost in an inbox.', bullets: ['Templates for phishing, malware, data leak, lost device', 'Cross-ref to Asset, User, Site and Vulnerability', 'Public submission link for vendors and contractors'], image: secIntake, alt: 'Security incident intake form', icon: FileText },
      { num: '02', module: 'Workflow Automation', title: 'Triage → Contain → Eradicate → Recover → Post-mortem', description: 'A visual workflow drives every incident through the response playbook. Tasks fan out to SecOps, IT, Legal, and Communications in parallel.', bullets: ['Severity-based routing with parallel branches', 'Auto-create remediation tasks and evidence requests', 'Full audit log of every decision and handoff'], image: secWorkflow, alt: 'Incident response workflow', icon: Workflow },
      { num: '03', module: 'SLA Management', title: 'Severity-based response clocks with predictive breach', description: 'P1 in 15 minutes, P4 in 5 days — business-hour aware, with L1→L4 escalation. Predictive breach pages on-call before the clock runs out.', bullets: ['Per-severity response and resolution targets', 'Predictive breach with email + in-app alerts', 'L1–L4 escalation chains by severity'], image: secSla, alt: 'Severity-based SLA tracker', icon: Timer },
      { num: '04', module: 'Vulnerability Register', title: 'Track every CVE from discovery to closure', description: 'Vulnerabilities live as cross-referenced records linked to assets, owners, and remediation. Filter by CVSS, exploitability, age, business unit.', bullets: ['CVSS, exploitability, asset count per CVE', 'Auto-assign owner by asset or business unit', 'Aging dashboards and overdue alerts'], image: secVuln, alt: 'Vulnerability register', icon: Bug },
      { num: '05', module: 'IT Asset Management', title: 'Every incident bound to the affected asset', description: 'Open an incident and see the laptop, owner, installed software, prior incidents, and warranty — no guessing, no swivel-chair.', bullets: ['Tickets and vulnerabilities tied to hardware/software', 'Full asset history and ownership chain', 'Incident heatmaps by asset model or site'], image: secAsset, alt: 'Asset linked to incident', icon: Monitor },
      { num: '06', module: 'Knowledge Base', title: 'Runbooks and playbooks at the point of action', description: 'Phishing response, ransomware containment, lost-device wipe — every playbook in the KB, versioned, with acknowledgements, surfaced inside the ticket.', bullets: ['Versioned runbooks with read receipts', 'Suggested playbooks per incident category', 'Self-service portal for staff awareness'], image: secRunbook, alt: 'Phishing response runbook', icon: BookOpen },
      { num: '07', module: 'Reports & Dashboards', title: 'CISO sees MTTD, MTTR, and exposure live', description: 'Open incidents by severity, mean time to detect/respond, vulnerability backlog, top exploited assets — one dashboard per audience.', bullets: ['MTTD, MTTR, backlog, SLA compliance', 'Incident heatmaps by category, site, asset', 'Role-based boards: SOC, manager, CISO'], image: secDash, alt: 'Security ops dashboard', icon: BarChart3 },
      { num: '08', module: 'Relationship Map', title: 'Audit-ready: one graph per incident', description: 'Open the map for any incident and trace it to the user, asset, vulnerability, runbook used, and workflow run. Perfect for post-mortems.', bullets: ['Bidirectional record map up to 3 levels deep', 'Click any node to open the source record', 'Export evidence packs in one click'], image: secRel, alt: 'Incident relationship map', icon: Network },
    ],
  },
  {
    id: 'hr',
    label: 'HR',
    title: <>HR Management,<br /><span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">from offer letter to exit interview</span></>,
    tagline: 'Replace the patchwork of onboarding spreadsheets, leave trackers, review docs and HR inboxes with one connected platform — every stage of the employee lifecycle.',
    chips: ['Onboarding', 'Leave', 'Performance', 'Helpdesk', 'Policies', 'Workflows', 'Exit'],
    scenarioTitle: 'The scenario: Ananya joins on Monday',
    scenarioBody: 'HR fills the new-hire form Wednesday. A workflow fires: IT provisions her laptop, Finance opens payroll, Facilities allocates a seat, KB pushes policies for acknowledgement. Day one she logs in, books her first leave, raises a payroll query — handled within SLA.',
    steps: [
      { num: '01', module: 'Forms + Cross-Reference', title: 'Onboarding starts with one structured form', description: 'New-hire intake captures personal details, role, department, manager, location, and start date — cross-referenced to Org, Manager, and Site.', bullets: ['Drag-and-drop forms with conditional fields', 'Cross-ref to Department, Manager, Site, Asset', 'Document uploads with required validation'], image: hrEmp, alt: 'Employee onboarding form', icon: UserPlus },
      { num: '02', module: 'Workflow Automation', title: 'One employee record, the whole lifecycle', description: 'Onboarding → Confirmation → Transfers and Promotions → Performance → Exit. Each event triggers its own visual workflow with the right approvers.', bullets: ['Parallel branches for IT setup, payroll, facilities', 'Conditional approvers by role and department', 'Full audit log for every status change'], image: hrLifecycle, alt: 'HR lifecycle workflow', icon: Workflow },
      { num: '03', module: 'Leave & Attendance', title: 'Leave requests that approve themselves', description: 'Employees pick type and dates, see live balance, submit. Workflow routes to manager → HR with auto-reminders. Policy violations flagged early.', bullets: ['Casual, sick, earned, comp-off, WFH', 'Live balance from policy + accrual rules', 'Manager → HR approval with auto-escalation'], image: hrLeave, alt: 'Leave request form', icon: CalendarCheck },
      { num: '04', module: 'Performance & Goals', title: 'Goals, reviews and 360s without the email chaos', description: 'OKRs/KPIs per cycle, mid-year check-ins, annual reviews, 360 feedback — all connected forms. Calibration for HR, rating distribution for leadership.', bullets: ['Self → Peer → Manager → Skip-level → HR calibration', 'Goal completion %, rating distribution, 9-box', 'Per-cycle templates you fully control'], image: hrPerf, alt: 'Performance review form', icon: Award },
      { num: '05', module: 'Knowledge Base', title: 'Policies that employees actually read', description: 'Code of Conduct, leave policy, travel policy, ESOP guide — versioned, with mandatory acknowledgements tracked per employee.', bullets: ['Version-controlled policies with read receipts', 'Folder structure by audience and department', 'Self-service portal with full-text search'], image: hrPolicy, alt: 'HR policy KB', icon: BookOpen },
      { num: '06', module: 'HR Helpdesk + SLA + Email', title: 'Every HR query handled, on time', description: 'Payroll, benefits, IT setup, certificates — tickets with business-hour SLAs, auto-routed to the right HR partner, with templated email updates.', bullets: ['HR tickets with SLA timers and predictive breach', 'Auto-routing by category and location', 'Templated emails: ack, on-hold, resolved'], image: hrHelp, alt: 'HR helpdesk queue', icon: Mail },
      { num: '07', module: 'Reports & Dashboards', title: 'CHRO sees headcount, attrition, and engagement live', description: 'Headcount by department, attrition trend, leave balance, rating distribution, helpdesk volume — one dashboard per audience.', bullets: ['Headcount, joiners, leavers, attrition %', 'Leave balance trends and compliance', 'Role-based boards: manager, HRBP, CHRO'], image: hrDash, alt: 'HR analytics dashboard', icon: BarChart3 },
      { num: '08', module: 'Workflow + ITAM + Relationship Map', title: 'Exit done right — no loose ends', description: 'Resignation triggers exit: asset return (from ITAM), access revocation, knowledge transfer, final settlement, exit interview — every step tracked.', bullets: ['Asset return tied to the laptop in ITAM', 'Access revocation with timestamped audit', 'Knowledge transfer + final settlement checklist'], image: hrExit, alt: 'Employee exit checklist', icon: LogOut },
    ],
  },
];

const Timeline: React.FC<{ steps: Step[] }> = ({ steps }) => (
  <div className="relative max-w-6xl mx-auto">
    <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0 -translate-x-1/2" />
    <div className="space-y-16 md:space-y-24">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isLeft = i % 2 === 0;
        return (
          <div key={step.num} className="relative">
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-8 z-10 h-12 w-12 rounded-full bg-primary text-primary-foreground items-center justify-center font-bold shadow-lg ring-4 ring-background">
              {step.num}
            </div>
            <div className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${isLeft ? '' : 'md:[direction:rtl]'}`}>
              <div className="md:[direction:ltr]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="md:hidden h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                    {step.num}
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <Icon className="w-3 h-3 mr-1" />
                    {step.module}
                  </Badge>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-5">{step.description}</p>
                <ul className="space-y-2">
                  {step.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:[direction:ltr]">
                <div className="relative rounded-xl overflow-hidden border border-border shadow-2xl bg-card group">
                  <img
                    src={step.image}
                    alt={step.alt}
                    loading="lazy"
                    className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const Solutions: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const validIds = solutions.map((s) => s.id);
  const activeTab = initialTab && validIds.includes(initialTab) ? initialTab : 'onboarding';

  useEffect(() => {
    document.title = 'Solutions | TopSqill';
    const desc = 'Explore TopSqill solutions: Employee Onboarding, GRC, ITSM, Vendor Management, Information Security, and HR — all on one connected platform.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Nav */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link to="/" className="flex items-center space-x-3">
            <img
              src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png"
              alt="TopSqill Logo"
              className="w-10 h-10 object-contain"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              TopSqill
            </span>
          </Link>
          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link to="/" className="flex-1 sm:flex-initial">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <Link to="/auth" className="flex-1 sm:flex-initial">
              <Button size="sm" className="w-full sm:w-auto">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Page heading */}
      <header className="container mx-auto px-4 pt-12 md:pt-16 pb-6 text-center">
        <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary">
          <Sparkles className="w-3 h-3 mr-1" />
          Solutions
        </Badge>
        <h1 className="text-3xl md:text-5xl font-bold mb-3 leading-tight">
          One platform.{' '}
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Every business solution.
          </span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Pick a solution below to see it run end-to-end on TopSqill.
        </p>
      </header>

      {/* Tabs */}
      <section className="container mx-auto px-4 pb-20">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="sticky top-[72px] z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-border/50">
            <TabsList className="w-full h-auto flex flex-wrap justify-center gap-1 bg-muted/60 p-1">
              {solutions.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="text-xs md:text-sm">
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {solutions.map((s) => (
            <TabsContent key={s.id} value={s.id} className="mt-8">
              {/* Hero */}
              <div className="text-center py-10 md:py-14">
                <h2 className="text-3xl md:text-5xl font-bold mb-5 leading-tight">{s.title}</h2>
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-6">
                  {s.tagline}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {s.chips.map((c) => (
                    <Badge key={c} variant="outline" className="text-sm py-1 px-3">{c}</Badge>
                  ))}
                </div>
                <Link to="/auth">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80">
                    Try this scenario free for 30 days
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {/* Scenario */}
              <Card className="max-w-4xl mx-auto border-primary/20 bg-card/60 backdrop-blur mb-8">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-3 shrink-0">
                      <CheckCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-semibold mb-2">{s.scenarioTitle}</h3>
                      <p className="text-muted-foreground leading-relaxed">{s.scenarioBody}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              <div className="py-8 md:py-14">
                <Timeline steps={s.steps} />
              </div>

              {/* CTA */}
              <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/30">
                <CardContent className="p-8 md:p-12 text-center">
                  <h3 className="text-2xl md:text-3xl font-bold mb-3">
                    This is just one solution. Build yours in days.
                  </h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                    Anything that starts with a form and ends with a report can run on TopSqill.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/auth">
                      <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80">
                        Start Free 30-Day Trial
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    <Link to="/">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto">
                        Explore the Platform
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
};

export default Solutions;