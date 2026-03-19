import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Save, Loader2, Star, CheckCircle2 } from 'lucide-react';

interface Props {
  perfProjectId?: string;
}

const QUESTIONNAIRE_CATEGORIES = [
  {
    category: 'Data Integration',
    questions: [
      { key: 'di_1', text: 'Are all required data sources identified and connected?' },
      { key: 'di_2', text: 'Is the data refresh frequency adequate for decision-making?' },
      { key: 'di_3', text: 'Are field mappings validated and correctly configured?' },
      { key: 'di_4', text: 'Is data transformation logic documented and auditable?' },
    ],
  },
  {
    category: 'Performance Model',
    questions: [
      { key: 'pm_1', text: 'Are KPIs clearly defined with measurable targets?' },
      { key: 'pm_2', text: 'Is the data model flexible enough to accommodate future metrics?' },
      { key: 'pm_3', text: 'Are baseline values established for all tracked metrics?' },
      { key: 'pm_4', text: 'Is there a process for periodic KPI review and adjustment?' },
    ],
  },
  {
    category: 'AI & Analytics',
    questions: [
      { key: 'ai_1', text: 'Are AI-generated insights validated against ground truth?' },
      { key: 'ai_2', text: 'Is the confidence level of predictions communicated clearly?' },
      { key: 'ai_3', text: 'Are anomaly detection thresholds properly calibrated?' },
      { key: 'ai_4', text: 'Is there a feedback loop to improve AI accuracy over time?' },
    ],
  },
  {
    category: 'Reporting & Governance',
    questions: [
      { key: 'rg_1', text: 'Are reports accessible to all relevant stakeholders?' },
      { key: 'rg_2', text: 'Is there a defined escalation path for critical alerts?' },
      { key: 'rg_3', text: 'Are audit trails maintained for all configuration changes?' },
      { key: 'rg_4', text: 'Is role-based access control enforced for sensitive data?' },
    ],
  },
  {
    category: 'Risk & Compliance',
    questions: [
      { key: 'rc_1', text: 'Are risk thresholds aligned with organizational risk appetite?' },
      { key: 'rc_2', text: 'Is there a disaster recovery plan for performance data?' },
      { key: 'rc_3', text: 'Are data retention policies defined and enforced?' },
      { key: 'rc_4', text: 'Is compliance with relevant standards (ISO, SOC) verified?' },
    ],
  },
];

interface Response {
  question_key: string;
  score: number;
  notes: string;
}

