import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertCircle, CheckCircle2, XCircle, Loader2, Database, FileText } from 'lucide-react';

interface Props {
  perfProjectId?: string;
  selectedRecordId?: string;
}

interface FieldQuality {
  fieldId: string;
  label: string;
  completeness: string;
  value: any;
  hasValue: boolean;
  isNumeric: boolean;
}

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

export function DataQualityPanel({ perfProjectId, selectedRecordId }: Props) {
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

  // Fetch the specific selected submission
  const { data: submission, isLoading } = useQuery({
    queryKey: ['dq-submission', selectedRecordId],
    queryFn: async () => {
      if (!selectedRecordId) return null;
      const { data } = await supabase.from('form_submissions')
        .select('id, submission_data, submitted_at, submission_ref_id')
        .eq('id', selectedRecordId)
        .single();
      return data || null;
    },
    enabled: !!selectedRecordId,
  });

  // Fetch form fields
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

  // Analyze the single record's field quality
  const qualityScores = useMemo(() => {
    if (!submission || !formFields.length) return [];
    const allKnownLabels = [...KNOWN_NUMERIC_LABELS, ...KNOWN_CATEGORY_LABELS];
    const submissionData = submission.submission_data || {};

    return formFields
      .filter((f: any) => allKnownLabels.includes(f.label))
      .map((f: any): FieldQuality => {
        const isNumeric = KNOWN_NUMERIC_LABELS.includes(f.label);
        let raw = submissionData[f.id];
        if (typeof raw === 'object' && raw !== null && 'value' in raw) raw = raw.value;

        const hasValue = raw != null && raw !== '' && raw !== undefined;
        return {
          fieldId: f.id,
          label: f.label,
          completeness: hasValue ? 'Complete' : 'Missing',
          value: hasValue ? raw : null,
          hasValue,
          isNumeric,
        };
      })
      .sort((a, b) => (a.hasValue === b.hasValue ? 0 : a.hasValue ? 1 : -1));
  }, [submission, formFields]);

  const filledCount = qualityScores.filter(q => q.hasValue).length;
  const totalFields = qualityScores.length;
  const completenessPercent = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;
  const overallGrade = completenessPercent >= 90 ? 'A' : completenessPercent >= 75 ? 'B' : completenessPercent >= 60 ? 'C' : completenessPercent >= 40 ? 'D' : 'F';
  const gradeColor = completenessPercent >= 90 ? 'text-green-600' : completenessPercent >= 75 ? 'text-primary' : completenessPercent >= 60 ? 'text-orange-500' : 'text-red-500';

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!formId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">No data source configured</p>
          <p className="text-sm text-muted-foreground mt-1">Link a form in the Data Sources tab first.</p>
        </CardContent>
      </Card>
    );
  }

  if (!selectedRecordId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">Select a Record</p>
          <p className="text-sm text-muted-foreground mt-1">Choose a record from the selector above to view its data quality.</p>
        </CardContent>
      </Card>
    );
  }

  if (!submission) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">Record not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Data Quality — Selected Record
        </h2>
        <p className="text-sm text-muted-foreground">
          Field completeness analysis for record {submission.submission_ref_id || submission.id.slice(0, 8)}
        </p>
      </div>

      {/* Overall Score */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-1">Quality Grade</p>
            <p className={`text-5xl font-black ${gradeColor}`}>{overallGrade}</p>
            <p className="text-sm font-medium text-foreground mt-1">{completenessPercent}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Fields Tracked</p>
            <p className="text-2xl font-bold text-foreground">{totalFields}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Fields Filled</p>
            <p className="text-2xl font-bold text-primary">{filledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Fields Missing</p>
            <p className="text-2xl font-bold text-orange-500">{totalFields - filledCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Field Quality */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Field-Level Data Review</CardTitle>
          <CardDescription className="text-xs">Each tracked field and its value in the selected record</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {qualityScores.map(q => (
            <div key={q.fieldId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                {q.hasValue ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span className="text-sm font-medium">{q.label}</span>
                <Badge variant="outline" className="text-[10px]">{q.isNumeric ? 'Numeric' : 'Category'}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {q.hasValue ? (
                  <span className="text-sm text-foreground font-mono">
                    {typeof q.value === 'number' ? q.value.toLocaleString() : String(q.value)}
                  </span>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">Missing</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
