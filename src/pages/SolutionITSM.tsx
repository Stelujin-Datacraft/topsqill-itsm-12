import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight, ArrowLeft, FileText, Workflow, Mail, Monitor,
  BookOpen, BarChart3, Network, CheckCircle, Sparkles, Timer,
  Users, Headphones, Zap, ShieldCheck, Activity,
} from 'lucide-react';
import intakeImg from '@/assets/solution-itsm/01-intake-form.jpg';
import workflowImg from '@/assets/solution-itsm/02-workflow.jpg';
import slaImg from '@/assets/solution-itsm/03-sla.jpg';
import assetImg from '@/assets/solution-itsm/04-asset-link.jpg';
import kbImg from '@/assets/solution-itsm/05-kb-deflection.jpg';
import emailImg from '@/assets/solution-itsm/06-email.jpg';
import reportsImg from '@/assets/solution-itsm/07-reports.jpg';
import relImg from '@/assets/solution-itsm/08-relationships.jpg';

type Step = {
  num: string; module: string; title: string; description: string;
  bullets: string[]; image: string; alt: string;
  icon: React.ComponentType<{ className?: string }>;
};

const steps: Step[] = [
  {
    num: '01', module: 'Forms + Cross-Reference',
    title: 'A user files an incident in seconds',
    description: 'The Incident form captures the issue with smart defaults — category, urgency, impacted asset (cross-referenced from ITAM), and attachments. No more "please describe your laptop" emails.',
    bullets: ['Drag-and-drop intake form for incidents & service requests', 'Cross-ref to Asset, Requester, and Site records', 'File uploads, conditional fields, and required validation'],
    image: intakeImg, alt: 'Incident intake form with category, priority, and asset cross-reference', icon: FileText,
  },
  {
    num: '02', module: 'Workflow Automation',
    title: 'Auto-route, auto-assign, auto-escalate',
    description: 'The moment a ticket hits, a visual workflow categorises it, pages the right team, opens parallel sub-tasks, and starts the SLA clock — no manual triage.',
    bullets: ['Conditional routing by category, priority, or location', 'Parallel branches for IT, Facilities, Security', 'Versioned and fully audited'],
    image: workflowImg, alt: 'Visual workflow for incident routing and L1/L2 escalation', icon: Workflow,
  },
  {
    num: '03', module: 'SLA Management',
    title: 'Business-hour SLAs with predictive breach',
    description: 'Response and resolution targets respect business hours, holidays, and priority. Predictive breach warns you before you miss — not after. L1→L4 escalation chains fire automatically.',
    bullets: ['Business-hour aware clocks per priority', 'Predictive breach warnings on at-risk tickets', 'L1–L4 escalation with email + in-app notifications'],
    image: slaImg, alt: 'SLA management dashboard with response targets and breach warnings', icon: Timer,
  },
  {
    num: '04', module: 'IT Asset Management',
    title: 'Every ticket linked to the affected asset',
    description: 'The agent sees the laptop, monitor, and licenses tied to the requester. One click opens the asset history — warranty, prior incidents, installed software — so you fix it right the first time.',
    bullets: ['Tickets bound to hardware, software, and contracts', 'Full asset history visible from the ticket', 'Asset-aware reports: "MTTR by laptop model"'],
    image: assetImg, alt: 'IT asset detail view linked to an open incident', icon: Monitor,
  },
  {
    num: '05', module: 'Knowledge Base',
    title: 'Deflect tickets before they cost anyone time',
    description: 'Relevant KB articles surface inside the ticket and on the self-service portal. Users self-resolve common issues, and agents close repeat problems with one-click "resolved by KB".',
    bullets: ['Suggested articles per category and keyword', 'Self-service portal with search and folders', 'Version-controlled with acknowledgements'],
    image: kbImg, alt: 'Knowledge base article suggestions inside a ticket', icon: BookOpen,
  },
  {
    num: '06', module: 'Email Templates',
    title: 'Every status change communicates itself',
    description: 'Acknowledgement, assignment, on-hold, resolved, CSAT — all from reusable templates with merge tags. Users always know where their ticket stands.',
    bullets: ['Triggered from workflow with full delivery logs', 'Merge tags: ticket_id, requester, eta, agent', 'SMTP support: Gmail, Hostinger, custom providers'],
    image: emailImg, alt: 'Email template editor for ticket acknowledgement', icon: Mail,
  },
  {
    num: '07', module: 'Reports & Dashboards',
    title: 'Service desk leaders see every signal',
    description: 'MTTR, first response, backlog, SLA compliance, agent leaderboard, CSAT trend — all live, all drill-down. Build a board for the CIO and another for the team lead in minutes.',
    bullets: ['KPI cards, trend lines, leaderboards, heatmaps', 'Filter by team, priority, asset model, location', 'Embed dashboards on the home screen by role'],
    image: reportsImg, alt: 'ITSM analytics dashboard with MTTR, backlog, CSAT, and leaderboard', icon: BarChart3,
  },
  {
    num: '08', module: 'Relationship Map',
    title: 'Audit-ready: one graph per ticket',
    description: 'Open the relationship map for any ticket and trace it back to the user, the asset, the KB article that resolved it, the workflow run, and the SLA result. Perfect for post-mortems and audits.',
    bullets: ['Bidirectional record map up to 3 levels deep', 'Click any node to open the source record', 'Auditors love it. So will your CIO.'],
    image: relImg, alt: 'Relationship map for a support ticket linking user, asset, KB, and workflow', icon: Network,
  },
];

