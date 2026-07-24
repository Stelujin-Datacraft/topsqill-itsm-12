
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, Building2, Users, Shield, Zap, BarChart3, Workflow, 
  Database, Brain, Sparkles, TrendingUp, Globe, CheckCircle,
  LineChart, Table, GitBranch, Code, Star, Award
} from 'lucide-react';
import AnnouncementBanner from '@/components/landing/AnnouncementBanner';
import ChartsPreview from '@/components/landing/ChartsPreview';
import SQLDemo from '@/components/landing/SQLDemo';
import FormBuilderMini from '@/components/landing/FormBuilderMini';
import WorkflowPreview from '@/components/landing/WorkflowPreview';
import FutureRoadmap from '@/components/landing/FutureRoadmap';
import InvestorSection from '@/components/landing/InvestorSection';
import FAQSection from '@/components/landing/FAQSection';
import AnnouncementHistory from '@/components/landing/AnnouncementHistory';
import DataTablePreview from '@/components/landing/DataTablePreview';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PricingSection from '@/components/landing/PricingSection';
import IntegrationsSection from '@/components/landing/IntegrationsSection';
import TrustLogosSection from '@/components/landing/TrustLogosSection';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const Index = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('landing.title');
  }, [t]);

  return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Beta Status Banner */}
        <AnnouncementBanner />
        
        {/* Navigation */}
        <nav className="border-b bg-background/90 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png" 
                alt="TopSqill" 
                className="w-9 h-9 object-contain"
              />
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                {t('common.appName')}
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.features')}</a>
              <a href="#showcase" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.showcase')}</a>
              <Link to="/solutions" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.solutions')}</Link>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.pricing')}</a>
              <a href="#roadmap" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.roadmap')}</a>
              <a href="#investors" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.investors')}</a>
              <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.faq')}</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSwitcher variant="ghost" />
              <Link to="/auth" className="flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">{t('nav.signIn')}</Button>
              </Link>
              <Link to="/auth" className="flex-1 sm:flex-initial">
                <Button size="sm" className="w-full sm:w-auto">
                  {t('nav.startTrial')}
                  <ArrowRight className="ms-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main>
          <section className="container mx-auto px-4 py-16 sm:py-24 text-center">
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-200">
                <CheckCircle className="w-3 h-3 me-1" />
                {t('landing.soc2')}
              </Badge>
              <Badge variant="secondary" className="bg-sky-50 text-sky-800 border-sky-200">
                <Star className="w-3 h-3 me-1" />
                {t('landing.rating')}
              </Badge>
              <Badge variant="secondary" className="bg-violet-50 text-violet-800 border-violet-200">
                <Award className="w-3 h-3 me-1" />
                {t('landing.enterpriseReady')}
              </Badge>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold mb-6 text-foreground leading-[1.1] tracking-tight">
              {t('landing.heroTitle')}<br />
              <span className="text-3xl md:text-4xl lg:text-5xl text-muted-foreground font-medium">{t('landing.heroSubtitle')}</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              {t('landing.heroDescription')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto min-w-[220px]">
                  {t('landing.startTrialCta')}
                  <ArrowRight className="ms-2 h-5 w-5" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[220px]">
                <Globe className="me-2 h-5 w-5" />
                {t('landing.watchDemo')}
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('landing.orgs')}
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('landing.formsCreated')}
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('landing.countries')}
              </div>
            </div>
          </section>

          {/* Trust Logos */}
          <TrustLogosSection />

          {/* Capabilities Showcase */}
          <section id="showcase" className="py-20 bg-gradient-to-br from-secondary/5 to-background">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <Badge variant="secondary" className="mb-4">{t('landing.showcaseBadge')}</Badge>
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
                  {t('landing.showcaseTitle')}
                </h2>
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  {t('landing.showcaseDescription')}
                </p>
              </div>

              <div className="space-y-16">
                <ChartsPreview />
                <DataTablePreview />
                <SQLDemo />
                <FormBuilderMini />
                <WorkflowPreview />
              </div>
            </div>
          </section>

          {/* Core Features */}
          <section id="features" className="py-20 bg-gradient-to-br from-background to-primary/5">
            <div className="container mx-auto px-4 group">{/* Add group class for hover effects */}
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Everything you need for enterprise forms
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  From simple feedback forms to complex multi-step workflows
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  {
                    icon: Building2,
                    title: "Organization Management",
                    description: "Multi-tenant architecture with organization-based user management, roles, and permissions that scale with your business."
                  },
                  {
                    icon: Users,
                    title: "Advanced User Controls",
                    description: "Admin approval workflows, role-based access control, user request management, and enterprise SSO integration."
                  },
                  {
                    icon: Shield,
                    title: "Enterprise Security",
                    description: "Row-level security, organization isolation, SOC 2 compliance, GDPR compliance, and comprehensive audit logs."
                  },
                  {
                    icon: Zap,
                    title: "Smart Form Builder",
                    description: "Drag-and-drop builder with conditional logic, validation rules, custom fields, and real-time collaboration."
                  },
                  {
                    icon: Database,
                    title: "SQL Query Engine",
                    description: "Query your form data directly with SQL. Create complex reports, join data, and export results instantly."
                  },
                  {
                    icon: Workflow,
                    title: "Visual Workflows",
                    description: "Automate approvals, notifications, integrations, and business processes with our visual workflow designer.",
                    gradient: "hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:border-purple-200"
                  },
                  {
                    icon: BarChart3,
                    title: "Advanced Analytics",
                    description: "Real-time dashboards, custom reports, submission tracking, and powerful data visualization tools.",
                    gradient: "hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-200"
                  },
                  {
                    icon: Brain,
                    title: "AI Integration Ready",
                    description: "Platform designed for AI features including form optimization, predictive analytics, and intelligent automation."
                  },
                  {
                    icon: Code,
                    title: "Developer Tools",
                    description: "REST APIs, webhooks, custom integrations, and white-label options for seamless system integration."
                  }
                ].map((feature, index) => (
                  <Card 
                    key={index} 
                    className={`hover:shadow-xl transition-all duration-500 hover:-translate-y-3 group/card cursor-pointer ${
                      feature.gradient || 'hover:border-primary/30 hover:bg-gradient-to-br hover:from-primary/5 hover:to-secondary/5'
                    }`}
                  >
                    <CardHeader className="group-hover/card:scale-105 transition-transform duration-300">
                      <feature.icon className={`h-12 w-12 mb-4 transition-all duration-500 ${
                        feature.title === "Advanced Analytics" 
                          ? "text-primary group-hover/card:text-blue-600 group-hover/card:scale-125 group-hover/card:drop-shadow-lg" 
                          : feature.title === "Visual Workflows"
                          ? "text-primary group-hover/card:text-purple-600 group-hover/card:scale-125 group-hover/card:drop-shadow-lg"
                          : "text-primary group-hover/card:scale-125 group-hover/card:text-emerald-600 group-hover/card:drop-shadow-lg"
                      }`} />
                      <CardTitle className="text-xl group-hover/card:text-primary transition-colors duration-300">{feature.title}</CardTitle>
                      <CardDescription className="text-base leading-relaxed group-hover/card:text-foreground transition-colors duration-300">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Integrations */}
          <IntegrationsSection />

          {/* Testimonials */}
          <TestimonialsSection />

          {/* Pricing */}
          <PricingSection />

          {/* Future Roadmap */}
          <section id="roadmap">
            <FutureRoadmap />
          </section>

          {/* Investor Section */}
          <section id="investors">
            <InvestorSection />
          </section>

          {/* Announcements Section */}
          <section id="announcements">
            <AnnouncementHistory />
          </section>

          {/* FAQ Section */}
          <section id="faq">
            <FAQSection />
          </section>

          {/* Final CTA Section */}
          <section className="py-20 bg-foreground text-background">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to transform your forms?
              </h2>
              <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
                Join 500+ organizations using Topsqill to automate their business processes
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/auth">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                    Start Free Trial - No Credit Card
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-background bg-background text-foreground hover:bg-background/90">
                  Schedule Enterprise Demo
                </Button>
              </div>
              <div className="mt-8 text-sm opacity-75">
                30-day free trial • Cancel anytime • Enterprise support included
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t bg-background">
          <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <img 
                    src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png" 
                    alt="Topsqill Logo" 
                    className="w-8 h-8 object-contain"
                  />
                  <span className="text-xl font-bold">TopSqill</span>
                </div>
                <p className="text-muted-foreground mb-4">
                  Enterprise form platform powering the next generation of business automation.
                </p>
                <div className="flex space-x-4">
                  <a href="#" className="text-muted-foreground hover:text-primary">Twitter</a>
                  <a href="#" className="text-muted-foreground hover:text-primary">LinkedIn</a>
                  <a href="#" className="text-muted-foreground hover:text-primary">GitHub</a>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-4">Product</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li><a href="#" className="hover:text-primary">Features</a></li>
                  <li><a href="#" className="hover:text-primary">Pricing</a></li>
                  <li><a href="#" className="hover:text-primary">Security</a></li>
                  <li><a href="#" className="hover:text-primary">Integrations</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-4">Company</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li><a href="#" className="hover:text-primary">About</a></li>
                  <li><a href="#" className="hover:text-primary">Careers</a></li>
                  <li><a href="#" className="hover:text-primary">Press</a></li>
                  <li><a href="#" className="hover:text-primary">Contact</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-4">Resources</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li><Link to="/docs" className="hover:text-module-relationship">Documentation</Link></li>
                  <li><Link to="/docs" className="hover:text-module-relationship">API Reference</Link></li>
                  <li><a href="#" className="hover:text-primary">Support</a></li>
                  <li><a href="#" className="hover:text-primary">Status</a></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
              <p>&copy; 2025 TopSqill. All rights reserved. | Privacy Policy | Terms of Service</p>
            </div>
          </div>
        </footer>
      </div>
  );
};

export default Index;