export function TechnicalQuestionnaire({ perfProjectId }: Props) {
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(QUESTIONNAIRE_CATEGORIES[0].category);

  const { data: savedResponses = [], isLoading } = useQuery({
    queryKey: ['questionnaire-responses', currentProject?.id, perfProjectId],
    queryFn: async () => {
      if (!currentProject?.id || !perfProjectId) return [];
      const { data } = await supabase
        .from('performance_questionnaire_responses')
        .select('*')
        .eq('project_id', currentProject.id)
        .eq('performance_project_id', perfProjectId);
      return data || [];
    },
    enabled: !!currentProject?.id && !!perfProjectId,
  });

  useEffect(() => {
    if (savedResponses.length > 0) {
      const loaded: Record<string, Response> = {};
      savedResponses.forEach((r: any) => {
        loaded[r.question_key] = { question_key: r.question_key, score: r.score || 0, notes: r.notes || '' };
      });
      setResponses(loaded);
    }
  }, [savedResponses]);

  const saveResponses = useMutation({
    mutationFn: async () => {
      if (!currentProject?.id || !perfProjectId || !userProfile) throw new Error('Missing context');

      const allQuestions = QUESTIONNAIRE_CATEGORIES.flatMap(c =>
        c.questions.map(q => ({ ...q, category: c.category }))
      );

      const upsertData = allQuestions
        .filter(q => responses[q.key])
        .map(q => ({
          project_id: currentProject.id,
          performance_project_id: perfProjectId,
          organization_id: userProfile.organization_id || null,
          respondent_id: userProfile.id,
          category: q.category,
          question_key: q.key,
          question_text: q.text,
          response: responses[q.key]?.score > 0 ? `${responses[q.key].score}/5` : null,
          score: responses[q.key]?.score || 0,
          notes: responses[q.key]?.notes || null,
          updated_at: new Date().toISOString(),
        }));

      if (upsertData.length === 0) throw new Error('No responses to save');

      const { error } = await supabase
        .from('performance_questionnaire_responses')
        .upsert(upsertData, { onConflict: 'performance_project_id,respondent_id,question_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-responses'] });
      toast({ title: 'Questionnaire Saved', description: 'Your assessment has been saved successfully.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Save Failed', description: err.message, variant: 'destructive' });
    },
  });

  const setScore = (key: string, score: number) => {
    setResponses(prev => ({
      ...prev,
      [key]: { ...prev[key], question_key: key, score, notes: prev[key]?.notes || '' },
    }));
  };

  const setNotes = (key: string, notes: string) => {
    setResponses(prev => ({
      ...prev,
      [key]: { ...prev[key], question_key: key, score: prev[key]?.score || 0, notes },
    }));
  };

  const totalQuestions = QUESTIONNAIRE_CATEGORIES.reduce((sum, c) => sum + c.questions.length, 0);
  const answeredQuestions = Object.values(responses).filter(r => r.score > 0).length;
  const completionPct = Math.round((answeredQuestions / totalQuestions) * 100);
  const avgScore = answeredQuestions > 0
    ? Math.round(Object.values(responses).reduce((sum, r) => sum + r.score, 0) / answeredQuestions * 10) / 10
    : 0;
  const overallGrade = avgScore >= 4.5 ? 'A' : avgScore >= 3.5 ? 'B' : avgScore >= 2.5 ? 'C' : avgScore >= 1.5 ? 'D' : answeredQuestions > 0 ? 'F' : '-';

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Technical & Functional Assessment
          </h2>
          <p className="text-sm text-muted-foreground">
            Rate each area from 1 (Poor) to 5 (Excellent) to evaluate project readiness
          </p>
        </div>
        <Button onClick={() => saveResponses.mutate()} disabled={saveResponses.isPending || answeredQuestions === 0} className="gap-2">
          {saveResponses.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Assessment
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-1">Overall Grade</p>
            <p className={`text-5xl font-black ${avgScore >= 3.5 ? 'text-green-600' : avgScore >= 2.5 ? 'text-orange-500' : 'text-red-500'}`}>
              {overallGrade}
            </p>
            <p className="text-sm font-medium text-foreground mt-1">{avgScore}/5.0</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="text-2xl font-bold text-foreground">{completionPct}%</p>
            <Progress value={completionPct} className="h-2 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Questions Answered</p>
            <p className="text-2xl font-bold text-primary">{answeredQuestions}/{totalQuestions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Avg Score</p>
            <p className="text-2xl font-bold text-foreground">{avgScore}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Scores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {QUESTIONNAIRE_CATEGORIES.map(cat => {
            const catResponses = cat.questions.map(q => responses[q.key]).filter(r => r && r.score > 0);
            const catAvg = catResponses.length > 0 ? Math.round(catResponses.reduce((s, r) => s + r.score, 0) / catResponses.length * 10) / 10 : 0;
            const catPct = Math.round((catResponses.length / cat.questions.length) * 100);
            return (
              <div key={cat.category} className="p-3 rounded-lg border bg-card cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{catResponses.length}/{cat.questions.length}</Badge>
                    <Badge variant={catAvg >= 3.5 ? 'default' : catAvg > 0 ? 'secondary' : 'outline'} className="text-[10px]">
                      {catAvg > 0 ? `${catAvg}/5` : 'Not rated'}
                    </Badge>
                  </div>
                </div>
                <Progress value={catPct} className="h-1.5 mt-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Expanded Questions */}
      {expandedCategory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{expandedCategory}</CardTitle>
            <CardDescription className="text-xs">Rate each question from 1 to 5</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {QUESTIONNAIRE_CATEGORIES.find(c => c.category === expandedCategory)?.questions.map(q => {
              const resp = responses[q.key];
              const score = resp?.score || 0;
              return (
                <div key={q.key} className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-foreground flex-1">{q.text}</p>
                    {score > 0 && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setScore(q.key, s)}
                        className={`p-1.5 rounded transition-colors ${score >= s ? 'text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}>
                        <Star className={`h-5 w-5 ${score >= s ? 'fill-primary' : ''}`} />
                      </button>
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">
                      {score === 0 ? 'Not rated' : score === 1 ? 'Poor' : score === 2 ? 'Below Average' : score === 3 ? 'Average' : score === 4 ? 'Good' : 'Excellent'}
                    </span>
                  </div>
                  <Textarea
                    placeholder="Optional notes..."
                    value={resp?.notes || ''}
                    onChange={e => setNotes(q.key, e.target.value)}
                    className="text-xs min-h-[40px] resize-none"
                    rows={1}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
