import { FormEvent, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, ChevronRight, Clock, Hand, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  GRC_AI,
  GRC_CAPABILITIES,
  GRC_CHALLENGES,
  GRC_DEMO,
  GRC_DEMO_ID,
  GRC_FAQ,
  GRC_HERO,
  GRC_HOW_IT_WORKS,
  GRC_INDUSTRIES,
  GRC_SAMPLE_DASHBOARD,
  GRC_SECTIONS,
  GRC_USE_CASE,
  GRC_WHAT_IS,
  GRC_WHY,
  grcDemoMailto,
  heatBand,
} from '@/content/solutions/grc';

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SectionLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => scrollToSection(to)}
      className={cn('inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4', className)}
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function SectionHeading({ eyebrow, title, body, center = true }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={cn('mb-10 md:mb-14', center && 'mx-auto max-w-3xl text-center')}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="text-2xl font-bold leading-tight md:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{body}</p>}
    </div>
  );
}

function Section({ id, children, muted }: { id?: string; children: ReactNode; muted?: boolean }) {
  return (
    <section id={id} className={cn('scroll-mt-40 py-16 md:py-24', muted && 'rounded-3xl bg-muted/40')}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">{children}</div>
    </section>
  );
}

const HEAT_CLASS = {
  low: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200',
  medium: 'bg-amber-400/30 text-amber-900 dark:text-amber-100',
  high: 'bg-orange-500/40 text-orange-950 dark:text-orange-50',
  critical: 'bg-red-600/70 text-white',
} as const;

