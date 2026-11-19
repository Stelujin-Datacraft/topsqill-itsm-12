import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Layers,
  Network,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Users,
  Workflow,
} from 'lucide-react';

export const GRC_SECTIONS = [
  { id: 'grc-capabilities', label: 'Capabilities' },
  { id: 'grc-how-it-works', label: 'How it works' },
  { id: 'grc-ai-workflows', label: 'AI workflows' },
  { id: 'grc-use-cases', label: 'Use cases' },
  { id: 'grc-faq', label: 'FAQ' },
] as const;

export const GRC_DEMO_ID = 'grc-demo';

export const GRC_HERO = {
  eyebrow: 'AI-Enabled GRC Management Platform',
  title: 'Governance, Risk and Compliance Software',
  titleHighlight: 'for Connected, Accountable Workflows',
  body:
    'Bring risk registers, compliance activities, policies, control evidence and audit actions into one connected GRC platform. TopSqill helps teams capture information, assign ownership, automate reviews and approvals, track remediation and report on progress without relying on disconnected spreadsheets and inboxes.',
  chips: ['Configurable forms', 'Workflow automation', 'Approval chains', 'SQL reporting', 'Full audit trails'],
};

export const GRC_SAMPLE_DASHBOARD = {
  title: 'GRC Workspace · Enterprise Risk Overview',
  kpis: [
    { label: 'Open risks', value: '128', note: '12 new this month' },
    { label: 'High risks', value: '14', note: '3 above appetite', tone: 'danger' as const },
    { label: 'Controls tested', value: '82%', note: 'Q4 testing cycle' },
    { label: 'Overdue actions', value: '9', note: 'Escalated to owners', tone: 'warning' as const },
  ],
  /** Risk counts. Rows run from likelihood 5 (top) to 1; columns from impact 1 to 5. */
  heatmap: [
    [2, 3, 5, 4, 3],
    [3, 4, 6, 5, 2],
    [4, 6, 8, 4, 2],
    [5, 7, 6, 3, 1],
    [6, 5, 4, 2, 1],
  ],
  frameworks: [
    { name: 'ISO 27001', value: 84 },
    { name: 'SOC 2', value: 71 },
    { name: 'DPDP Act', value: 58 },
    { name: 'Internal policies', value: 92 },
  ],
  overdue: [
    { task: 'Privileged access review – Finance', days: 6 },
    { task: 'Vendor SOC report renewal', days: 4 },
    { task: 'Backup restore test evidence', days: 2 },
  ],
  policies: [
    { name: 'Acceptable AI Use Policy v2', stage: 'Legal review' },
    { name: 'Data Retention Policy', stage: 'CISO approval' },
    { name: 'Third-Party Risk Policy', stage: 'Final sign-off' },
  ],
};

export const GRC_WHAT_IS = {
  title: 'What is TopSqill GRC?',
  paragraphs: [
    'TopSqill GRC is configurable governance, risk and compliance software built on the TopSqill platform. It brings together structured forms, workflow automation, approval chains, SQL-based reporting and audit trails so risk, compliance, security and audit teams can run their GRC programme as connected, accountable workflows.',
    'Instead of buying separate tools for risk registers, policy approvals and audit evidence, teams configure each process on one shared data layer. Every record has an owner, every approval is logged, and every report draws on the same source of information.',
  ],
};

export const GRC_CHALLENGES = {
  eyebrow: 'The challenge',
  title: 'Replace Fragmented GRC Processes with a Connected Approach',
  body:
    'Most GRC programmes do not fail for lack of effort. They slow down because information lives in spreadsheets, email threads and shared drives that nobody fully owns. TopSqill replaces those gaps with structured records and governed workflows.',
  items: [
    {
      problem: 'Risk registers scattered across spreadsheets',
      problemBody: 'Multiple versions, inconsistent scoring and no single owner for each risk.',
      solution: 'One structured risk register built with configurable forms, with owners, scoring criteria, linked controls and full change history.',
    },
    {
      problem: 'Manual compliance tracking and regulatory updates',
      problemBody: 'Obligations live in personal trackers and regulatory changes reach owners late.',
      solution: 'Obligations and regulatory changes logged as records, routed to owners for impact assessment, with due dates and automated reminders.',
    },
    {
      problem: 'Repeated evidence collection during audits',
      problemBody: 'The same screenshots and documents are requested every audit cycle.',
      solution: 'Evidence collected once against each control, linked to the requirement and reused across audits and frameworks.',
    },
    {
      problem: 'Disconnected policy approvals and reviews',
      problemBody: 'Policies approved over email, outdated versions in circulation, no record of who read them.',
      solution: 'Drafting, review, approval, publishing and staff acknowledgement in one governed workflow with version history.',
    },
    {
      problem: 'Limited visibility into risks and remediation',
      problemBody: 'Leadership sees status only when someone builds a report by hand.',
      solution: 'Dashboards and SQL-based reporting across risks, controls, findings and tasks, drawn from live records.',
    },
  ],
};

