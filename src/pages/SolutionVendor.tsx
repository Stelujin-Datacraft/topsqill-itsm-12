import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight, ArrowLeft, FileText, Workflow, Mail, Database,
  BarChart3, Network, CheckCircle, Sparkles, FileSignature,
  ShieldAlert, Briefcase, Scale, DollarSign, Clock, Link2,
} from 'lucide-react';
import vendorImg from '@/assets/solution-vendor/01-vendor-form.jpg';
import workflowImg from '@/assets/solution-vendor/02-workflow.jpg';
import contractsImg from '@/assets/solution-vendor/03-contracts.jpg';
import dataFeedImg from '@/assets/solution-vendor/04-datafeed.jpg';
import riskImg from '@/assets/solution-vendor/05-risk.jpg';
import emailImg from '@/assets/solution-vendor/06-email.jpg';
import reportsImg from '@/assets/solution-vendor/07-reports.jpg';
import relImg from '@/assets/solution-vendor/08-relationships.jpg';

type Step = {
  num: string; module: string; title: string; description: string;
  bullets: string[]; image: string; alt: string;
  icon: React.ComponentType<{ className?: string }>;
};

const steps: Step[] = [
  {
    num: '01', module: 'Forms + Cross-Reference',
    title: 'Vendor onboarding starts with one clean form',
    description: 'Procurement captures vendor info — category, risk tier, contacts, tax details, certifications — with cross-references to the Contracts and Internal Owner records. No more shared inboxes and rogue spreadsheets.',
    bullets: ['Drag-and-drop form for vendor master data', 'Cross-ref to Contracts, Categories, Owner', 'Required certifications, GDPR & W-9 uploads'],
    image: vendorImg, alt: 'Vendor onboarding form with risk tier and contract cross-reference', icon: FileText,
  },
  {
    num: '02', module: 'Workflow Automation',
    title: 'Due-diligence runs itself',
    description: 'Submission triggers a multi-stage workflow: compliance screening → legal review → security questionnaire → finance approval → activation. Every step is timed, assigned, and audited.',
    bullets: ['Parallel reviews for Legal, Security, and Finance', 'Rejection routes back to procurement with comments', 'Auto-activate the vendor record on final approval'],
    image: workflowImg, alt: 'Visual due diligence workflow with compliance, legal, and finance gates', icon: Workflow,
  },
  {
    num: '03', module: 'Contract Repository',
    title: 'Every MSA, NDA, and SOW in one place',
    description: 'Contracts live as records linked to the vendor — versioned, signed, searchable. Track value, term, auto-renewal, owner, and obligations. Expiring agreements never slip through.',
    bullets: ['MSA / NDA / SOW / DPA contract types', 'Versioned files with full audit history', 'Obligation tracking with owner + due dates'],
    image: contractsImg, alt: 'Contract repository table showing vendors, types, and renewal dates', icon: FileSignature,
  },
  {
    num: '04', module: 'Data Feed',
    title: 'Vendor master stays in sync with ERP',
    description: 'A scheduled data feed pulls payment status, spend, and bank details nightly from your ERP or finance system. Cross-references resolve cleanly — no manual reconciliation.',
    bullets: ['5-step pipeline: source → mapping → resolver → schedule → run', 'Cross-reference resolver up to 10 levels deep', 'Run history with row counts, errors, and replay'],
    image: dataFeedImg, alt: 'Data feed pipeline syncing vendor master from ERP', icon: Database,
  },
  {
    num: '05', module: 'Risk Assessment',
    title: 'Risk-tier every vendor — quantitatively',
    description: 'Score vendors across financial, security, compliance, and operational dimensions. Heatmap visualisation surfaces high-risk relationships before they bite. Re-assess on a schedule.',
    bullets: ['Configurable scoring across 4 risk categories', 'Heatmap and risk-tier classification', 'Periodic re-assessment workflows'],
    image: riskImg, alt: 'Vendor risk assessment heatmap across categories', icon: ShieldAlert,
  },
  {
    num: '06', module: 'Email Templates',
    title: 'Renewals reminders 90 / 60 / 30 days out',
    description: 'Scheduled emails ping the contract owner and vendor at 90, 60, and 30 days before renewal. Templates include term, value, and a renewal link — so no contract auto-renews by accident.',
    bullets: ['Scheduled reminders driven by contract dates', 'Merge tags for vendor, value, end-date, owner', 'Full delivery logs and bounce tracking'],
    image: emailImg, alt: 'Contract renewal reminder email at 90, 60, and 30 days', icon: Mail,
  },
  {
    num: '07', module: 'Reports & Dashboards',
    title: 'Spend, risk, and renewals on one screen',
    description: 'Live dashboards for total spend, vendor count, expiring contracts, risk-tier distribution, and category breakdown. CPO board view + procurement ops view in one platform.',
    bullets: ['KPI cards, bar/donut/line charts, drill-down tables', 'Filter by category, region, owner, risk tier', 'Exports to PDF and Excel'],
    image: reportsImg, alt: 'Vendor analytics dashboard with spend, active vendors, and renewals pipeline', icon: BarChart3,
  },
  {
    num: '08', module: 'Relationship Map',
    title: 'See everything connected to a vendor',
    description: 'One graph for any vendor: all contracts, internal owners, IT assets and licenses procured, related services, and active workflows. Perfect for renegotiation, audit, and offboarding.',
    bullets: ['Bidirectional record map up to 3 levels deep', 'Trace spend, assets, and obligations in one view', 'Click any node to jump to the source record'],
    image: relImg, alt: 'Relationship map for a vendor linking contracts, owners, and assets', icon: Network,
  },
];