function SampleDashboard() {
  const d = GRC_SAMPLE_DASHBOARD;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-primary/10">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">T</span>
          <span className="truncate text-sm font-semibold">{d.title}</span>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">Sample data</Badge>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {d.kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-border bg-background/60 p-3">
              <div className="text-[11px] text-muted-foreground">{k.label}</div>
              <div
                className={cn(
                  'text-2xl font-bold',
                  k.tone === 'danger' && 'text-red-600 dark:text-red-400',
                  k.tone === 'warning' && 'text-amber-600 dark:text-amber-400',
                )}
              >
                {k.value}
              </div>
              <div className="text-[11px] text-muted-foreground">{k.note}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-2 text-xs font-medium">Risk heatmap (likelihood × impact)</div>
            <div className="flex gap-1.5">
              <div className="flex w-3 items-center justify-center">
                <span className="-rotate-90 whitespace-nowrap text-[9px] text-muted-foreground">Likelihood</span>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-5 gap-1" role="img" aria-label="Sample risk heatmap of risk counts by likelihood and impact">
                  {d.heatmap.flatMap((row, r) =>
                    row.map((count, c) => (
                      <div
                        key={`${r}-${c}`}
                        className={cn('flex aspect-square items-center justify-center rounded text-xs font-semibold', HEAT_CLASS[heatBand(5 - r, c + 1)])}
                      >
                        {count}
                      </div>
                    )),
                  )}
                </div>
                <div className="mt-1 text-center text-[9px] text-muted-foreground">Impact</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-3 text-xs font-medium">Compliance by framework</div>
            <div className="space-y-2.5">
              {d.frameworks.map((f) => (
                <div key={f.name}>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span>{f.name}</span>
                    <span className="font-semibold">{f.value}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${f.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-2 text-xs font-medium">Overdue remediation tasks</div>
            <ul className="space-y-1.5">
              {d.overdue.map((o) => (
                <li key={o.task} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate">{o.task}</span>
                  <span className="flex shrink-0 items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 font-medium text-red-600 dark:text-red-400">
                    <Clock className="h-3 w-3" />
                    {o.days} days
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-2 text-xs font-medium">Policies awaiting approval</div>
            <ul className="space-y-1.5">
              {d.policies.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{p.stage}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/solutions" className="hover:text-foreground">Solutions</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">GRC</span>
      </nav>

      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div>
          <Badge variant="secondary" className="mb-5 bg-primary/10 text-primary">{GRC_HERO.eyebrow}</Badge>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            {GRC_HERO.title}{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{GRC_HERO.titleHighlight}</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">{GRC_HERO.body}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80" onClick={() => scrollToSection(GRC_DEMO_ID)}>
              <CalendarCheck className="mr-2 h-5 w-5" />
              Book a GRC Demo
            </Button>
            <Button size="lg" variant="outline" onClick={() => scrollToSection('grc-capabilities')}>
              Explore GRC Capabilities
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {GRC_HERO.chips.map((chip) => (
              <span key={chip} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                {chip}
              </span>
            ))}
          </div>
        </div>
        <SampleDashboard />
      </div>

      <nav aria-label="GRC page sections" className="mt-12 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card/70 p-2 backdrop-blur">
        {GRC_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToSection(s.id)}
            className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {s.label}
          </button>
        ))}
        <Link to="/pricing" className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          Pricing
        </Link>
        <Button size="sm" className="rounded-xl" onClick={() => scrollToSection(GRC_DEMO_ID)}>Book a GRC Demo</Button>
      </nav>
    </div>
  );
}

function WhatIs() {
  return (
    <Section>
      <div className="grid gap-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-8 md:grid-cols-[1fr_2fr] md:p-12">
        <h2 className="text-2xl font-bold md:text-3xl">{GRC_WHAT_IS.title}</h2>
        <div className="space-y-4 leading-relaxed text-muted-foreground">
          {GRC_WHAT_IS.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </div>
      </div>
    </Section>
  );
}

function Challenges() {
  return (
    <Section muted>
      <SectionHeading eyebrow={GRC_CHALLENGES.eyebrow} title={GRC_CHALLENGES.title} body={GRC_CHALLENGES.body} />
      <div className="space-y-4">
        {GRC_CHALLENGES.items.map((item) => (
          <div key={item.problem} className="grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-2">
            <div className="flex gap-4 p-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                <X className="h-4 w-4" />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Problem</p>
                <h3 className="font-semibold">{item.problem}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.problemBody}</p>
              </div>
            </div>
            <div className="flex gap-4 border-t border-border bg-primary/5 p-6 md:border-l md:border-t-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">With TopSqill</p>
                <p className="text-sm leading-relaxed">{item.solution}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <SectionLink to={GRC_DEMO_ID}>See how this works in a demo</SectionLink>
      </div>
    </Section>
  );
}

function Capabilities() {
  return (
    <Section id="grc-capabilities">
      <SectionHeading eyebrow={GRC_CAPABILITIES.eyebrow} title={GRC_CAPABILITIES.title} body={GRC_CAPABILITIES.body} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {GRC_CAPABILITIES.items.map(({ icon: Icon, title, body, link }) => (
          <div key={title} className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 font-semibold leading-snug">{title}</h3>
            <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            <SectionLink to={GRC_DEMO_ID} className="self-start text-left">{link}</SectionLink>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section id="grc-how-it-works" muted>
      <SectionHeading eyebrow={GRC_HOW_IT_WORKS.eyebrow} title={GRC_HOW_IT_WORKS.title} body={GRC_HOW_IT_WORKS.body} />
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {GRC_HOW_IT_WORKS.steps.map((step, i) => (
          <li key={step.title} className="relative rounded-2xl border border-border bg-card p-6">
            <span className="absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md ring-4 ring-background">
              {i + 1}
            </span>
            <h3 className="mb-2 mt-3 text-lg font-semibold">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 text-center">
        <Button size="lg" onClick={() => scrollToSection(GRC_DEMO_ID)}>
          Book a GRC Demo
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </Section>
  );
}

function AiWorkflows() {
  return (
    <Section id="grc-ai-workflows">
      <SectionHeading eyebrow={GRC_AI.eyebrow} title={GRC_AI.title} body={GRC_AI.body} />
      <div className="mb-8 flex flex-wrap justify-center gap-4 text-sm">
        {(Object.keys(GRC_AI.legend) as (keyof typeof GRC_AI.legend)[]).map((status) => (
          <div key={status} className="flex items-center gap-2">
            <StatusBadge status={status} />
            <span className="text-muted-foreground">{GRC_AI.legend[status].description}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GRC_AI.items.map((item) => (
          <div
            key={item.title}
            className={cn(
              'rounded-2xl border p-5',
              item.status === 'available' ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
            )}
          >
            <StatusBadge status={item.status} />
            <h3 className="mb-2 mt-3 font-semibold leading-snug">{item.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-start gap-4 rounded-2xl border border-border bg-muted/50 p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Hand className="h-5 w-5" />
        </div>
        <p className="text-sm leading-relaxed">
          <span className="font-semibold">Human in the loop, always. </span>
          <span className="text-muted-foreground">{GRC_AI.humanInTheLoop}</span>
        </p>
      </div>
    </Section>
  );
}

function StatusBadge({ status }: { status: keyof typeof GRC_AI.legend }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        status === 'available' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'available' ? 'bg-primary-foreground' : 'bg-primary')} />
      {GRC_AI.legend[status].label}
    </span>
  );
}

function Industries() {
  const [activeId, setActiveId] = useState(GRC_INDUSTRIES.items[0].id);
  const active = GRC_INDUSTRIES.items.find((i) => i.id === activeId) ?? GRC_INDUSTRIES.items[0];
  return (
    <Section id="grc-use-cases" muted>
      <SectionHeading eyebrow={GRC_INDUSTRIES.eyebrow} title={GRC_INDUSTRIES.title} body={GRC_INDUSTRIES.body} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div role="tablist" aria-label="Industries" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {GRC_INDUSTRIES.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === active.id}
              onClick={() => setActiveId(item.id)}
              className={cn(
                'shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors',
                item.id === active.id ? 'bg-primary text-primary-foreground shadow' : 'bg-card text-muted-foreground hover:bg-background hover:text-foreground',
              )}
            >
              {item.industry}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="rounded-2xl border border-border bg-card p-6 md:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{active.industry}</p>
          <h3 className="text-2xl font-bold md:text-3xl">{active.title}</h3>
          <p className="mt-3 leading-relaxed text-muted-foreground">{active.body}</p>
          <ul className="mt-6 space-y-3">
            {active.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-semibold">Frameworks: </span>
              <span className="text-muted-foreground">{active.frameworks}</span>
            </p>
            <SectionLink to={GRC_DEMO_ID}>{active.link}</SectionLink>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">{GRC_INDUSTRIES.note}</p>
    </Section>
  );
}

function WhyTopsqill() {
  const { comparison } = GRC_WHY;
  return (
    <Section>
      <SectionHeading eyebrow={GRC_WHY.eyebrow} title={GRC_WHY.title} body={GRC_WHY.body} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GRC_WHY.items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5">
            <Icon className="mb-3 h-6 w-6 text-primary" />
            <h3 className="mb-1.5 font-semibold">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14">
        <h3 className="mb-5 text-center text-xl font-bold md:text-2xl">{comparison.title}</h3>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-muted/60 text-left">
                <th className="px-5 py-3 font-semibold">{comparison.columns[0]}</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground">{comparison.columns[1]}</th>
                <th className="bg-primary/10 px-5 py-3 font-semibold text-primary">{comparison.columns[2]}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map(([area, spreadsheet, topsqill]) => (
                <tr key={area} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{area}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />{spreadsheet}</span>
                  </td>
                  <td className="bg-primary/5 px-5 py-3">
                    <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />{topsqill}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

function UseCase() {
  return (
    <Section muted>
      <SectionHeading eyebrow={GRC_USE_CASE.eyebrow} title={GRC_USE_CASE.title} body={GRC_USE_CASE.body} />
      <p className="-mt-8 mb-10 text-center text-xs italic text-muted-foreground">{GRC_USE_CASE.note}</p>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GRC_USE_CASE.steps.map(({ icon: Icon, title, role, body, output }, i) => (
          <li key={title} className="flex flex-col rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Step {i + 1}</span>
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{role}</p>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-xs">
              <span className="font-semibold text-primary">Output: </span>
              {output}
            </p>
          </li>
        ))}
        <li className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
          <p className="text-sm font-medium leading-relaxed">{GRC_USE_CASE.summary}</p>
          <button
            type="button"
            onClick={() => scrollToSection(GRC_DEMO_ID)}
            className="mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold underline-offset-4 hover:underline"
          >
            Map your AI governance workflow
            <ArrowRight className="h-4 w-4" />
          </button>
        </li>
      </ol>
    </Section>
  );
}

function Faq() {
  return (
    <Section id="grc-faq">
      <SectionHeading eyebrow={GRC_FAQ.eyebrow} title={GRC_FAQ.title} />
      <Accordion type="single" collapsible className="mx-auto max-w-3xl rounded-2xl border border-border bg-card px-6">
        {GRC_FAQ.items.map((item, i) => (
          <AccordionItem key={item.q} value={`faq-${i}`} className={i === GRC_FAQ.items.length - 1 ? 'border-b-0' : undefined}>
            <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
            <AccordionContent className="leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

function DemoForm() {
  const [values, setValues] = useState({ name: '', company: '', email: '', role: '', priority: '' });
  const [sent, setSent] = useState(false);
  const set = (patch: Partial<typeof values>) => setValues((prev) => ({ ...prev, ...patch }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    window.location.href = grcDemoMailto(values);
    setSent(true);
  };

  return (
    <section id={GRC_DEMO_ID} className="scroll-mt-40 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="grid overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-primary/5 lg:grid-cols-2">
          <div className="p-8 md:p-12">
            <h2 className="text-2xl font-bold leading-tight md:text-4xl">{GRC_DEMO.title}</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{GRC_DEMO.body}</p>
            <p className="mt-8 text-sm font-semibold">In your demo you’ll see:</p>
            <ul className="mt-3 space-y-3">
              {GRC_DEMO.youWillSee.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/contact" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
              Prefer to talk first? Contact our team
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="border-t border-border bg-card/80 p-8 backdrop-blur md:p-12 lg:border-l lg:border-t-0">
            <h3 className="text-xl font-semibold">Book a GRC Demo</h3>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">Takes under a minute. No obligation.</p>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="grc-demo-name">Full name</Label>
                <Input id="grc-demo-name" required autoComplete="name" value={values.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grc-demo-company">Company</Label>
                <Input id="grc-demo-company" required autoComplete="organization" value={values.company} onChange={(e) => set({ company: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="grc-demo-email">Work email</Label>
                <Input id="grc-demo-email" type="email" required autoComplete="email" value={values.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grc-demo-role">Job role</Label>
                <Input id="grc-demo-role" autoComplete="organization-title" placeholder="e.g. Head of Risk" value={values.role} onChange={(e) => set({ role: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grc-demo-priority">Main GRC priority</Label>
                <Select value={values.priority} onValueChange={(priority) => set({ priority })}>
                  <SelectTrigger id="grc-demo-priority"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {GRC_DEMO.priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" size="lg" className="mt-2 bg-gradient-to-r from-primary to-primary/80 sm:col-span-2">
                Book a GRC Demo
              </Button>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {sent
                  ? 'Your email app should open with your details filled in. Send it and a TopSqill specialist will contact you within one business day.'
                  : 'A TopSqill specialist will contact you within one business day. We use your details only to arrange your demo.'}{' '}
                <Link to="/privacy" className="underline underline-offset-2">Privacy policy</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function GrcSolution() {
  return (
    <div dir="ltr" lang="en">
      <Hero />
      <WhatIs />
      <Challenges />
      <Capabilities />
      <HowItWorks />
      <AiWorkflows />
      <Industries />
      <WhyTopsqill />
      <UseCase />
      <Faq />
      <DemoForm />
    </div>
  );
}
