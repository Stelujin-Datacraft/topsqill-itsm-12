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
    <section aria-labelledby="investor-heading" className="py-20 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 opacity-60"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-primary/10 to-blue-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl"></div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-200">
            <span className="flex items-center gap-1">
              ✨ Investment Opportunity
            </span>
          </Badge>
          <h2 id="investor-heading" className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Partner with the Future of Enterprise Automation
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Join leading investors in revolutionizing how organizations collect, process, and act on data
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {metrics.map((metric, index) => (
            <Card key={index} className="text-center bg-white/80 backdrop-blur-sm border-border/50 hover:bg-white hover:scale-105 hover:shadow-lg transition-all duration-300 group">
              <CardContent className="pt-6">
                <metric.icon className="h-8 w-8 text-primary mx-auto mb-2 group-hover:text-primary/80 group-hover:scale-110 transition-all duration-300" />
                <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">{metric.value}</div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
                <Badge variant="outline" className="mt-2 text-emerald-600 border-emerald-500/50 bg-emerald-50 group-hover:bg-emerald-100 transition-all duration-300">
                  {metric.growth}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="bg-white/80 backdrop-blur-sm border-border/50 hover:bg-white hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Target className="h-5 w-5 text-primary" />
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

          <Card className="bg-white/80 backdrop-blur-sm border-border/50 hover:bg-white hover:shadow-lg transition-all duration-300">
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
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-semibold hover:from-primary/90 hover:to-indigo-500 transition-all duration-300 shadow-lg hover:shadow-xl">
            <DollarSign className="h-5 w-5" />
            <span className="font-medium">Seeking $8M Series A • Contact: investors@topsqill.com</span>
          </div>
        </div>
      </div>
    </section>
  );
}