export interface GrcCapability {
  icon: LucideIcon;
  title: string;
  body: string;
  link: string;
}

export const GRC_CAPABILITIES: { eyebrow: string; title: string; body: string; items: GrcCapability[] } = {
  eyebrow: 'Platform capabilities',
  title: 'Everything You Need to Manage Risk, Compliance and Governance',
  body:
    'Each GRC capability is configured on the same TopSqill platform, so risks, controls, policies, vendors and audit findings can reference each other instead of sitting in separate tools.',
  items: [
    {
      icon: ShieldAlert,
      title: 'Enterprise Risk Management',
      body: 'Maintain one enterprise risk register with consistent assessment criteria. Record likelihood, impact, inherent and residual risk, owners, treatment plans and linked controls, then review each risk on schedule.',
      link: 'See risk register workflows',
    },
    {
      icon: Scale,
      title: 'Compliance Management',
      body: 'Track regulatory obligations and internal requirements for frameworks such as ISO 27001, SOC 2, GDPR or India’s DPDP Act. Assign owners, schedule assessments and automate reminders.',
      link: 'Explore compliance tracking',
    },
    {
      icon: ShieldCheck,
      title: 'Internal Controls Management',
      body: 'Document each control, map it to the risks and requirements it addresses, schedule control tests and record results. A failed test can open a remediation task automatically.',
      link: 'View controls workflows',
    },
    {
      icon: ClipboardCheck,
      title: 'Audit and Evidence Management',
      body: 'Plan audits, request evidence through structured forms, record findings and track corrective actions to closure. Every submission, edit and approval is captured in the audit log.',
      link: 'See audit management',
    },
    {
      icon: FileText,
      title: 'Policy Lifecycle Management',
      body: 'Draft, review, approve, publish and retire policies through configurable approval chains. Store approved versions in the knowledge base and collect employee acknowledgements.',
      link: 'Explore policy management',
    },
    {
      icon: Bot,
      title: 'AI Governance and Risk Management',
      body: 'Run a structured intake for every AI tool, model or use case. Assess data, security, legal and ethical risk, route approvals and keep an inventory of approved AI usage.',
      link: 'See AI governance workflows',
    },
    {
      icon: Building2,
      title: 'Vendor and Third-Party Risk Management',
      body: 'Onboard vendors with due diligence questionnaires, tier them by risk, collect certificates and contracts, and schedule periodic reassessments alongside TopSqill Vendor Management.',
      link: 'Explore vendor risk management',
    },
    {
      icon: BarChart3,
      title: 'Risk Analytics and Reporting',
      body: 'Build dashboards for leadership and risk committees, and query GRC data directly with SQL or AI Query. Join risks, controls, findings and tasks across forms and export results.',
      link: 'See GRC reporting',
    },
  ],
};

export const GRC_HOW_IT_WORKS = {
  eyebrow: 'How it works',
  title: 'How Does TopSqill GRC Software Work? From Risk Identification to Resolution',
  body:
    'TopSqill GRC software works in six connected steps: information is captured through forms, assessed against your criteria, assigned to owners, remediated through tracked tasks, monitored on dashboards and reported to management.',
  steps: [
    { title: 'Capture', body: 'Submit risks, incidents, issues or compliance information through configurable forms with required fields and attachments.' },
    { title: 'Assess', body: 'Score likelihood and impact against your methodology, link affected controls and identify gaps.' },
    { title: 'Assign', body: 'Route each record to owners and approvers by business unit, risk level or category.' },
    { title: 'Remediate', body: 'Create remediation tasks with deadlines, reminders and escalations for overdue actions.' },
    { title: 'Monitor', body: 'Track progress, evidence and outstanding actions. Every change is recorded in the audit log.' },
    { title: 'Report', body: 'Generate management dashboards and SQL reports for committees, boards and auditors.' },
  ],
};

