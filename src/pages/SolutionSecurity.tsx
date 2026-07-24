import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight, ArrowLeft, FileText, Workflow, Mail, Monitor,
  BookOpen, BarChart3, Network, CheckCircle, Sparkles, Timer,
  Users, ShieldAlert, Zap, ShieldCheck, Activity, Bug,
} from 'lucide-react';
import intakeImg from '@/assets/solution-security/01-incident-form.jpg';
import workflowImg from '@/assets/solution-security/02-workflow.jpg';
import slaImg from '@/assets/solution-security/03-sla.jpg';
import vulnImg from '@/assets/solution-security/04-vuln.jpg';
import assetImg from '@/assets/solution-security/05-asset.jpg';
import runbookImg from '@/assets/solution-security/06-runbook.jpg';
import dashImg from '@/assets/solution-security/07-dashboard.jpg';
import relImg from '@/assets/solution-security/08-relationships.jpg';

type Step = {
  num: string; module: string; title: string; description: string;
  bullets: string[]; image: string; alt: string;
  icon: React.ComponentType<{ className?: string }>;
};

const steps: Step[] = [
  {
    num: '01', module: 'Forms + Cross-Reference',
    title: 'Anyone can report a security incident in seconds',
    description: 'Phishing, lost device, suspicious access — captured with severity, category, affected asset, and screenshots. Routed instantly to the security team, never lost in an inbox.',
    bullets: ['Templates for phishing, malware, data leak, lost device', 'Cross-ref to Asset, User, Site and Vulnerability', 'Public submission link for vendors and contractors'],
    image: intakeImg, alt: 'Security incident intake form', icon: FileText,
  },
  {
    num: '02', module: 'Workflow Automation',
    title: 'Triage → Contain → Eradicate → Recover → Post-mortem',
    description: 'A visual workflow drives every incident through the response playbook. Tasks fan out to SecOps, IT, Legal, and Communications in parallel — nothing skipped, nothing forgotten.',
    bullets: ['Severity-based routing with parallel branches', 'Auto-create remediation tasks and evidence requests', 'Full audit log of every decision and handoff'],
    image: workflowImg, alt: 'Security incident response workflow', icon: Workflow,
  },
  {
    num: '03', module: 'SLA Management',
    title: 'Severity-based response clocks with predictive breach',
    description: 'P1 in 15 minutes, P4 in 5 days — business-hour aware, with L1→L4 escalation. Predictive breach pages on-call before the clock runs out.',
    bullets: ['Per-severity response and resolution targets', 'Predictive breach with email + in-app alerts', 'L1–L4 escalation chains by severity'],
    image: slaImg, alt: 'Severity-based SLA tracker', icon: Timer,
  },
  {
    num: '04', module: 'Vulnerability Register',
    title: 'Track every CVE from discovery to closure',
    description: 'Vulnerabilities live as cross-referenced records linked to assets, owners, and remediation workflows. Filter by CVSS, exploitability, age, or business unit.',
    bullets: ['CVSS, exploitability, asset count per CVE', 'Auto-assign owner by asset or business unit', 'Aging dashboards and overdue alerts'],
    image: vulnImg, alt: 'Vulnerability register table', icon: Bug,
  },
  {
    num: '05', module: 'IT Asset Management',
    title: 'Every incident bound to the affected asset',
    description: 'Open an incident and see the laptop, its owner, installed software, prior incidents, and warranty — no guessing, no spreadsheets, no swivel-chair.',
    bullets: ['Tickets and vulnerabilities tied to hardware and software', 'Full asset history and ownership chain', 'Incident heatmaps by asset model or site'],
    image: assetImg, alt: 'Asset linked to security incident', icon: Monitor,
  },
  {
    num: '06', module: 'Knowledge Base',
    title: 'Runbooks and playbooks at the point of action',
    description: 'Phishing response, ransomware containment, lost-device wipe — every playbook lives in the KB, versioned, with acknowledgements, and surfaced inside the ticket itself.',
    bullets: ['Versioned runbooks with read receipts', 'Suggested playbooks per incident category', 'Self-service portal for staff awareness'],
    image: runbookImg, alt: 'Phishing response runbook', icon: BookOpen,
  },
  {
    num: '07', module: 'Reports & Dashboards',
    title: 'CISO sees MTTD, MTTR, and exposure live',
    description: 'Open incidents by severity, mean time to detect/respond, vulnerability backlog, top exploited assets — one dashboard per audience, drill-down on every tile.',
    bullets: ['MTTD, MTTR, backlog, SLA compliance', 'Incident heatmaps by category, site, and asset', 'Role-based boards: SOC analyst, manager, CISO'],
    image: dashImg, alt: 'Security operations dashboard', icon: BarChart3,
  },
  {
    num: '08', module: 'Relationship Map',
    title: 'Audit-ready: one graph per incident',
    description: 'Open the relationship map for any incident and trace it to the user, asset, vulnerability, runbook used, and workflow run. Perfect for post-mortems, regulators, and the board.',
    bullets: ['Bidirectional record map up to 3 levels deep', 'Click any node to open the source record', 'Export evidence packs in one click'],
    image: relImg, alt: 'Relationship map for a security incident', icon: Network,
  },
];

