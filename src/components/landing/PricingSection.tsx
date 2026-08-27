import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Building2, Crown, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { PRICING_PLANS } from "@/content/pricing";

const ICONS = {
  starter: Zap,
  professional: Building2,
  business: Briefcase,
  enterprise: Crown,
} as const;

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-gradient-to-br from-muted/30 to-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary">
            Simple Pricing
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Choose the Right Plan for Your Team
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            USD and INR list prices on our{' '}
            <Link to="/pricing" className="text-primary underline underline-offset-4">Pricing page</Link>
            . Start free and scale as you grow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {PRICING_PLANS.map((plan) => {
            const Icon = ICONS[plan.id as keyof typeof ICONS] || Building2;
            return (
              <Card
                key={plan.id}
                className={`relative group hover:shadow-token-md transition-all duration-300 ${
                  plan.popular
                    ? 'border-primary shadow-lg'
                    : 'border-border/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <Icon className={`h-10 w-10 mx-auto mb-4 ${
                    plan.popular ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-base">{plan.description}</CardDescription>
                  <div className="mt-4 space-y-1">
                    <div>
                      <span className="text-3xl font-bold text-foreground">{plan.priceLabelUsd}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {plan.priceLabelInr}{plan.period ? ` ${plan.period.replace('/seat/month', 'INR / seat / month').replace('/month', 'INR / month')}` : ''}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className={`h-5 w-5 flex-shrink-0 ${
                          plan.popular ? 'text-primary' : 'text-success'
                        }`} />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button asChild variant={plan.popular ? 'default' : 'outline'} className="w-full">
                    <Link to={plan.ctaTo}>{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12 text-muted-foreground space-y-2">
          <p>All plans include: SSL encryption • GDPR compliance • 99.9% uptime target</p>
          <p>
            <Link to="/pricing" className="text-primary underline underline-offset-4">Full pricing details</Link>
            {' · '}
            <Link to="/contact" className="text-primary underline underline-offset-4">Contact sales</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
