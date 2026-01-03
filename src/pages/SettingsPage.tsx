import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Server, 
  Plus, 
  Send, 
  FileText, 
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
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
    subValue
  }: { 
    icon: React.ElementType; 
    label: string; 
    value: number; 
    subValue?: string;
  }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold">{value}</p>
              {subValue && (
                <span className="text-sm text-muted-foreground">{subValue}</span>
              )}
            </div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Email Configuration</h1>
            <p className="text-muted-foreground">
              Manage SMTP settings and email templates
            </p>
          </div>
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SMTP Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              SMTP Configuration
            </CardTitle>
            <CardDescription>
              Configure your email server settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.totalConfigs === 0 ? (
              <div className="text-center py-6">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Server className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">No SMTP servers configured</p>
                <Button onClick={() => navigate('/email-config')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add SMTP Server
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
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
                  className="w-full"
                  onClick={() => navigate('/email-config')}
                >
                  Manage SMTP Settings
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Templates Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Email Templates
            </CardTitle>
            <CardDescription>
              Create and manage email templates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.totalTemplates === 0 ? (
              <div className="text-center py-6">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">No email templates created</p>
                <Button onClick={() => navigate('/email-templates')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-green-600" />
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
                  className="w-full"
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
    </div>
  );
}