export type GrcAiStatus = 'available' | 'configurable';

export const GRC_AI = {
  eyebrow: 'AI-powered GRC',
  title: 'Bring AI Assistance into Your GRC Workflows',
  body:
    'TopSqill already uses AI to help teams build forms and workflows faster: describe the process you need and TopSqill generates a starting point you review and adjust. On that foundation, organisations can configure AI-assisted steps inside their GRC workflows.',
  legend: {
    available: { label: 'Available now', description: 'Current platform capability' },
    configurable: { label: 'Configurable', description: 'Set up on TopSqill; scope confirmed in your demo' },
  } satisfies Record<GrcAiStatus, { label: string; description: string }>,
  items: [
    { status: 'available', title: 'AI-assisted workflow and form creation', body: 'Describe a risk assessment, policy review or vendor questionnaire and generate the form and workflow structure to refine.' },
    { status: 'available', title: 'AI Query for GRC reporting', body: 'Ask questions about your GRC data in plain language alongside SQL-based reporting.' },
    { status: 'configurable', title: 'AI-assisted risk assessment', body: 'Suggest likelihood, impact and related risks from submitted information for the risk owner to confirm.' },
    { status: 'configurable', title: 'AI-assisted policy drafting', body: 'Produce first drafts or update suggestions aligned to your policy template, for reviewer approval.' },
    { status: 'configurable', title: 'Control and framework mapping suggestions', body: 'Suggest which existing controls may satisfy a new requirement across frameworks.' },
    { status: 'configurable', title: 'AI governance intake and review', body: 'Summarise new AI tool requests and flag data, security and legal questions for reviewers.' },
    { status: 'configurable', title: 'Evidence classification and review', body: 'Suggest which control an uploaded document relates to and highlight missing evidence.' },
    { status: 'configurable', title: 'Risk reporting and summaries', body: 'Draft plain-language summaries of risk status and remediation progress for management.' },
  ] satisfies { status: GrcAiStatus; title: string; body: string }[],
  humanInTheLoop:
    'AI suggestions in TopSqill support decisions; they do not make them. Every AI-generated output requires human validation, approvals are completed only by authorised users, and actions are recorded in the audit log.',
};

export interface GrcIndustry {
  id: string;
  industry: string;
  title: string;
  body: string;
  bullets: string[];
  frameworks: string;
  link: string;
}

