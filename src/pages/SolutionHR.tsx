import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight, ArrowLeft, FileText, Workflow, Mail, CalendarCheck,
  BookOpen, BarChart3, Network, CheckCircle, Sparkles, Timer,
  Users, UserPlus, Zap, ShieldCheck, Activity, Award, LogOut,
} from 'lucide-react';
import empImg from '@/assets/solution-hr/01-employee-form.jpg';
import lifecycleImg from '@/assets/solution-hr/02-lifecycle.jpg';
import leaveImg from '@/assets/solution-hr/03-leave.jpg';
import perfImg from '@/assets/solution-hr/04-performance.jpg';
import policyImg from '@/assets/solution-hr/05-policy-kb.jpg';
import helpdeskImg from '@/assets/solution-hr/06-helpdesk.jpg';
import dashImg from '@/assets/solution-hr/07-dashboard.jpg';
import exitImg from '@/assets/solution-hr/08-exit.jpg';

type Step = {
  num: string; module: string; title: string; description: string;
  bullets: string[]; image: string; alt: string;
  icon: React.ComponentType<{ className?: string }>;
};

const steps: Step[] = [
  {
    num: '01', module: 'Forms + Cross-Reference',
    title: 'Onboarding starts with one structured form',
    description: 'New-hire intake captures personal details, role, department, manager, location, and start date — cross-referenced to Org, Manager, and Site records. No more duplicate spreadsheets between HR, IT, and Finance.',
    bullets: ['Drag-and-drop intake forms with conditional fields', 'Cross-ref to Department, Manager, Site, and Asset', 'Document uploads with required-field validation'],
    image: empImg, alt: 'Employee onboarding intake form', icon: UserPlus,
  },
  {
    num: '02', module: 'Workflow Automation',
    title: 'One employee record, the whole lifecycle',
    description: 'Onboarding → Confirmation → Transfers and Promotions → Performance → Exit. Each event triggers its own visual workflow with the right approvers, tasks, and notifications.',
    bullets: ['Parallel branches for IT setup, payroll, facilities', 'Conditional approvers by role and department', 'Full audit log for every change of status'],
    image: lifecycleImg, alt: 'HR employee lifecycle workflow', icon: Workflow,
  },
  {
    num: '03', module: 'Leave & Attendance',
    title: 'Leave requests that approve themselves',
    description: 'Employees pick leave type and dates, see live balance, and submit. Workflow routes to manager → HR with auto-reminders. Calendar conflicts and policy violations flagged before they get to approvers.',
    bullets: ['Casual, sick, earned, comp-off, WFH', 'Live balance from policy + accrual rules', 'Manager → HR approval with auto-escalation'],
    image: leaveImg, alt: 'Leave request form with approver chain', icon: CalendarCheck,
  },
  {
    num: '04', module: 'Performance & Goals',
    title: 'Goals, reviews and 360s without the email chaos',
    description: 'OKRs/KPIs set per cycle, mid-year check-ins, annual reviews, and 360 feedback all live in connected forms. Calibration view for HR, rating distribution for leadership.',
    bullets: ['Self → Peer → Manager → Skip-level → HR calibration', 'Goal completion %, rating distribution, 9-box grid', 'Per-cycle templates that you fully control'],
    image: perfImg, alt: 'Performance review form with ratings', icon: Award,
  },
  {
    num: '05', module: 'Knowledge Base',
    title: 'Policies that employees actually read',
    description: 'Code of Conduct, leave policy, travel policy, ESOP guide — all versioned, with mandatory acknowledgements tracked per employee. New joiners see what they need on day one.',
    bullets: ['Version-controlled policies with read receipts', 'Folder structure by audience and department', 'Self-service portal with full-text search'],
    image: policyImg, alt: 'HR policy knowledge base article', icon: BookOpen,
  },
  {
    num: '06', module: 'HR Helpdesk + SLA + Email',
    title: 'Every HR query handled, on time',
    description: 'Payroll questions, benefits, IT setup, certificates — captured as tickets with business-hour SLAs, auto-routed to the right HR partner, with templated email updates at every step.',
    bullets: ['HR tickets with SLA timers and predictive breach', 'Auto-routing by category and location', 'Templated emails: acknowledgement, on-hold, resolved'],
    image: helpdeskImg, alt: 'HR helpdesk ticket queue', icon: Mail,
  },
  {
    num: '07', module: 'Reports & Dashboards',
    title: 'CHRO sees headcount, attrition, and engagement live',
    description: 'Headcount by department, attrition trend, leave balance, rating distribution, HR helpdesk volume — one dashboard per audience, drill-down on every tile.',
    bullets: ['Headcount, joiners, leavers, attrition %', 'Leave balance trends and policy compliance', 'Role-based boards: manager, HRBP, CHRO'],
    image: dashImg, alt: 'HR analytics dashboard', icon: BarChart3,
  },
  {
    num: '08', module: 'Workflow + ITAM + Relationship Map',
    title: 'Exit done right — no loose ends',
    description: 'Resignation triggers the exit workflow: asset return (linked from ITAM), access revocation, knowledge transfer, final settlement, and exit interview — every step tracked, every signoff captured.',
    bullets: ['Asset return tied to the actual laptop in ITAM', 'Access revocation with timestamped audit trail', 'Knowledge transfer + final settlement checklist'],
    image: exitImg, alt: 'Employee exit checklist', icon: LogOut,
  },
];