const personas = [
  { icon: Users, role: 'End Users', desc: 'Self-service portal, KB search, ticket status in real time.' },
  { icon: Headphones, role: 'L1 / L2 Agents', desc: 'Unified queue, asset context, suggested articles, one-click actions.' },
  { icon: ShieldCheck, role: 'Service Desk Manager', desc: 'SLA health, workload balance, leaderboard, CSAT trend.' },
  { icon: Activity, role: 'CIO / IT Director', desc: 'MTTR, deflection rate, asset reliability, spend per ticket.' },
];

const outcomes = [
  { stat: '40%', label: 'fewer tickets via KB deflection' },
  { stat: '3×', label: 'faster first response with auto-routing' },
  { stat: '99%', label: 'SLA compliance with predictive breach' },
  { stat: '100%', label: 'audit traceability per ticket' },
];

const why = [
  { icon: Zap, title: 'Connected, not stitched', desc: 'Tickets, assets, users, KB, and workflows share one data model — no integrations to babysit.' },
  { icon: Timer, title: 'Predictive SLAs', desc: 'Catch breaches before they happen with business-hour aware predictions and L1–L4 escalation.' },
  { icon: BookOpen, title: 'Deflection that works', desc: 'In-ticket and self-service KB cuts repeat tickets — and proves it in your dashboards.' },
  { icon: Workflow, title: 'No-code automation', desc: 'Reroute, reassign, and escalate visually. Change rules in minutes, not sprints.' },
  { icon: BarChart3, title: 'Live dashboards by role', desc: 'CIO, manager, and agent each see what matters — no exports, no spreadsheets.' },
  { icon: Network, title: 'One graph, full audit', desc: 'Every ticket links to assets, KB, workflows, and SLA results for clean post-mortems.' },
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
  { q: 'Does it support ITIL practices?', a: 'Yes — incident, request, problem, and change can each be modelled as forms with their own workflows, SLAs, and lifecycle states.' },
  { q: 'Can users open tickets without logging in?', a: 'Yes. Use public form links for unauthenticated submissions, or invite users to the self-service portal with KB and ticket status.' },
  { q: 'How are SLAs calculated?', a: 'Business-hour aware per priority, with holiday calendars. Predictive breach evaluates remaining time vs current state to warn early.' },
  { q: 'Can I link a ticket to a specific laptop?', a: 'Yes. Cross-reference fields tie every ticket to assets, users, and contracts so context is one click away.' },
  { q: 'How does CSAT capture work?', a: 'A resolved-status workflow node sends a CSAT email from a template; responses flow back into the ticket and report dashboards.' },
];

const SolutionITSM: React.FC = () => {
  useEffect(() => {
    document.title = 'IT Service Management Solution | TopSqill';
    const desc = 'Run end-to-end ITSM on TopSqill: incident intake, workflow routing, SLA management, asset-linked tickets, KB deflection, email, and live dashboards.';
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
          IT Service Management,<br />
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">from ticket to resolution</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
          Replace the patchwork of help-desk tool, asset CMDB, knowledge wiki, and reporting scripts with one connected platform — incident to MTTR in days, not quarters.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Incident','Service Request','SLA','ITAM','Knowledge Base','Workflows','Reports'].map(t => <Badge key={t} variant="outline" className="text-sm py-1 px-3">{t}</Badge>)}
        </div>
        <Link to="/auth"><Button size="lg" className="bg-gradient-to-r from-primary to-primary/80">Try this scenario free for 30 days<ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
      </header>

      <section className="container mx-auto px-4 pb-12">
        <Card className="max-w-4xl mx-auto border-primary/20 bg-card/60 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 shrink-0"><CheckCircle className="icon-xl text-primary" /></div>
              <div>
                <h2 className="text-xl md:text-2xl font-semibold mb-2">The scenario: Priya can't connect to VPN</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Priya submits "VPN won't connect" from the portal. TopSqill suggests two KB articles instantly. She tries one — no luck — and submits. A workflow categorises it as Network/High, attaches her MacBook from ITAM, pages L1, and starts a 4-hour SLA. L1 resolves it in 22 minutes using the KB article. CSAT goes out automatically. The manager's dashboard updates live.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Built for everyone on the service desk</h2>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Replace your help desk in 30 days</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">Bring your forms, your SLAs, your asset CSV — go live with a working service desk in weeks, not a quarter.</p>
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

export default SolutionITSM;