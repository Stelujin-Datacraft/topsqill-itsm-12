import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Zap,
  BarChart2,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { backend as supabase } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import DashboardLayout from '@/components/DashboardLayout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Stats {
  totalConfigs: number;
  activeConfigs: number;
  totalTemplates: number;
  activeTemplates: number;
  emailsSentToday: number;
  emailsSentThisMonth: number;
}

export default function SettingsPage() {
  const { t } = useTranslation();
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

  return (
    <DashboardLayout 
      title={t('settings.title')} 
      description={t('settings.description')}
      actions={
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <BarChart2 className="h-4 w-4 mr-2 text-module-workflows" />
                {t('common.dataAnalytics')}
                <ChevronDown className="h-4 w-4 ms-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-background border border-border shadow-lg z-50">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('settings.emailStatistics')}</p>
              </div>
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-module-forms" />
                    <span className="text-sm">{t('settings.smtpConfigs')}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold">{stats.totalConfigs}</Badge>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-module-forms" />
                    <span className="text-sm">{t('settings.activeConfigs')}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold bg-primary/10 text-primary">{stats.activeConfigs}</Badge>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-module-forms" />
                    <span className="text-sm">{t('settings.templates')}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold">{stats.totalTemplates}</Badge>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-module-forms" />
                    <span className="text-sm">{t('settings.activeTemplates')}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold bg-primary/10 text-primary">{stats.activeTemplates}</Badge>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-module-forms" />
                    <span className="text-sm">{t('settings.emailsToday')}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold bg-primary/10 text-primary">{stats.emailsSentToday}</Badge>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-module-forms" />
                    <span className="text-sm">{t('settings.emailsThisMonth')}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold">{stats.emailsSentThisMonth}</Badge>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => navigate('/email-templates')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('settings.createTemplate')}
          </Button>
          <Button size="sm" onClick={() => navigate('/email-config')}>
            <Plus className="h-4 w-4 me-2" />
            {t('settings.addSmtpConfig')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-w-7xl">

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SMTP Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {t('settings.smtpConfiguration')}
            </CardTitle>
            <CardDescription>
              {t('settings.smtpDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.totalConfigs === 0 ? (
              <div className="text-center py-6">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Server className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">{t('settings.noSmtpServers')}</p>
                <Button onClick={() => navigate('/email-config')}>
                  <Plus className="h-4 w-4 me-2" />
                  {t('settings.addSmtpServer')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">{t('settings.activeServers')}</span>
                  </div>
                  <Badge variant="secondary">{stats.activeConfigs}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{t('settings.inactiveServers')}</span>
                  </div>
                  <Badge variant="outline">{stats.totalConfigs - stats.activeConfigs}</Badge>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/email-config')}
                >
                  {t('settings.manageSmtpSettings')}
                  <ArrowRight className="h-4 w-4 ms-2" />
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
              {t('settings.emailTemplates')}
            </CardTitle>
            <CardDescription>
              {t('settings.templatesDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.totalTemplates === 0 ? (
              <div className="text-center py-6">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">{t('settings.noTemplates')}</p>
                <Button onClick={() => navigate('/email-templates')}>
                  <Plus className="h-4 w-4 me-2" />
                  {t('settings.createTemplate')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-green-600" />
                    <span className="font-medium">{t('settings.activeTemplates')}</span>
                  </div>
                  <Badge variant="secondary">{stats.activeTemplates}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{t('settings.inactiveTemplates')}</span>
                  </div>
                  <Badge variant="outline">{stats.totalTemplates - stats.activeTemplates}</Badge>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/email-templates')}
                >
                  {t('settings.manageTemplates')}
                  <ArrowRight className="h-4 w-4 ms-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardLayout>
  );
}