export const GRC_INDUSTRIES: { eyebrow: string; title: string; body: string; note: string; items: GrcIndustry[] } = {
  eyebrow: 'Use cases by industry',
  title: 'GRC Workflows Designed Around Your Industry',
  body: 'Every industry has its own regulators, risks and audit cycles. Because TopSqill workflows are configurable, each team can model the process it actually runs.',
  note: 'Frameworks are examples of what teams track on TopSqill.',
  items: [
    {
      id: 'it',
      industry: 'IT and Software',
      title: 'Continuous SOC 2 and ISO 27001 Readiness',
      body: 'Keep audit evidence current all year instead of rebuilding it before every audit. Control owners upload evidence on schedule and access reviews run with manager sign-off.',
      bullets: ['Quarterly user access reviews with approver sign-off', 'Control evidence requests with due dates and reminders', 'Audit findings tracked to closure with full history'],
      frameworks: 'SOC 2, ISO 27001, NIST CSF',
      link: 'See the software compliance workflow',
    },
    {
      id: 'bfsi',
      industry: 'Banking and Financial Services',
      title: 'Regulatory Change and Operational Risk',
      body: 'Turn every new regulatory circular into an owned, trackable action. Business heads assess impact, implement changes and record operational risk events in one register.',
      bullets: ['Log circulars and assign impact assessments', 'Track implementation to closure with evidence', 'Record and review operational risk events and losses'],
      frameworks: 'RBI, SEBI, AML/KYC, Basel operational risk',
      link: 'See the BFSI compliance workflow',
    },
    {
      id: 'healthcare',
      industry: 'Healthcare',
      title: 'Patient Data Privacy Incident Management',
      body: 'Report, investigate and resolve patient data privacy incidents with clear escalation. Every step, from first report to corrective action, is recorded for regulators.',
      bullets: ['Incident reporting form for staff across sites', 'Severity-based escalation to the privacy officer', 'Root cause analysis and corrective action tracking'],
      frameworks: 'HIPAA, DPDP Act, NABH',
      link: 'See the healthcare privacy workflow',
    },
    {
      id: 'manufacturing',
      industry: 'Manufacturing',
      title: 'HSE Incidents and Supplier Quality Audits',
      body: 'Capture health, safety and environment incidents from the shop floor and run supplier audits on a fixed schedule, with corrective actions owned and tracked.',
      bullets: ['Mobile-friendly HSE incident and near-miss reporting', 'Scheduled supplier quality audits with checklists', 'Corrective and preventive actions (CAPA) with deadlines'],
      frameworks: 'ISO 45001, ISO 14001, ISO 9001',
      link: 'See the manufacturing risk workflow',
    },
    {
      id: 'retail',
      industry: 'Retail',
      title: 'Payment Security and Store Compliance',
      body: 'Track payment card security controls across stores and online channels, and run store-level compliance checks that roll up into one dashboard.',
      bullets: ['PCI DSS control ownership and evidence collection', 'Store compliance checklists with photo evidence', 'Regional dashboards of open issues by store'],
      frameworks: 'PCI DSS, consumer protection rules',
      link: 'See the retail compliance workflow',
    },
    {
      id: 'education',
      industry: 'Education',
      title: 'Student Data Privacy and Accreditation Evidence',
      body: 'Handle student data requests on time and collect accreditation evidence from every department without chasing spreadsheets before review visits.',
      bullets: ['Student and parent data request intake and tracking', 'Department-wise accreditation evidence collection', 'Policy acknowledgements for faculty and staff'],
      frameworks: 'DPDP Act, FERPA, NAAC and accreditation bodies',
      link: 'See the education compliance workflow',
    },
    {
      id: 'energy',
      industry: 'Energy and Utilities',
      title: 'Safety Inspections and Permit Compliance',
      body: 'Schedule site safety inspections, track permits and licences before they expire, and meet regulatory reporting deadlines from one calendar of obligations.',
      bullets: ['Recurring site inspection forms with findings', 'Permit and licence expiry tracking with reminders', 'Regulatory reporting tasks with owner and due date'],
      frameworks: 'Sector regulators, ISO 55001, environmental permits',
      link: 'See the energy compliance workflow',
    },
    {
      id: 'professional-services',
      industry: 'Professional Services',
      title: 'Conflicts, Confidentiality and Engagement Risk',
      body: 'Run annual declarations and engagement risk reviews across every partner and employee, with a complete record of who declared what and when.',
      bullets: ['Annual conflict-of-interest declarations', 'Client confidentiality attestations', 'New engagement risk review and approval'],
      frameworks: 'ISO 27001, client contractual obligations',
      link: 'See the professional services workflow',
    },
    {
      id: 'real-estate',
      industry: 'Real Estate',
      title: 'Contractor Due Diligence and Property Compliance',
      body: 'Vet contractors and vendors before work starts and track property compliance inspections, so expired certificates never go unnoticed.',
      bullets: ['Contractor and vendor due diligence questionnaires', 'Fire safety and building certificate tracking', 'Site inspection findings with remediation tasks'],
      frameworks: 'RERA, fire and building safety codes',
      link: 'See the real estate risk workflow',
    },
  ],
};

