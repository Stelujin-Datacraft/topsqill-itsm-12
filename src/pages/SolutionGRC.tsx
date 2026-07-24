import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight, ArrowLeft, FileText, ShieldCheck, AlertTriangle, Workflow,
  ListChecks, FolderLock, ClipboardList, BarChart3, CheckCircle, Sparkles,
  TrendingDown, Clock, Users, Layers, Link2, Lock,
} from 'lucide-react';
import policyImg from '@/assets/solution-grc/01-policy-form.jpg';
import frameworksImg from '@/assets/solution-grc/02-frameworks.jpg';
import riskImg from '@/assets/solution-grc/03-risk-register.jpg';
import workflowImg from '@/assets/solution-grc/04-workflow.jpg';
import controlsImg from '@/assets/solution-grc/05-controls.jpg';
import evidenceImg from '@/assets/solution-grc/06-evidence.jpg';
import findingsImg from '@/assets/solution-grc/07-audit-findings.jpg';
import dashboardImg from '@/assets/solution-grc/08-dashboard.jpg';

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

const steps: Step[] = [
  {
    num: '01',
    module: 'Policy Form + Cross-Reference',
    title: 'Author a policy with the right structure from day one',
    description:
      'The compliance team drafts an Information Security Policy using a form built in minutes. Cross-reference fields connect it to Controls, Owners, and the Compliance Standard — so every policy is born linked to what it governs.',
    bullets: [
      'Drag-and-drop policy intake: name, category, owner, effective date, review cycle',
      'Cross-reference to Controls, Frameworks, Departments, and Risk owners',
      'Versioning, attachments, and approval tracking built in',
    ],
    image: policyImg,
    alt: 'Information Security Policy form with cross-reference to Controls table',
    icon: FileText,
  },
  {
    num: '02',
    module: 'Compliance Frameworks',
    title: 'Map to ISO 27001, SOC 2, GDPR, HIPAA, NIST',
    description:
      'Spin up any framework, import controls, and watch implementation progress roll up in real time. Each policy automatically inherits the controls it satisfies — one source of truth across standards.',
    bullets: [
      'Out-of-the-box: ISO 27001, SOC 2, NIST CSF, HIPAA, GDPR, PCI DSS',
      'Live implementation %, effectiveness, and ownership per control',
      'Custom frameworks for industry-specific requirements',
    ],
    image: frameworksImg,
    alt: 'Compliance Frameworks dashboard showing ISO 27001, SOC 2, GDPR with progress bars',
    icon: ShieldCheck,
  },
  {
    num: '03',
    module: 'Risk Register',
    title: 'Quantify risk with a living heatmap',
    description:
      'Capture risks in a structured register — likelihood, impact, score, owner, mitigation status. The risk heatmap surfaces what to act on first, and every risk links back to the controls and policies that mitigate it.',
    bullets: [
      'Likelihood × Impact scoring with auto-coloured heatmap',
      'Owner assignment, mitigation status, due-date tracking',
      'Bidirectional links to policies, controls, and audit findings',
    ],
    image: riskImg,
    alt: 'Risk register table with risk score heatmap and mitigation status',
    icon: AlertTriangle,
  },
  {
    num: '04',
    module: 'Workflow Automation',
    title: 'Policies route themselves for review and approval',
    description:
      'Submission triggers a visual workflow: Compliance Review → Legal + Security approval → publish, notify stakeholders, and auto-schedule the next annual review. Zero email chasing, full audit trail.',
    bullets: [
      'Parallel approvals with role-based routing',
      'Auto-publish on approval, auto-schedule review cycle',
      'Every step logged with timestamps, comments, and signatures',
    ],
    image: workflowImg,
    alt: 'Visual workflow for policy approval and publish lifecycle',
    icon: Workflow,
  },
  {
    num: '05',
    module: 'Controls Library',
    title: 'Test controls, track effectiveness',
    description:
      'Each control has an owner, an implementation status, and a test history. Run control tests on schedule, log results, and trigger remediation the moment something fails — automatically opening an audit finding.',
    bullets: [
      'Granular control attributes: status, effectiveness, last tested, next test',
      'Test procedures with expected vs actual results',
      'Failed test → auto-create finding → assign remediation task',
    ],
    image: controlsImg,
    alt: 'Security controls library with implementation status and effectiveness',
    icon: ListChecks,
  },
  {
    num: '06',
    module: 'Evidence Locker',
    title: 'Audit-ready evidence in one place',
    description:
      'Upload pen-test reports, access reviews, certificates, vendor SOC 2s — each tagged to controls, policies, or findings. Expiry tracking nudges owners before evidence goes stale, so audits never get caught short.',
    bullets: [
      'File, screenshot, log, certificate, report — all evidence types',
      'Map each artefact to specific controls or findings',
      'Expiry alerts and collection-date tracking',
    ],
    image: evidenceImg,
    alt: 'Evidence locker showing reports, screenshots, and certificates mapped to controls',
    icon: FolderLock,
  },
  {
    num: '07',
    module: 'Audit Findings & Remediation',
    title: 'From finding to closure, tracked end-to-end',
    description:
      'Auditors log findings with severity, root cause, and recommendation. Remediation tasks fan out to owners, evidence gets attached, and closure requires verification — nothing slips through the cracks.',
    bullets: [
      'Finding types: non-conformity, observation, OFI, strength',
      'Severity, status, assignee, due date, root cause, response',
      'Verification gate before closure, with full lifecycle history',
    ],
    image: findingsImg,
    alt: 'Audit findings management with severity, status, and remediation tasks',
    icon: ClipboardList,
  },
  {
    num: '08',
    module: 'GRC Executive Dashboard',
    title: 'One screen the CISO actually trusts',
    description:
      'Compliance score, open findings, overdue controls, policies pending review, risk heatmap — refreshed live. Drill into any tile to reach the underlying record. Board reports become a one-click export.',
    bullets: [
      'KPI cards, risk heatmap, controls-by-status donut, findings-by-severity trend',
      'Drill-down from any chart to source records',
      'Export to PDF / Excel for board and audit committees',
    ],
    image: dashboardImg,
    alt: 'GRC executive dashboard with compliance score, risk heatmap, and findings charts',
    icon: BarChart3,
  },
];

