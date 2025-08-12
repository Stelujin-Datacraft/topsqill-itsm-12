import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, DollarSign, Globe, Target, ArrowUpRight } from "lucide-react";

export default function InvestorSection() {
  const metrics = [
    { icon: Users, label: "Active Organizations", value: "500+", growth: "+240%" },
    { icon: TrendingUp, label: "Monthly Forms Created", value: "50K+", growth: "+180%" },
    { icon: Globe, label: "Countries Served", value: "25+", growth: "Global" },
    { icon: DollarSign, label: "ARR Growth", value: "$2M+", growth: "+320%" }
  ];

  const highlights = [
    "Pre-Series A funding round open",
    "Validated product-market fit",
    "Enterprise customers including Fortune 500",
    "Patent-pending workflow automation",
    "AI roadmap with clear monetization",
    "Experienced founding team"
  ];

  return (
    <section aria-labelledby="investor-heading" className="py-20 bg-gradient-to-r from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Investment Opportunity</Badge>
          <h2 id="investor-heading" className="text-3xl font-bold mb-4">
            Partner with the Future of Enterprise Automation
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Join leading investors in revolutionizing how organizations collect, process, and act on data
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {metrics.map((metric, index) => (
            <Card key={index} className="text-center">
              <CardContent className="pt-6">
                <metric.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
                <Badge variant="outline" className="mt-2 text-green-600">
                  {metric.growth}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Market Opportunity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">$15B</div>
                  <div className="text-sm text-muted-foreground">Total Addressable Market</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">$4B</div>
                  <div className="text-sm text-muted-foreground">Serviceable Market</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Key Market Trends:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Digital transformation acceleration (+40% YoY)</li>
                  <li>• No-code/low-code adoption (+85% in enterprise)</li>
                  <li>• AI integration demand (+150% growth)</li>
                  <li>• Workflow automation necessity (90% of enterprises)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Investment Highlights</CardTitle>
              <CardDescription>Why leading VCs are choosing Topsqill</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {highlights.map((highlight, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">{highlight}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex gap-3">
                <Button>
                  View Investor Deck
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline">Schedule Meeting</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <DollarSign className="h-5 w-5" />
            <span className="font-medium">Seeking $8M Series A • Contact: investors@topsqill.com</span>
          </div>
        </div>
      </div>
    </section>
  );
}