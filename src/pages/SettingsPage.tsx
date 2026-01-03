import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Server, 
  Plus, 
  Settings, 
  Send, 
  FileText, 
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

interface Stats {
  totalConfigs: number;
  activeConfigs: number;
  totalTemplates: number;
  activeTemplates: number;
  emailsSentToday: number;
  emailsSentThisMonth: number;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const [stats, setStats] = useState<Stats>({
    totalConfigs: 0,
    activeConfigs: 0,
    totalTemplates: 0,
    activeTemplates: 0,
    emailsSentToday: 0,
    emailsSentThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [userProfile?.organization_id, currentProject?.id]);

  const loadStats = async () => {
    if (!userProfile?.organization_id) {
      setLoading(false);
      return;
    }

    try {
      // Load SMTP configs count
      const { data: configs } = await supabase
        .from('smtp_configs')
        .select('id, is_active')
        .eq('organization_id', userProfile.organization_id);

      // Load email templates count
      const { data: templates } = await supabase
        .from('email_templates')
        .select('id, is_active')
        .eq('project_id', currentProject?.id || '');

      // Load email logs for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: todayLogs } = await supabase
        .from('email_logs')
        .select('id')
        .eq('organization_id', userProfile.organization_id)
        .gte('created_at', today.toISOString());

      // Load email logs for this month
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const { data: monthLogs } = await supabase
        .from('email_logs')
        .select('id')
        .eq('organization_id', userProfile.organization_id)
        .gte('created_at', monthStart.toISOString());

      setStats({
        totalConfigs: configs?.length || 0,
        activeConfigs: configs?.filter(c => c.is_active).length || 0,
        totalTemplates: templates?.length || 0,
        activeTemplates: templates?.filter(t => t.is_active).length || 0,
        emailsSentToday: todayLogs?.length || 0,
        emailsSentThisMonth: monthLogs?.length || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    icon: Icon, 
    label, 
    value, 
    subValue, 
    trend 
  }: { 
    icon: React.ElementType; 
    label: string; 
    value: number; 
    subValue?: string;
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-to-br from-card to-card/80">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              {subValue && (
                <span className="text-sm text-muted-foreground">{subValue}</span>
              )}
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const QuickActionCard = ({ 
    icon: Icon, 
    title, 
    description, 
    onClick, 
    variant = 'default' 
  }: { 
    icon: React.ElementType; 
    title: string; 
    description: string; 
    onClick: () => void;
    variant?: 'default' | 'primary';
  }) => (
    <Card 
      className={`cursor-pointer group hover:shadow-lg transition-all duration-300 border-border/50 ${
        variant === 'primary' 
          ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground' 
          : 'bg-card hover:bg-accent/50'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
            variant === 'primary' 
              ? 'bg-primary-foreground/20' 
              : 'bg-primary/10'
          }`}>
            <Icon className={`h-5 w-5 ${variant === 'primary' ? 'text-primary-foreground' : 'text-primary'}`} />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className={`font-semibold ${variant === 'primary' ? 'text-primary-foreground' : ''}`}>
              {title}
            </h3>
            <p className={`text-sm ${variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {description}
            </p>
          </div>
          <ArrowRight className={`h-5 w-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ${
            variant === 'primary' ? 'text-primary-foreground' : 'text-muted-foreground'
          }`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Mail className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Email Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Manage SMTP settings and email templates for your organization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/email-config')}>
            <Server className="h-4 w-4 mr-2" />
            SMTP Settings
          </Button>
          <Button onClick={() => navigate('/email-templates')}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Server} 
          label="SMTP Configurations" 
          value={stats.totalConfigs}
          subValue={`${stats.activeConfigs} active`}
        />
        <StatCard 
          icon={FileText} 
          label="Email Templates" 
          value={stats.totalTemplates}
          subValue={`${stats.activeTemplates} active`}
        />
        <StatCard 
          icon={Send} 
          label="Emails Today" 
          value={stats.emailsSentToday}
        />
        <StatCard 
          icon={Activity} 
          label="Emails This Month" 
          value={stats.emailsSentThisMonth}
        />
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-background">
            <Sparkles className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="smtp" className="data-[state=active]:bg-background">
            <Server className="h-4 w-4 mr-2" />
            SMTP
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-background">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <QuickActionCard
                icon={Plus}
                title="Add SMTP Server"
                description="Configure a new SMTP server for sending emails"
                onClick={() => navigate('/email-config')}
                variant="primary"
              />
              <QuickActionCard
                icon={FileText}
                title="Create Template"
                description="Design a new email template with variables"
                onClick={() => navigate('/email-templates')}
              />
              <QuickActionCard
                icon={Send}
                title="Test Connection"
                description="Verify your SMTP configuration is working"
                onClick={() => navigate('/email-config')}
              />
            </div>
          </div>

          {/* Status Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Server className="h-5 w-5 text-primary" />
                  SMTP Status
                </CardTitle>
                <CardDescription>
                  Current status of your email server configurations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.totalConfigs === 0 ? (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Server className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">No SMTP servers configured</p>
                    <Button onClick={() => navigate('/email-config')} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Server
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Active Servers</span>
                      </div>
                      <Badge variant="secondary">{stats.activeConfigs}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">Inactive Servers</span>
                      </div>
                      <Badge variant="outline">{stats.totalConfigs - stats.activeConfigs}</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => navigate('/email-config')}
                    >
                      Manage SMTP Settings
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Templates Status
                </CardTitle>
                <CardDescription>
                  Overview of your email templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.totalTemplates === 0 ? (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">No email templates created</p>
                    <Button onClick={() => navigate('/email-templates')} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Active Templates</span>
                      </div>
                      <Badge variant="secondary">{stats.activeTemplates}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">Inactive Templates</span>
                      </div>
                      <Badge variant="outline">{stats.totalTemplates - stats.activeTemplates}</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => navigate('/email-templates')}
                    >
                      Manage Templates
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="smtp" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    SMTP Configuration
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Configure and manage your SMTP servers for sending emails
                  </CardDescription>
                </div>
                <Button onClick={() => navigate('/email-config')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">SMTP Server Management</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Add, edit, and test your SMTP server configurations. Set default servers and manage connection settings.
                </p>
                <Button onClick={() => navigate('/email-config')}>
                  Go to SMTP Settings
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Email Templates
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Create and manage dynamic email templates with variables
                  </CardDescription>
                </div>
                <Button onClick={() => navigate('/email-templates')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Email Template Designer</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Design beautiful email templates with dynamic variables. Use them in workflows and form automations.
                </p>
                <Button onClick={() => navigate('/email-templates')}>
                  Go to Templates
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
