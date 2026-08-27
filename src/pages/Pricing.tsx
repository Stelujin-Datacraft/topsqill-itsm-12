import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Building2, Crown, Zap, Briefcase } from 'lucide-react';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PRICING_PLANS } from '@/content/pricing';

const ICONS = {
  starter: Zap,
  professional: Building2,
  business: Briefcase,
  enterprise: Crown,
} as const;

export default function Pricing() {
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');

  const plans = useMemo(() => PRICING_PLANS, []);

  return (
    <PublicPageLayout
      eyebrow="Pricing"
      title="Plans for every stage"
      description="Published list prices in USD and INR. No hidden modules for core forms and workflows — pick a tier or talk to us for Enterprise."
      contentClassName="max-w-6xl mx-auto"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        <Button
          type="button"
          size="sm"
          variant={currency === 'USD' ? 'default' : 'outline'}
          onClick={() => setCurrency('USD')}
        >
          USD
        </Button>
        <Button
          type="button"
          size="sm"
          variant={currency === 'INR' ? 'default' : 'outline'}
          onClick={() => setCurrency('INR')}
        >
          INR
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const Icon = ICONS[plan.id as keyof typeof ICONS] || Building2;
          const price = currency === 'USD' ? plan.priceLabelUsd : plan.priceLabelInr;
          return (
            <Card
              key={plan.id}
              className={`relative border-border/60 shadow-sm ${plan.popular ? 'ring-2 ring-primary' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
              )}
              <CardHeader>
                <Icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-2">
                  <span className="text-3xl font-semibold tracking-tight">{price}</span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                  <Link to={plan.ctaTo}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Prices shown are list prices and may vary by contract term. Need a custom rollout?{' '}
        <Link to="/contact" className="text-primary underline underline-offset-4">Contact sales</Link>
        {' · '}
        <Link to="/blog" className="text-primary underline underline-offset-4">Read the blog</Link>
      </p>
    </PublicPageLayout>
  );
}