const SolutionGRC: React.FC = () => {
  useEffect(() => {
    document.title = 'Governance, Risk & Compliance Solution | TopSqill';
    const desc = 'See how TopSqill runs end-to-end GRC across Policies, Controls, Risk Register, Workflows, Evidence Locker, Audit Findings, and Dashboards.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

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

      {/* Hero */}
      <header className="container mx-auto px-4 py-16 md:py-24 text-center">
        <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary">
          <Sparkles className="icon-xs mr-1" />
          Solution Spotlight
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          Governance, Risk &amp; Compliance,<br />
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            run on one connected platform
          </span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
          Follow a single policy from draft to audit-ready — and see how Policies, Frameworks,
          Risk, Controls, Workflows, Evidence, Findings, and Dashboards work together with
          full traceability and zero spreadsheets.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Policies', 'Frameworks', 'Risk Register', 'Controls', 'Workflows', 'Evidence', 'Findings', 'Dashboards'].map((t) => (
            <Badge key={t} variant="outline" className="text-sm py-1 px-3">{t}</Badge>
          ))}
        </div>
        <Link to="/auth">
          <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80">
            Try this scenario free for 30 days
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </header>

      {/* The use case */}
      <section className="container mx-auto px-4 pb-12">
        <Card className="max-w-4xl mx-auto border-primary/20 bg-card/60 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 shrink-0">
                <CheckCircle className="icon-xl text-primary" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-semibold mb-2">
                  The scenario: Getting ISO 27001 ready in 90 days
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  The compliance lead drafts an Information Security Policy, maps it to ISO 27001
                  controls, logs the related risks, routes it through approval, attaches test
                  evidence, tracks audit findings to closure — and watches the compliance score
                  climb on the executive dashboard. All in one platform.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Personas */}
      <section className="container mx-auto px-4 pb-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Built for the whole GRC team</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ShieldCheck, role: 'CISO', use: 'Live compliance posture, risk heatmap, board-ready reports' },
              { icon: ClipboardList, role: 'Compliance Lead', use: 'Frameworks, control mapping, audit cycles' },
              { icon: AlertTriangle, role: 'Risk Manager', use: 'Risk register, treatments, KRI tracking' },
              { icon: Users, role: 'Control Owners', use: 'Tasks, evidence uploads, control testing' },
            ].map(({ icon: Icon, role, use }) => (
              <Card key={role} className="bg-card/60 backdrop-blur">
                <CardContent className="p-5">
                  <Icon className="icon-xl text-primary mb-3" />
                  <h3 className="font-semibold mb-1">{role}</h3>
                  <p className="text-sm text-muted-foreground">{use}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="container mx-auto px-4 py-12 md:py-20">
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
                          <Icon className="icon-xs mr-1" />
                          {step.module}
                        </Badge>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed mb-5">
                        {step.description}
                      </p>
                      <ul className="space-y-2">
                        {step.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="icon-md text-primary mt-0.5 shrink-0" />
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
                          width={1536}
                          height={1024}
                          className="w-full h-auto block transition-transform duration-500 group-"
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
      </section>

      {/* Outcomes / Metrics */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Outcomes teams see in the first quarter</h2>
          <p className="text-center text-muted-foreground mb-8">Based on customers replacing spreadsheets and disconnected point tools.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Clock, stat: '70%', label: 'less time prepping for audits' },
              { icon: TrendingDown, stat: '4×', label: 'faster policy review cycles' },
              { icon: CheckCircle, stat: '100%', label: 'control evidence traceability' },
              { icon: BarChart3, stat: 'Real-time', label: 'compliance score & risk posture' },
            ].map(({ icon: Icon, stat, label }) => (
              <Card key={label} className="text-center bg-card/60 backdrop-blur">
                <CardContent className="p-6">
                  <Icon className="icon-xl text-primary mx-auto mb-3" />
                  <div className="text-3xl font-bold text-primary mb-1">{stat}</div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why it works */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Why TopSqill works for GRC</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Link2, title: 'Everything is connected', body: 'Policies link to controls, controls to risks, risks to findings, findings to evidence — one graph, full traceability.' },
              { icon: Layers, title: 'One framework, many standards', body: 'Map one control once and satisfy ISO 27001, SOC 2, NIST and GDPR in parallel. No duplicate work.' },
              { icon: Workflow, title: 'Automation, not chasing', body: 'Approvals, review reminders, evidence expiry, remediation SLAs — all automated with full audit trail.' },
              { icon: Lock, title: 'Granular access control', body: 'Field- and record-level permissions keep sensitive audit data only with the people who should see it.' },
              { icon: BarChart3, title: 'Live, drillable dashboards', body: 'Executive scorecards refresh in real time. Drill from any number to the underlying record in one click.' },
              { icon: FolderLock, title: 'Audit-ready by default', body: 'Every change is timestamped and attributed. Hand auditors a read-only view, not a Dropbox folder.' },
            ].map(({ icon: Icon, title, body }) => (
              <Card key={title} className="bg-card/60 backdrop-blur">
                <CardContent className="p-6">
                  <Icon className="icon-xl text-primary mb-3" />
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Modules in the platform */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <Card className="bg-card/60 backdrop-blur border-primary/20">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold mb-2">All powered by real modules in the platform</h2>
              <p className="text-muted-foreground mb-6">Every step above maps to a live module you can open today inside TopSqill.</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  ['Policies', '/policies'],
                  ['Compliance Frameworks', '/compliance'],
                  ['Audit Programs', '/audit-programs'],
                  ['Evidence Locker', '/evidence-locker'],
                  ['Workflows', '/workflows'],
                  ['Reports & Dashboards', '/reports'],
                  ['Forms', '/forms'],
                  ['Knowledge Base', '/knowledge-base'],
                  ['Relationship Map', '/relationship-map'],
                ].map(([label, href]) => (
                  <Link key={label} to={href} className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    <CheckCircle className="icon-md text-primary shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Common questions</h2>
          <div className="space-y-4">
            {[
              { q: 'Which frameworks are supported out of the box?', a: 'ISO 27001, SOC 2, NIST CSF, HIPAA, GDPR and PCI DSS ship preloaded. You can also build custom frameworks and map controls to multiple standards simultaneously.' },
              { q: 'Can one control satisfy multiple standards?', a: 'Yes. Map a control once and reuse it across every framework it satisfies. Evidence collected for that control counts for all linked standards.' },
              { q: 'How is evidence kept fresh?', a: 'Each evidence item carries a collection and expiry date. Owners get automated reminders before expiry so audits never catch stale artefacts.' },
              { q: 'Can auditors get read-only access?', a: 'Yes. Granular role and field-level permissions let you give auditors a scoped, read-only view of policies, controls, evidence and findings.' },
              { q: 'Does it work with our existing systems?', a: 'Data Feeds pull in users, assets, vulnerabilities and tickets from HRMS, ITAM, scanners and ticketing tools on schedule, so the register stays in sync.' },
            ].map(({ q, a }) => (
              <Card key={q} className="bg-card/60 backdrop-blur">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-2">{q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/30">
          <CardContent className="p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Stop juggling spreadsheets. Start passing audits.
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              TopSqill brings policies, risks, controls, evidence, and findings into one
              connected system — built for compliance teams that need to move fast and prove it.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80">
                  Start Free 30-Day Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/solutions/employee-onboarding">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  See the Onboarding Solution
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default SolutionGRC;