const personas = [
  { icon: Users, role: 'Employees', desc: 'One-click report for phishing, lost devices, and suspicious activity.' },
  { icon: ShieldAlert, role: 'SOC Analysts', desc: 'Unified queue, asset context, suggested playbooks, parallel tasks.' },
  { icon: ShieldCheck, role: 'Security Manager', desc: 'SLA health, vuln backlog, team workload, evidence packs.' },
  { icon: Activity, role: 'CISO', desc: 'MTTD, MTTR, exposure, board-ready trend dashboards.' },
];

const outcomes = [
  { stat: '60%', label: 'faster mean time to respond' },
  { stat: '3×', label: 'incidents triaged with the same team' },
  { stat: '100%', label: 'audit traceability per incident' },
  { stat: '0', label: 'incidents lost in someone\'s inbox' },
];

const why = [
  { icon: Zap, title: 'Connected, not stitched', desc: 'Incidents, vulnerabilities, assets, runbooks, and workflows share one data model.' },
  { icon: Timer, title: 'Predictive SLAs', desc: 'Catch breach risk before it happens with business-hour aware predictions and L1–L4 escalation.' },
  { icon: BookOpen, title: 'Playbooks in context', desc: 'Runbooks surface inside the ticket — analysts follow the same steps every time.' },
  { icon: Workflow, title: 'No-code response automation', desc: 'Change routing, escalation and parallel tasks visually — no engineering tickets.' },
  { icon: BarChart3, title: 'Live exposure view', desc: 'CISO, manager and analyst each see what matters — no exports, no spreadsheets.' },
  { icon: Network, title: 'One graph, full audit', desc: 'Every incident links to assets, vulns, runbooks and workflow results for clean post-mortems.' },
];

const modules = [
  { name: 'Forms', path: '/forms' },
  { name: 'Workflows', path: '/workflows' },
  { name: 'SLA Management', path: '/sla-management' },
  { name: 'IT Assets', path: '/it-assets' },
  { name: 'Knowledge Base', path: '/knowledge-base' },
  { name: 'Email Templates', path: '/email-templates' },
  { name: 'Reports', path: '/reports' },
  { name: 'Relationship Map', path: '/relationship-map' },
];

const faqs = [
  { q: 'Does this replace a SIEM?', a: 'No — it sits next to your SIEM. Detections from SIEM/EDR can be pushed in via the public REST API or data feeds, and TopSqill owns the response, evidence and audit trail.' },
  { q: 'Can we model ISO 27001 / SOC 2 controls here?', a: 'Yes. Pair this with the GRC solution to map incidents and evidence directly to controls and frameworks.' },
  { q: 'How are severities and SLAs configured?', a: 'Severities are configurable per form, with business-hour aware SLA clocks per severity and L1–L4 escalation chains.' },
  { q: 'Can external users report incidents?', a: 'Yes. Public form links allow vendors, contractors and customers to submit reports without an account.' },
  { q: 'How is access controlled?', a: 'Roles, groups and record-level access protect sensitive incidents; access changes are audited end-to-end.' },
];

