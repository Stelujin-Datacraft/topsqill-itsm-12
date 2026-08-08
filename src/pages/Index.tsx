
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, Building2, Users, Shield, Zap, BarChart3, Workflow, 
  Database, Brain, Sparkles, TrendingUp, Globe, CheckCircle,
  LineChart, Table, GitBranch, Code, Star, Award, MapPin, Mail
} from 'lucide-react';
import ChartsPreview from '@/components/landing/ChartsPreview';
import HeroPromptPanel from '@/components/landing/HeroPromptPanel';
import SQLDemo from '@/components/landing/SQLDemo';
import FormBuilderMini from '@/components/landing/FormBuilderMini';
import WorkflowPreview from '@/components/landing/WorkflowPreview';
import FutureRoadmap from '@/components/landing/FutureRoadmap';
import InvestorSection from '@/components/landing/InvestorSection';
import FAQSection from '@/components/landing/FAQSection';
import AnnouncementHistory from '@/components/landing/AnnouncementHistory';
import DataTablePreview from '@/components/landing/DataTablePreview';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import IntegrationsSection from '@/components/landing/IntegrationsSection';
import { AppIcon } from '@/components/icons';
import TrustLogosSection from '@/components/landing/TrustLogosSection';

const Index = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('landing.title');
  }, [t]);

  return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Navigation */}
        <nav className="border-b border-border/60 bg-background/85 backdrop-blur-xl sticky top-0 z-50 shadow-xs">
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
              <a href="#roadmap" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.roadmap')}</a>
              <a href="#investors" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.investors')}</a>
              <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.faq')}</a>
              <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/auth" className="flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">{t('nav.signIn')}</Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main>
          <section className="container mx-auto px-4 py-16 sm:py-24 text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold mb-6 text-foreground leading-[1.1] tracking-tight">
              {t('landing.heroTitle')}<br />
              <span className="text-3xl md:text-4xl lg:text-5xl text-muted-foreground font-medium">{t('landing.heroSubtitle')}</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              {t('landing.heroDescription')}
            </p>
            
            <HeroPromptPanel />

            <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <TrendingUp className="icon-md" />
                {t('landing.orgs')}
              </div>
              <div className="flex items-center gap-2">
                <Users className="icon-md" />
                {t('landing.formsCreated')}
              </div>
              <div className="flex items-center gap-2">
                <Globe className="icon-md" />
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
                    gradient: "hover:bg-gradient-to-r hover:from-accent/5 hover:to-secondary/5 hover:border-accent/20"
                  },
                  {
                    icon: BarChart3,
                    title: "Advanced Analytics",
                    description: "Real-time dashboards, custom reports, submission tracking, and powerful data visualization tools.",
                    gradient: "hover:bg-gradient-to-r hover:from-info/5 hover:to-accent/5 hover:border-info/20"
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
                    className={`hover:shadow-token-md transition-all duration-500 group/card cursor-pointer ${
                      feature.gradient || 'hover:border-primary/30 hover:bg-gradient-to-br hover:from-primary/5 hover:to-secondary/5'
                    }`}
                  >
                    <CardHeader>
                      <AppIcon
                        icon={feature.icon}
                        size="2xl"
                        boxed="lg"
                        className={
                          feature.title === "Advanced Analytics"
                            ? "text-info"
                            : feature.title === "Visual Workflows"
                            ? "text-accent"
                            : "text-success"
                        }
                      />
                      <CardTitle className="text-xl mt-4 group-hover/card:text-primary transition-colors duration-300">{feature.title}</CardTitle>
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

        </main>

        {/* Footer */}
        <footer className="border-t bg-muted/20">
          <div className="container mx-auto px-4 py-14">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png"
                    alt="TopSqill Logo"
                    className="size-9 object-contain"
                  />
                  <span className="text-xl font-bold tracking-tight">TopSqill</span>
                </div>
                <p className="text-muted-foreground max-w-md leading-relaxed">
                  Enterprise form platform powering the next generation of business automation.
                </p>
              </div>

              <div className="space-y-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  Contact
                </h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <span>
                      B-439, Bhutani Technopark, Sector 127<br />
                      Noida — 201313, India
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <a href="mailto:contact@topsqill.com" className="hover:text-primary transition-colors">
                      contact@topsqill.com
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.linkedin.com/company/topsqill-pvt-ltd/posts/?feedView=all"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      LinkedIn — TopSqill Pvt Ltd
                    </a>
                  </li>
                  <li>
                    <Link to="/contact" className="text-primary font-medium hover:underline">
                      Contact page →
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-border/60 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} TopSqill. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
  );
};

export default Index;
