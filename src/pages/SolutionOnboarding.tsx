import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight, ArrowLeft, FileText, Workflow, Mail, Database,
  BookOpen, BarChart3, Monitor, Network, CheckCircle, Sparkles
} from 'lucide-react';
import formBuilderImg from '@/assets/solution-onboarding/01-form-builder.jpg';
import workflowImg from '@/assets/solution-onboarding/02-workflow.jpg';
import emailImg from '@/assets/solution-onboarding/03-email.jpg';
import dataFeedImg from '@/assets/solution-onboarding/04-datafeed.jpg';
import knowledgeImg from '@/assets/solution-onboarding/05-knowledge.jpg';
import reportsImg from '@/assets/solution-onboarding/06-reports.jpg';
import itamImg from '@/assets/solution-onboarding/07-itam.jpg';
import relationshipImg from '@/assets/solution-onboarding/08-relationships.jpg';

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
    module: 'Forms + Cross-Reference',
    title: 'New hire submits the Onboarding form',
    description:
      'HR builds an Employee Onboarding form with drag-and-drop. Cross-reference fields link the new hire to the Departments and Users tables so data stays consistent — no duplicate dropdowns to maintain.',
    bullets: [
      'Drag-and-drop fields: text, email, date, file upload, cross-reference',
      'Cross-ref to Departments and Reporting Manager records',
      'Conditional logic, validation, and field-level access control',
    ],
    image: formBuilderImg,
    alt: 'Drag-and-drop form builder for Employee Onboarding with cross-reference fields',
    icon: FileText,
  },
  {
    num: '02',
    module: 'Workflow Automation',
    title: 'A visual workflow takes over instantly',
    description:
      'The moment the form is submitted, a visual workflow kicks off. No code — just connected nodes that create the IT request, notify the manager, assign reading material, and queue HR tasks in parallel.',
    bullets: [
      'Trigger on form submission — runs in seconds',
      'Branch into IT, Email, Knowledge Base, and Tasks in parallel',
      'Versioned, testable, and fully audited',
    ],
    image: workflowImg,
    alt: 'Visual workflow automation canvas for New Hire Onboarding',
    icon: Workflow,
  },
  {
    num: '03',
    module: 'IT Asset Management',
    title: 'Laptop, monitor & licenses get assigned',
    description:
      'The workflow opens an asset request in ITAM. IT picks the right hardware, assigns software licenses (Slack, GitHub, Figma, Notion), and tags everything to the new hire — all traceable.',
    bullets: [
      'Auto-create asset requests from workflow nodes',
      'Hardware + software license assignment in one view',
      'Full asset lifecycle: requested → active → returned',
    ],
    image: itamImg,
    alt: 'IT Asset Management showing assigned laptop, monitor, phone and software licenses',
    icon: Monitor,
  },
  {
    num: '04',
    module: 'Email Templates',
    title: 'Personalised welcome emails go out',
    description:
      'Manager notification and employee welcome emails fire from reusable templates. Merge tags like {{full_name}} and {{start_date}} pull straight from the submission — no copy-paste, no mistakes.',
    bullets: [
      'Reusable templates with merge tags and rich formatting',
      'Triggered from workflow with full delivery logs',
      'SMTP support: Gmail, Hostinger, custom providers',
    ],
    image: emailImg,
    alt: 'Email template editor for the new hire welcome email with merge variables',
    icon: Mail,
  },
  {
    num: '05',
    module: 'Knowledge Base',
    title: 'Onboarding docs assigned automatically',
    description:
      'The new hire lands in the Knowledge Base with the right folder pre-assigned: Welcome Guide, IT Setup, Code of Conduct, Benefits, and the First Week Checklist — all version-controlled and approval-tracked.',
    bullets: [
      'Folder-based docs with rich content, video, and tables',
      'Versioning, approval workflows, and acknowledgement tracking',
      'Granular access by role, department, or individual',
    ],
    image: knowledgeImg,
    alt: 'Knowledge Base showing the Onboarding folder and Welcome Guide article',
    icon: BookOpen,
  },
  {
    num: '06',
    module: 'Data Feed',
    title: 'HRMS stays in sync, every 15 minutes',
    description:
      'A scheduled data feed pulls employee master data from your HRMS, maps fields, resolves cross-references like Department, and writes back into the Onboarding system — no manual re-entry.',
    bullets: [
      '5-step pipeline: source → mapping → resolver → schedule → run',
      'Cross-reference resolver up to 10 levels deep',
      'Run history with row counts, errors, and replay',
    ],
    image: dataFeedImg,
    alt: 'Data feed pipeline syncing HRMS data into the Onboarding form',
    icon: Database,
  },
  {
    num: '07',
    module: 'Reports & Dashboards',
    title: 'HR leaders see the full picture',
    description:
      'Every step becomes a data point. The Onboarding Insights dashboard surfaces hires by department, cycle time trends, completion rate, and pending tasks — refreshed live.',
    bullets: [
      'KPI cards, bar / line / donut charts, drill-down tables',
      'Custom date ranges, filters, and exports',
      'Embed dashboards into the home page for any role',
    ],
    image: reportsImg,
    alt: 'Analytics dashboard showing Employee Onboarding Insights with KPIs and charts',
    icon: BarChart3,
  },
  {
    num: '08',
    module: 'Relationship Map',
    title: 'One graph shows everything connected to the hire',
    description:
      'Open the relationship map for any new hire and see every linked record — department, manager, office, workflow run, assets, KB articles read, and emails sent. Audit-ready in a single view.',
    bullets: [
      'Bidirectional record map up to 3 levels deep',
      'Click any node to jump straight to the source record',
      'Perfect for audits, handoffs, and offboarding',
    ],
    image: relationshipImg,
    alt: 'Relationship map graph for a new hire connecting department, manager, assets, and workflows',
    icon: Network,
  },
];