const SolutionSecurity: React.FC = () => {
  useEffect(() => {
    document.title = 'Information Security Management Solution | TopSqill';
    const desc = 'Run information security operations on TopSqill: incident response, vulnerability tracking, severity-based SLAs, runbooks, evidence, and CISO dashboards.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', desc);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link to="/" className="flex items-center space-x-3">
            <img src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png" alt="TopSqill Logo" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">TopSqill</span>
          </Link>
          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link to="/"><Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back to Home</Button></Link>
            <Link to="/auth"><Button size="sm">Start Free Trial<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </nav>

      <header className="container mx-auto px-4 py-16 md:py-24 text-center">
        <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary"><Sparkles className="icon-xs mr-1" />Solution Spotlight</Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          Information Security,<br />
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">from first report to post-mortem</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
          Replace the patchwork of email inboxes, spreadsheets and chat threads with one connected security operations platform — detect, respond, remediate, and prove it.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Incident Response','Vulnerabilities','Runbooks','SLA','Evidence','Workflows','CISO Reports'].map(t => <Badge key={t} variant="outline" className="text-sm py-1 px-3">{t}</Badge>)}
        </div>
        <Link to="/auth"><Button size="lg" className="bg-gradient-to-r from-primary to-primary/80">Try this scenario free for 30 days<ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
      </header>

      <section className="container mx-auto px-4 pb-12">
        <Card className="max-w-4xl mx-auto border-primary/20 bg-card/60 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 shrink-0"><CheckCircle className="icon-xl text-primary" /></div>
              <div>
                <h2 className="text-xl md:text-2xl font-semibold mb-2">The scenario: Suspected phishing in finance</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Rahul forwards a suspicious invoice email using the "Report Phishing" link. TopSqill opens a P2 incident, attaches his laptop from ITAM, and starts a 1-hour SLA. The workflow forks: SOC analyses the header, IT disables the linked URL, and Comms drafts an all-staff warning. The phishing runbook auto-attaches. 47 minutes later it's contained, evidence captured, and the CISO dashboard updates live.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Built for everyone in the security org</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {personas.map(p => (
              <Card key={p.role} className="border-primary/10">
                <CardContent className="p-5">
                  <div className="rounded-lg bg-primary/10 p-2 w-fit mb-3"><p.icon className="icon-lg text-primary" /></div>
                  <h3 className="font-semibold mb-1">{p.role}</h3>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-12">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {outcomes.map(o => (
            <Card key={o.label} className="text-center bg-gradient-to-br from-primary/10 to-background border-primary/20">
              <CardContent className="p-6">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{o.stat}</div>
                <div className="text-sm text-muted-foreground">{o.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="relative max-w-6xl mx-auto">
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0 -translate-x-1/2" />
          <div className="space-y-16 md:space-y-24">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isLeft = i % 2 === 0;
              return (
                <div key={step.num} className="relative">
                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-8 z-10 h-12 w-12 rounded-full bg-primary text-primary-foreground items-center justify-center font-bold shadow-lg ring-4 ring-background">{step.num}</div>
                  <div className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${isLeft ? '' : 'md:[direction:rtl]'}`}>
                    <div className="md:[direction:ltr]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="md:hidden h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">{step.num}</div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary"><Icon className="icon-xs mr-1" />{step.module}</Badge>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">{step.title}</h3>
                      <p className="text-muted-foreground leading-relaxed mb-5">{step.description}</p>
                      <ul className="space-y-2">{step.bullets.map(b => (<li key={b} className="flex items-start gap-2 text-sm"><CheckCircle className="icon-md text-primary mt-0.5 shrink-0" /><span>{b}</span></li>))}</ul>
                    </div>
                    <div className="md:[direction:ltr]">
                      <div className="relative rounded-xl overflow-hidden border border-border shadow-2xl bg-card group">
                        <img src={step.image} alt={step.alt} loading="lazy" width={1024} height={1024} className="w-full h-auto block transition-transform duration-500 group-" />
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

      <section className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Why it works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {why.map(w => (
              <Card key={w.title} className="border-primary/10">
                <CardContent className="p-5">
                  <div className="rounded-lg bg-primary/10 p-2 w-fit mb-3"><w.icon className="icon-lg text-primary" /></div>
                  <h3 className="font-semibold mb-1">{w.title}</h3>
                  <p className="text-sm text-muted-foreground">{w.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Real modules in the platform</h2>
          <p className="text-center text-muted-foreground mb-8">Every step above maps to a live TopSqill module.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {modules.map(m => (
              <Link key={m.path} to={m.path} className="rounded-lg border border-border bg-card p-4 text-center text-sm font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors">{m.name}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">FAQs</h2>
          <div className="space-y-4">
            {faqs.map(f => (
              <Card key={f.q} className="border-primary/10">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-2">{f.q}</h3>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/30">
          <CardContent className="p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Stand up security operations in 30 days</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">Bring your incident categories, severities and runbooks — go live with a connected SecOps platform in weeks, not a quarter.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth"><Button size="lg" className="bg-gradient-to-r from-primary to-primary/80">Start Free 30-Day Trial<ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
              <Link to="/"><Button size="lg" variant="outline">Explore the Platform</Button></Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default SolutionSecurity;