export const GRC_WHY = {
  eyebrow: 'Why TopSqill',
  title: 'Why Choose TopSqill for GRC Management?',
  body:
    'Organisations choose TopSqill when they want a GRC platform that fits their existing processes, connects GRC with operational workflows such as ITSM, information security, vendor management and HR, and keeps every decision traceable.',
  items: [
    { icon: Network, title: 'Connected operational workflows', body: 'GRC runs on the same platform as ITSM, information security, vendor management and HR, so related records share one trail.' },
    { icon: Workflow, title: 'Configurable processes', body: 'Build forms, scoring models and approval chains with drag-and-drop builders that match your methodology.' },
    { icon: Layers, title: 'Centralised information', body: 'Risks, controls, policies, evidence and findings live on one data layer with cross-references.' },
    { icon: Sparkles, title: 'AI-assisted operations', body: 'Generate forms and workflows faster with AI, and add AI-assisted review steps with human approval.' },
    { icon: BarChart3, title: 'Connected reporting and analytics', body: 'Dashboards, SQL queries across forms and exports give leadership one consistent view.' },
    { icon: UserCheck, title: 'Clear ownership and accountability', body: 'Every risk, control, task and policy has a named owner, a due date and an escalation path.' },
    { icon: FileCheck2, title: 'Auditability and traceability', body: 'Governed access and full audit trails record who submitted, changed or approved what, and when.' },
  ] satisfies { icon: LucideIcon; title: string; body: string }[],
  comparison: {
    title: 'TopSqill vs spreadsheet-based GRC',
    columns: ['Area', 'Spreadsheets and email', 'TopSqill GRC'],
    rows: [
      ['Ownership', 'Implied, often unclear', 'Named owner on every record'],
      ['Approvals', 'Email threads', 'Configurable approval chains, logged'],
      ['Evidence', 'Requested again each audit', 'Collected once, linked to controls'],
      ['Audit trail', 'Manual, incomplete', 'Automatic record of every action'],
      ['Reporting', 'Built by hand', 'Live dashboards and SQL reporting'],
      ['Process changes', 'New file versions', 'Reconfigure forms and workflows'],
    ],
  },
};

export const GRC_USE_CASE = {
  eyebrow: 'End-to-end use case',
  title: 'Use Case: Governing a New AI Coding Assistant from Intake to Board Report',
  body:
    'A 600-person software company wants to roll out an AI coding assistant to its engineering team. Here is how the request moves through TopSqill GRC as one connected AI governance workflow.',
  note: 'Illustrative example.',
  steps: [
    { icon: Bot, title: 'AI tool intake', role: 'Engineering manager', body: 'Submits the AI tool request: vendor, use case, teams, data accessed and repositories in scope.', output: 'AI inventory record' },
    { icon: Target, title: 'Risk assessment', role: 'AI governance lead', body: 'Scores data leakage, IP, licensing and security risk; AI can suggest related risks for review.', output: 'Risk rating' },
    { icon: ShieldCheck, title: 'Security review', role: 'CISO team', body: 'Reviews vendor security documents, data retention and access controls; requests missing evidence.', output: 'Security approval' },
    { icon: Scale, title: 'Legal approval', role: 'Legal counsel', body: 'Reviews terms of use, IP ownership and data processing terms through the approval chain.', output: 'Legal sign-off' },
    { icon: Users, title: 'Policy acknowledgement', role: 'Compliance team', body: 'Publishes the Acceptable AI Use policy; engineers acknowledge before access is granted.', output: 'Acknowledgements' },
    { icon: ClipboardCheck, title: 'Evidence collection', role: 'Control owners', body: 'Configuration, access review and training evidence attached to the relevant controls.', output: 'Reusable evidence' },
    { icon: BarChart3, title: 'Management reporting', role: 'CRO / CIO', body: 'Dashboard shows approved AI tools, open conditions and outstanding acknowledgements.', output: 'Board-ready report' },
  ] satisfies { icon: LucideIcon; title: string; role: string; body: string; output: string }[],
  summary:
    'One request, seven accountable steps, a complete audit trail, and evidence ready for the next ISO 27001 or SOC 2 audit.',
};

