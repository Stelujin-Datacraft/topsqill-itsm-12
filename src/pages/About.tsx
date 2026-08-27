import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  FileText,
  Workflow,
  BarChart3,
  Database,
  BookOpen,
  Monitor,
  Shield,
  Building2,
  Users,
  Brain,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

const capabilities = [
  {
    icon: FileText,
    title: 'Forms & data collection',
    body: 'Build structured intake with drag-and-drop fields, validation, conditional logic, cross-references, and controlled access — from public forms to internal enterprise records.',
  },
  {
    icon: Workflow,
    title: 'Visual workflow automation',
    body: 'Automate approvals, routing, escalations, notifications, and record updates with a visual designer. Every step is versioned and audited.',
  },
  {
    icon: Database,
    title: 'SQL on your form data',
    body: 'Query submissions directly with SQL, join across forms, and export results without waiting on custom reports or spreadsheets.',
  },
  {
    icon: BarChart3,
    title: 'Reports & dashboards',
    body: 'Turn operational data into live dashboards — KPIs, charts, drill-downs, and role-based views for managers and executives.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge base',
    body: 'Publish policies, runbooks, and onboarding docs with versioning, acknowledgements, and folder-level access control.',
  },
  {
    icon: Monitor,
    title: 'IT asset management',
    body: 'Track hardware, software, and licenses — and link them to people, tickets, and workflows so operations stay connected.',
  },
];

const solutions = [
  'Employee onboarding',
  'IT service management (ITSM)',
  'Governance, risk & compliance (GRC)',
  'Vendor & contract management',
  'Information security operations',
  'HR lifecycle management',
];

const principles = [
  {
    icon: Building2,
    title: 'Built for organizations',
    body: 'Multi-tenant architecture with organization isolation, projects, roles, groups, and permission models that scale from a single team to a large enterprise.',
  },
  {
    icon: Shield,
    title: 'Security by design',
    body: 'Row-level security, encrypted data in transit and at rest, audit logs, SSO/LDAP options, and admin controls for sessions and access.',
  },
  {
    icon: Users,
    title: 'One connected system',
    body: 'Forms, workflows, assets, knowledge, and reports share the same data model — so handoffs do not get lost between tools and inboxes.',
  },
  {
    icon: Brain,
    title: 'AI where it helps',
    body: 'Describe what you need and TopSqill helps generate forms and related assets faster, while keeping humans in control of structure and governance.',
  },
];

export default function About() {
  return (
    <PublicPageLayout bare>
        <section className="container mx-auto px-4 pt-16 pb-14 md:pt-20 md:pb-16 text-center">
          <Badge variant="secondary" className="mb-5 bg-primary/10 text-primary">
            About us
          </Badge>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1] mb-5">
            TopSqill
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium max-w-3xl mx-auto mb-6">
            The enterprise platform for forms, workflows, and intelligent business automation.
          </p>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            TopSqill helps organizations replace fragmented spreadsheets, inboxes, and disconnected tools
            with one governed system — so teams can collect data, automate processes, and report on outcomes
            from the same platform.
          </p>
        </section>

        <section className="border-y border-border/60 bg-muted/20">
          <div className="container mx-auto px-4 py-14 md:py-16 max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">What TopSqill is</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed text-base md:text-lg">
              <p>
                TopSqill is an enterprise BPM and operations platform. At its core, you design forms that
                capture structured business data, connect those forms to visual workflows, and turn the
                resulting records into reports, dashboards, and knowledge that teams can act on.
              </p>
              <p>
                Whether you are onboarding employees, running IT tickets, managing vendors, tracking compliance,
                or coordinating security response — TopSqill gives you the building blocks to model the
                process end to end without stitching together five separate products.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-14 md:py-20">
          <div className="max-w-3xl mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              What the platform includes
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Everything needed to run operational processes on one connected stack.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10 max-w-5xl">
            {capabilities.map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1.5">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/15">
          <div className="container mx-auto px-4 py-14 md:py-16">
            <div className="max-w-3xl mb-8">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                Solutions we power
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                TopSqill is used to run real operational solutions — not just standalone forms.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-4xl">
              {solutions.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-3 text-foreground font-medium"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  {name}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link to="/solutions">
                <Button variant="outline" className="gap-2">
                  Explore solutions
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-14 md:py-20">
          <div className="max-w-3xl mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              How we approach the product
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              TopSqill is designed for teams that need speed without giving up control.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10 max-w-5xl">
            {principles.map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1.5">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/20">
          <div className="container mx-auto px-4 py-14 md:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 max-w-5xl">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                  Who we are
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  TopSqill Pvt Ltd builds software for organizations that need reliable process automation —
                  with clear ownership, auditability, and room to grow. We work with teams across professional
                  services, technology, and enterprise IT who want one platform for intake, workflow, and insight.
                </p>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>
                    B-439, Bhutani Technopark, Sector 127<br />
                    Noida — 201313, India
                  </span>
                </div>
              </div>
              <div className="lg:pt-1">
                <h3 className="text-lg font-semibold mb-3">Talk with us</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Want a walkthrough, an enterprise rollout discussion, or help mapping your process onto TopSqill?
                  We are happy to help.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/contact">
                    <Button className="w-full sm:w-auto gap-2">
                      Contact us
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Start free trial
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
    </PublicPageLayout>
  );
}