const personas = [
  { icon: Briefcase, role: 'Procurement', desc: 'Onboard vendors fast, kill duplicate suppliers, hit spend targets.' },
  { icon: Scale, role: 'Legal & Compliance', desc: 'Track MSAs, DPAs, obligations, and audit trails in one place.' },
  { icon: ShieldAlert, role: 'Risk & Security', desc: 'Tier vendors by risk, schedule re-assessments, flag concentration.' },
  { icon: DollarSign, role: 'Finance / CFO', desc: 'Live spend by vendor and category, renewal pipeline, savings targets.' },
];

const outcomes = [
  { stat: '60%', label: 'faster vendor onboarding' },
  { stat: '0', label: 'unplanned auto-renewals' },
  { stat: '100%', label: 'contracts searchable & version-tracked' },
  { stat: '15%', label: 'savings from duplicate-vendor cleanup' },
];

const why = [
  { icon: Link2, title: 'Vendors, contracts, assets — connected', desc: 'No more "which spreadsheet has the latest MSA?" Everything links to the vendor record.' },
  { icon: Clock, title: 'Renewals never surprise you', desc: 'Scheduled reminders 90/60/30 days out — for owner and vendor — with the renewal link built in.' },
  { icon: ShieldAlert, title: 'Risk you can act on', desc: 'Quantitative scoring, heatmaps, and scheduled re-assessments turn risk from a PDF into a workflow.' },
  { icon: Database, title: 'ERP-synced, not retyped', desc: 'Nightly data feeds keep vendor master, spend, and payment status in sync — no manual reconciliation.' },
  { icon: Workflow, title: 'Due diligence on rails', desc: 'Legal, security, and finance reviews run in parallel with full audit trail — approve in days, not weeks.' },
  { icon: BarChart3, title: 'CFO-grade dashboards', desc: 'Spend, risk tier, renewals pipeline, top vendors — live, filterable, and exportable.' },
];

const modules = [
  { name: 'Forms', path: '/forms' },
  { name: 'Workflows', path: '/workflows' },
  { name: 'Data Feeds', path: '/data-feeds' },
  { name: 'Email Templates', path: '/email-templates' },
  { name: 'Knowledge Base', path: '/knowledge-base' },
  { name: 'Reports', path: '/reports' },
  { name: 'IT Assets', path: '/it-assets' },
  { name: 'Relationship Map', path: '/relationship-map' },
];

const faqs = [
  { q: 'Can we keep our existing vendor IDs from the ERP?', a: 'Yes. Data feeds map external IDs to TopSqill records and keep them in sync — no re-numbering required.' },
  { q: 'How do we handle MSAs vs SOWs vs NDAs?', a: 'Each contract type is a record linked to the vendor, with its own fields, lifecycle, and renewal rules. One vendor, many contracts.' },
  { q: 'Can vendors update their own info?', a: 'Yes — invite vendors to a portal to refresh contacts, certifications, and tax forms. Changes route through an approval workflow.' },
  { q: 'How are obligations tracked?', a: 'Obligations are linked records with an owner, due date, and status. They show up in workflows, reminders, and the relationship map.' },
  { q: 'Does this replace our procurement tool?', a: 'For SMB and mid-market, yes — onboarding, contracts, risk, renewals, and reporting all run on TopSqill. For enterprise PO/invoice flow, we integrate via data feeds and APIs.' },
];

const SolutionVendor: React.FC = () => {
  useEffect(() => {
    document.title = 'Vendor & Contract Management Solution | TopSqill';
    const desc = 'Run vendor onboarding, contracts, risk, renewals, and spend on TopSqill — forms, workflows, data feeds, email reminders, and live dashboards in one platform.';
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
          Vendor & Contract Management,<br />
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">onboarded, audited, and renewed</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
          One platform for vendor onboarding, contracts, risk, renewals, and spend — so procurement, legal, finance, and security finally share one source of truth.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Vendor Onboarding','Contracts','Risk','Renewals','Spend','Data Feeds','Reports'].map(t => <Badge key={t} variant="outline" className="text-sm py-1 px-3">{t}</Badge>)}
        </div>
        <Link to="/auth"><Button size="lg" className="bg-gradient-to-r from-primary to-primary/80">Try this scenario free for 30 days<ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
      </header>

      <section className="container mx-auto px-4 pb-12">
        <Card className="max-w-4xl mx-auto border-primary/20 bg-card/60 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 shrink-0"><CheckCircle className="h-6 w-6 text-primary" /></div>
              <div>
                <h2 className="text-xl md:text-2xl font-semibold mb-2">The scenario: Onboarding a new SaaS vendor</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Procurement submits "Acme Analytics" with a draft MSA and SOC 2 report. A workflow opens Legal review, Security questionnaire, and Finance approval in parallel. Risk scoring tags Acme as Tier-2. Once approved, the vendor activates, the MSA is filed with a 90/60/30-day renewal reminder, the ERP sync brings spend in nightly, and the CFO dashboard reflects the new commitment — all without a single email thread.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">One platform, four teams aligned</h2>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Bring your vendor list. Go live in weeks.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">Import your vendor CSV, wire up the ERP feed, and stand up onboarding, contracts, and renewals — without a six-month implementation.</p>
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

export default SolutionVendor;