export const GRC_FAQ = {
  eyebrow: 'FAQ',
  title: 'GRC Software FAQs',
  items: [
    {
      q: 'What is GRC software?',
      a: 'GRC software is a platform that helps organisations manage governance, risk management and compliance in one place. It centralises risk registers, policies, controls, compliance obligations and audit evidence, and automates the reviews, approvals and reporting that connect them.',
    },
    {
      q: 'What does a GRC platform do?',
      a: 'A GRC platform records risks and obligations, assigns owners, routes assessments and approvals, tracks remediation and stores audit evidence. It then reports on risk exposure and compliance status so leadership can make informed decisions. TopSqill does this through configurable forms, workflow automation and SQL-based reporting.',
    },
    {
      q: 'What are the three pillars of GRC?',
      a: 'The three pillars are governance, risk management and compliance. Governance sets direction, policies and accountability. Risk management identifies, assesses and treats risks to objectives. Compliance ensures the organisation meets laws, regulations, standards and internal policies.',
    },
    {
      q: 'How does GRC software work?',
      a: 'GRC software captures information through structured forms, evaluates it against defined criteria, assigns ownership and approvals, and tracks follow-up actions to completion. Each action is logged, and dashboards give a live view of risk, compliance and audit status.',
    },
    {
      q: 'What is the difference between GRC and ERM?',
      a: 'Enterprise risk management (ERM) focuses on identifying and managing risks that affect strategic and business objectives. GRC is broader: it combines risk management with governance and compliance. In practice, ERM is one component of a GRC programme, and enterprise risk management software is often part of a GRC platform.',
    },
    {
      q: 'What are the benefits of GRC automation?',
      a: 'GRC automation reduces manual tracking, reminders and evidence chasing. It creates consistent assessments, faster approvals, clear accountability, complete audit trails and up-to-date reporting. Compliance automation software also lowers the chance of missed deadlines and outdated policies.',
    },
    {
      q: 'How does AI support GRC management?',
      a: 'AI can speed up repetitive GRC work: drafting policies, suggesting risk ratings, mapping controls to frameworks, classifying evidence and summarising reports. Human reviewers should validate every AI output, and authorised users should make final approval decisions.',
    },
    {
      q: 'What is AI governance?',
      a: 'AI governance is the set of policies, processes and controls an organisation uses to approve, monitor and manage AI systems responsibly. It covers AI use case intake, risk assessment, data protection, security, legal review and ongoing oversight. The NIST AI RMF, ISO/IEC 42001 and the EU AI Act are common references.',
    },
    {
      q: 'How does GRC software support audit readiness?',
      a: 'GRC software links evidence to the controls and requirements it supports, records every approval and change in an audit log, and tracks findings through to closure. When an audit begins, teams can show current evidence and history instead of collecting it from scratch.',
    },
    {
      q: 'How do organisations manage compliance across multiple frameworks?',
      a: 'They map each control once to every framework requirement it satisfies, such as ISO 27001, SOC 2 and GDPR. Evidence collected for that control then supports all mapped frameworks, reducing duplicate work. A GRC platform keeps these mappings, owners and test results in one place.',
    },
  ],
};

export const GRC_DEMO = {
  title: 'Bring Your Risk, Compliance and Governance Workflows Together',
  body: 'See how TopSqill can help your organisation manage risk, coordinate compliance activities and improve visibility across GRC operations.',
  youWillSee: [
    'Your risk register, control and policy workflows configured on TopSqill',
    'Approval chains, evidence collection and audit trails in action',
    'Dashboards and SQL reporting built from your GRC data',
  ],
  priorities: [
    'Enterprise risk management',
    'Compliance management',
    'Internal controls',
    'Audit and evidence',
    'Policy lifecycle',
    'AI governance',
    'Vendor and third-party risk',
    'Risk reporting',
  ],
  email: 'contact@topsqill.com',
};

/** Builds the mailto link the demo form opens; the site has no lead-capture backend. */
export function grcDemoMailto(values: { name: string; company: string; email: string; role: string; priority: string }): string {
  const subject = `TopSqill GRC demo request — ${values.company || values.name || 'Prospect'}`;
  const body = [
    `Full name: ${values.name}`,
    `Company: ${values.company}`,
    `Work email: ${values.email}`,
    `Job role: ${values.role || '(not specified)'}`,
    `Main GRC priority: ${values.priority || '(not specified)'}`,
  ].join('\n');
  return `mailto:${GRC_DEMO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Severity of a heatmap cell from its likelihood and impact (each 1–5); the cell's number is a risk count. */
export function heatBand(likelihood: number, impact: number): 'low' | 'medium' | 'high' | 'critical' {
  const score = likelihood * impact;
  if (score >= 15) return 'critical';
  if (score >= 9) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}
