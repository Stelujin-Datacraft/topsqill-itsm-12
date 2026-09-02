import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowRight, CheckCircle, Sparkles,
} from 'lucide-react';
import { useSolutionsContent } from '@/content/solutions/useSolutionsContent';
import type { SolutionStep } from '@/content/solutions/steps';
import SiteHeader from '@/components/layout/SiteHeader';

const Timeline: React.FC<{ steps: SolutionStep[] }> = ({ steps }) => (
  <div className="relative max-w-6xl mx-auto" dir="ltr" lang="en">
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
                <h3 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-5">{step.description}</p>
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
                    decoding="async"
                    width={1280}
                    height={720}
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
);

const Solutions: React.FC = () => {
  const { t } = useTranslation();
  const solutions = useSolutionsContent();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const validIds = solutions.map((s) => s.id);
  const activeTab = initialTab && validIds.includes(initialTab) ? initialTab : 'onboarding';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SiteHeader />

      <header className="container mx-auto px-4 pt-12 md:pt-16 pb-6 text-center">
        <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary">
          <Sparkles className="icon-xs mr-1" />
          {t('solutionsPage.badge')}
        </Badge>
        <h1 className="text-3xl md:text-5xl font-bold mb-3 leading-tight">
          {t('solutionsPage.heading')}{' '}
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {t('solutionsPage.headingHighlight')}
          </span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          {t('solutionsPage.subheading')}
        </p>
      </header>

      <section className="container mx-auto px-4 pb-20">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="sticky top-[4.5rem] z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-border/50">
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
                    {t('solutionsPage.tryScenario')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              <Card className="max-w-4xl mx-auto border-primary/20 bg-card/60 backdrop-blur mb-8">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-3 shrink-0">
                      <CheckCircle className="icon-xl text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-semibold mb-2">{s.scenarioTitle}</h3>
                      <p className="text-muted-foreground leading-relaxed">{s.scenarioBody}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="py-8 md:py-14">
                <Timeline steps={s.steps} />
              </div>

              <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/30">
                <CardContent className="p-8 md:p-12 text-center">
                  <h3 className="text-2xl md:text-3xl font-bold mb-3">
                    {t('solutionsPage.ctaTitle')}
                  </h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                    {t('solutionsPage.ctaBody')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/auth">
                      <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80">
                        {t('solutionsPage.startTrialCta')}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    <Link to="/">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto">
                        {t('solutionsPage.explorePlatform')}
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
