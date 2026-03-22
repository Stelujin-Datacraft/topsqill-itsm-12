import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertCircle, CheckCircle2, XCircle, Loader2, Database } from 'lucide-react';

interface Props {
  perfProjectId?: string;
}

interface FieldQuality {
  fieldId: string;
  label: string;
  completeness: number;
  consistency: number;
  totalRecords: number;
  filledRecords: number;
  uniqueValues: number;
  hasOutliers: boolean;
  isNumeric: boolean;
}

// Known fields from the Performance Analytics Tracker form
const KNOWN_NUMERIC_LABELS = [
  'Planned Budget', 'Actual Cost', 'Earned Value (EV)', 'Actual Cost Value (AC)',
  'Planned Value (PV)', 'Risk Score', 'Predicted Delay Days', 'Predicted Cost Overrun (%)',
  'Planned Hours', 'Actual Hours', 'Defect Count', 'Forecasted Cost',
  'Passed Controls', 'Total Controls', 'Task Delay Days', 'Overtime Hours',
  'Risk Prediction Score',
];

const KNOWN_CATEGORY_LABELS = [
  'Project Status', 'Task Status', 'Risk Status', 'Priority',
];

export function DataQualityPanel({ perfProjectId }: Props) {
  const { currentProject } = useProject();

  const { data: dataSources = [] } = useQuery({
    queryKey: ['dq-data-sources', currentProject?.id, perfProjectId],
    queryFn: async () => {
      if (!currentProject?.id) return [];
      let q = supabase.from('performance_data_sources').select('*')
        .eq('project_id', currentProject.id).eq('is_active', true);
      if (perfProjectId) q = q.eq('performance_project_id', perfProjectId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!currentProject?.id,
  });

  const formId = dataSources[0]?.source_form_id;

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['dq-submissions', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data } = await supabase.from('form_submissions')
        .select('id, submission_data, submitted_at')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: true })
        .limit(500);
      return data || [];
    },
    enabled: !!formId,
  });

  // Fetch form fields directly
  const { data: formFields = [] } = useQuery({
    queryKey: ['dq-form-fields', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data } = await supabase.from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId);
      return data || [];
    },
    enabled: !!formId,
  });

  // Build quality scores from form fields directly
  const qualityScores = useMemo(() => {
    if (!submissions.length || !formFields.length) return [];

    // Analyze all known fields (numeric + category)
    const allKnownLabels = [...KNOWN_NUMERIC_LABELS, ...KNOWN_CATEGORY_LABELS];

    return formFields
      .filter((f: any) => allKnownLabels.includes(f.label))
      .map((f: any): FieldQuality => {
        const isNumeric = KNOWN_NUMERIC_LABELS.includes(f.label);
        const values = submissions.map((s: any) => {
          const raw = s.submission_data?.[f.id];
          if (raw == null) return undefined;
          if (typeof raw === 'object' && raw.value !== undefined) return raw.value;
          return raw;
        });
        const filled = values.filter(v => v != null && v !== '' && v !== undefined);
        const completeness = Math.round((filled.length / values.length) * 100);

        const uniqueValues = new Set(filled.map(String)).size;

        // Outlier detection for numeric fields
        let hasOutliers = false;
        if (isNumeric) {
          const nums = filled.map(Number).filter(n => !isNaN(n));
          if (nums.length > 3) {
            const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
            const stdDev = Math.sqrt(nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length);
            hasOutliers = stdDev > 0 && nums.some(n => Math.abs(n - mean) > 3 * stdDev);
          }
        }

        // Consistency
        const uniqueRatio = uniqueValues / Math.max(filled.length, 1);
        const consistency = !isNumeric
          ? Math.round(Math.max(0, (1 - uniqueRatio) * 100))
          : completeness;

        return {
          fieldId: f.id,
          label: f.label,
          completeness,
          consistency,
          totalRecords: values.length,
          filledRecords: filled.length,
          uniqueValues,
          hasOutliers,
          isNumeric,
        };
      })
      .sort((a, b) => a.completeness - b.completeness); // Show worst first
  }, [submissions, formFields]);

  const overallScore = useMemo(() => {
    if (!qualityScores.length) return 0;
    const avg = qualityScores.reduce((sum, q) => sum + (q.completeness + q.consistency) / 2, 0) / qualityScores.length;
    return Math.round(avg);
  }, [qualityScores]);

  const overallGrade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F';
  const gradeColor = overallScore >= 90 ? 'text-green-600' : overallScore >= 75 ? 'text-primary' : overallScore >= 60 ? 'text-orange-500' : 'text-red-500';

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!formId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">No data source configured</p>
          <p className="text-sm text-muted-foreground mt-1">Link a form in the Data Sources tab to see quality scores.</p>
        </CardContent>
      </Card>
    );
  }

  if (!qualityScores.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">No submission data found</p>
          <p className="text-sm text-muted-foreground mt-1">Submit records to the linked form to analyze data quality.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Data Quality Scoring
        </h2>
        <p className="text-sm text-muted-foreground">
          Automated assessment of data completeness, consistency, and reliability across {submissions.length} submissions
        </p>
      </div>

      {/* Overall Score */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="pt-5 pb-4 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-1">Overall Quality Grade</p>
            <p className={`text-5xl font-black ${gradeColor}`}>{overallGrade}</p>
            <p className="text-sm font-medium text-foreground mt-1">{overallScore}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Records</p>
            <p className="text-2xl font-bold text-foreground">{submissions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Fields Analyzed</p>
            <p className="text-2xl font-bold text-primary">{qualityScores.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Fields with Issues</p>
            <p className="text-2xl font-bold text-orange-500">
              {qualityScores.filter(q => q.completeness < 80 || q.hasOutliers).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Field Quality */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Field-Level Quality Breakdown</CardTitle>
          <CardDescription className="text-xs">Completeness and consistency for each tracked field</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qualityScores.map(q => (
            <div key={q.fieldId} className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {q.completeness >= 90 && !q.hasOutliers ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : q.completeness < 60 || q.hasOutliers ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm font-medium">{q.label}</span>
                  <Badge variant="outline" className="text-[10px]">{q.isNumeric ? 'Numeric' : 'Category'}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {q.hasOutliers && (
                    <Badge variant="destructive" className="text-[10px]">Outliers</Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {q.filledRecords}/{q.totalRecords} filled
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {q.uniqueValues} unique
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Completeness</span>
                    <span className="text-xs font-medium">{q.completeness}%</span>
                  </div>
                  <Progress value={q.completeness} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Consistency</span>
                    <span className="text-xs font-medium">{q.consistency}%</span>
                  </div>
                  <Progress value={q.consistency} className="h-2" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