const personas = [
  { icon: Users, role: 'Employees', desc: 'Self-service for leave, payslips, policies and HR queries.' },
  { icon: UserPlus, role: 'Managers', desc: 'Approvals, team leave calendar, goal tracking, reviews.' },
  { icon: ShieldCheck, role: 'HR Business Partners', desc: 'Lifecycle workflows, ticket queue, calibration view.' },
  { icon: Activity, role: 'CHRO', desc: 'Headcount, attrition, engagement and compliance dashboards.' },
];

const outcomes = [
  { stat: '70%', label: 'less time on lifecycle paperwork' },
  { stat: '3×', label: 'faster onboarding to day-one productivity' },
  { stat: '100%', label: 'policy acknowledgement traceability' },
  { stat: '0', label: 'orphan accounts after exit' },
];

const why = [
  { icon: Zap, title: 'One employee record', desc: 'Onboarding, leave, performance, helpdesk and exit share one data model — no HRIS-to-spreadsheet gaps.' },
  { icon: Workflow, title: 'No-code workflows', desc: 'Change approval chains, parallel tasks and escalations visually — no engineering tickets.' },
  { icon: Timer, title: 'SLAs on HR queries', desc: 'Business-hour aware response and resolution clocks with predictive breach.' },
  { icon: BookOpen, title: 'Policies that get acknowledged', desc: 'Versioned KB with read receipts ensures every employee saw the latest policy.' },
  { icon: BarChart3, title: 'Live dashboards by role', desc: 'CHRO, HRBP and manager each see what matters — no monthly export rituals.' },
  { icon: Network, title: 'One graph, full audit', desc: 'Every employee links to assets, tickets, reviews and lifecycle events for clean compliance.' },
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
  { q: 'Can this be our HRIS, or does it sit on top of one?', a: 'Both. Many teams start by replacing spreadsheets; others run TopSqill alongside an existing payroll system and sync via data feeds.' },
  { q: 'Can leave balance and accruals be configured per policy?', a: 'Yes. Leave types, accrual rules, eligibility and approver chains are all configurable per organization and per location.' },
  { q: 'How are sensitive fields like salary protected?', a: 'Roles, groups and field-level access control restrict who can read or edit each field; every change is audited.' },
  { q: 'Does this support performance reviews end-to-end?', a: 'Yes — goal setting, self/peer/manager review, 360 feedback, calibration and rating distribution all out of the box.' },
  { q: 'How is exit / offboarding tied to IT?', a: 'Exit workflow links to ITAM for asset return and to roles/groups for access revocation — with a timestamped audit trail.' },
];

const SolutionHR: React.FC = () => {
  useEffect(() => {
    document.title = 'HR Management Solution | TopSqill';
    const desc = 'Run the full employee lifecycle on TopSqill: onboarding, leave, performance, HR helpdesk, policies, exit, and CHRO dashboards — all connected.';
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
        <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary"><Sparkles className="w-3 h-3 mr-1" />Solution Spotlight</Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          HR Management,<br />
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">from offer letter to exit interview</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
          Replace the patchwork of onboarding spreadsheets, leave trackers, review docs and HR inboxes with one connected platform — every stage of the employee lifecycle, in one place.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Onboarding','Leave','Performance','Helpdesk','Policies','Workflows','Exit'].map(t => <Badge key={t} variant="outline" className="text-sm py-1 px-3">{t}</Badge>)}
        </div>
        <Link to="/auth"><Button size="lg" className="bg-gradient-to-r from-primary to-primary/80">Try this scenario free for 30 days<ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
      </header>

      <section className="container mx-auto px-4 pb-12">
        <Card className="max-w-4xl mx-auto border-primary/20 bg-card/60 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 shrink-0"><CheckCircle className="h-6 w-6 text-primary" /></div>
              <div>
                <h2 className="text-xl md:text-2xl font-semibold mb-2">The scenario: Ananya joins on Monday</h2>
                <p className="text-muted-foreground leading-relaxed">
                  HR fills the new-hire form on Wednesday. A workflow fires: IT provisions her laptop and accounts from ITAM, Finance opens payroll, Facilities allocates a seat, and the KB pushes Code of Conduct + Leave Policy for acknowledgement. Day one she logs in, sees her goals, books her first leave from the portal, and raises a payroll query — handled within SLA. Six months later, confirmation, performance review, and a transfer all run on the same record.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Built for everyone in HR</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {personas.map(p => (
              <Card key={p.role} className="border-primary/10">
                <CardContent className="p-5">
                  <div className="rounded-lg bg-primary/10 p-2 w-fit mb-3"><p.icon className="h-5 w-5 text-primary" /></div>
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
                        <Badge variant="secondary" className="bg-primary/10 text-primary"><Icon className="w-3 h-3 mr-1" />{step.module}</Badge>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">{step.title}</h3>
                      <p className="text-muted-foreground leading-relaxed mb-5">{step.description}</p>
                      <ul className="space-y-2">{step.bullets.map(b => (<li key={b} className="flex items-start gap-2 text-sm"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{b}</span></li>))}</ul>
                    </div>
                    <div className="md:[direction:ltr]">
                      <div className="relative rounded-xl overflow-hidden border border-border shadow-2xl bg-card group">
                        <img src={step.image} alt={step.alt} loading="lazy" width={1024} height={1024} className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]" />
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
                  <div className="rounded-lg bg-primary/10 p-2 w-fit mb-3"><w.icon className="h-5 w-5 text-primary" /></div>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Run the full employee lifecycle in one platform</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">Bring your onboarding checklist, leave policy and review template — go live with a connected HR platform in weeks, not a quarter.</p>
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

export default SolutionHR;
