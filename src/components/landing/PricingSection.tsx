import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Building2, Crown } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    icon: Zap,
    price: "Free",
    period: "",
    description: "Perfect for small teams getting started",
    features: [
      "Up to 5 forms",
      "100 submissions/month",
      "Basic form builder",
      "Email notifications",
      "Community support",
      "Standard templates"
    ],
    cta: "Get Started Free",
    variant: "outline" as const,
    popular: false
  },
  {
    name: "Professional",
    icon: Building2,
    price: "$49",
    period: "/month",
    description: "For growing teams with advanced needs",
    features: [
      "Unlimited forms",
      "10,000 submissions/month",
      "Advanced form builder",
      "Workflow automation",
      "SQL query engine",
      "Priority support",
      "Custom branding",
      "API access"
    ],
    cta: "Start Free Trial",
    variant: "default" as const,
    popular: true
  },
  {
    name: "Enterprise",
    icon: Crown,
    price: "Custom",
    period: "",
    description: "For organizations requiring maximum control",
    features: [
      "Everything in Professional",
      "Unlimited submissions",
      "SSO/SAML integration",
      "Advanced security controls",
      "Dedicated account manager",
      "SLA guarantee",
      "On-premise deployment",
      "Custom integrations"
    ],
    cta: "Contact Sales",
    variant: "outline" as const,
    popular: false
  }
];

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
            Start free and scale as you grow. No hidden fees, cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 ${
                plan.popular 
                  ? 'border-primary shadow-lg scale-105 md:scale-110' 
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
                <plan.icon className={`h-10 w-10 mx-auto mb-4 ${
                  plan.popular ? 'text-primary' : 'text-muted-foreground'
                }`} />
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-base">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className={`h-5 w-5 flex-shrink-0 ${
                        plan.popular ? 'text-primary' : 'text-emerald-600'
                      }`} />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/auth">
                  <Button 
                    variant={plan.variant}
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-foreground text-background hover:bg-foreground/90' 
                        : ''
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 text-muted-foreground">
          <p>All plans include: SSL encryption • GDPR compliance • 99.9% uptime SLA</p>
        </div>
      </div>
    </section>
  );
}