const SolutionOnboarding: React.FC = () => {
  useEffect(() => {
    document.title = 'Employee Onboarding Solution | TopSqill';
    const desc = 'See how TopSqill runs end-to-end Employee Onboarding across Forms, Workflows, IT Assets, Email, Knowledge Base, Data Feeds, and Reports.';
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
          Employee Onboarding,<br />
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            end-to-end on one platform
          </span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
          Follow a single new hire from form submission to first day — and see how Forms,
          Workflows, ITAM, Email, Knowledge Base, Data Feeds, and Reports work together,
          with zero glue code.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Forms', 'Cross-Reference', 'Workflows', 'ITAM', 'Email', 'Knowledge Base', 'Data Feeds', 'Reports'].map((t) => (
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
                  The scenario: Sarah joins as a Software Engineer
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  HR submits Sarah's onboarding form. Within minutes, IT has a laptop request
                  in the queue, her manager gets a heads-up email, the right knowledge base
                  folder is assigned, HRMS is in sync, and the leadership dashboard reflects
                  the new hire — all without anyone touching a spreadsheet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Timeline */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="relative max-w-6xl mx-auto">
          {/* Vertical line (desktop) */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0 -translate-x-1/2" />

          <div className="space-y-16 md:space-y-24">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isLeft = i % 2 === 0;
              return (
                <div key={step.num} className="relative">
                  {/* Node dot */}
                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-8 z-10 h-12 w-12 rounded-full bg-primary text-primary-foreground items-center justify-center font-bold shadow-lg ring-4 ring-background">
                    {step.num}
                  </div>

                  <div className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${isLeft ? '' : 'md:[direction:rtl]'}`}>
                    {/* Text */}
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

                    {/* Screenshot */}
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

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/30">
          <CardContent className="p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              This is just one solution. Build yours in days.
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              Onboarding, ITSM, vendor management, compliance, procurement — anything that
              starts with a form and ends with a report can run on TopSqill.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
      </section>
    </div>
  );
};

export default SolutionOnboarding;