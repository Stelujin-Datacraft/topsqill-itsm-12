import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Database, Link2, ArrowRight, Settings2, FileText } from 'lucide-react';

interface FormOption {
  id: string;
  name: string;
  reference_id: string;
}

interface FormField {
  id: string;
  label: string;
  type: string;
  config?: any;
}

interface FieldMapping {
  formFieldId: string;
  formFieldLabel: string;
  formFieldType: string;
  metricRole: string; // 'numeric_metric' | 'date_field' | 'category' | 'status'
  aggregation: string; // 'sum' | 'avg' | 'count' | 'min' | 'max' | 'latest'
  label: string; // custom display label
}

interface LinkedForm {
  formId: string;
  formName: string;
  crossRefFieldId: string;
  crossRefFieldLabel: string;
  fieldMappings: FieldMapping[];
}

interface DataSource {
  id: string;
  project_id: string;
  source_form_id: string;
  source_form_name: string;
  field_mappings: FieldMapping[];
  linked_forms: LinkedForm[];
  data_limit: number;
  date_field_id: string | null;
  is_active: boolean;
  created_at: string;
}

const METRIC_ROLES = [
  { value: 'numeric_metric', label: 'Numeric Metric' },
  { value: 'date_field', label: 'Date/Time Field' },
  { value: 'category', label: 'Category/Status' },
  { value: 'status', label: 'Health/Progress Status' },
];

const AGGREGATIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'latest', label: 'Latest Value' },
];

interface DataSourceConfigProps {
  perfProjectId?: string;
  perfFormId?: string;
}

export function DataSourceConfig({ perfProjectId, perfFormId }: DataSourceConfigProps) {
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const projectId = currentProject?.id;

  const [open, setOpen] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [crossRefFields, setCrossRefFields] = useState<FormField[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [linkedForms, setLinkedForms] = useState<LinkedForm[]>([]);
  const [dataLimit, setDataLimit] = useState(500);
  const [dateFieldId, setDateFieldId] = useState('');
  const [loadingFields, setLoadingFields] = useState(false);

  // Fetch forms for the project
  const { data: forms = [] } = useQuery({
    queryKey: ['project-forms', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('forms')
        .select('id, name, reference_id')
        .eq('project_id', projectId)
        .order('name');
      if (error) throw error;
      return data as FormOption[];
    },
    enabled: !!projectId,
  });

  // Fetch existing data sources
  const { data: dataSources = [], isLoading } = useQuery({
    queryKey: ['performance-data-sources', projectId, perfProjectId],
    queryFn: async () => {
      if (!projectId) return [];
      let query = supabase
        .from('performance_data_sources')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (perfProjectId) {
        query = query.eq('performance_project_id', perfProjectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        field_mappings: Array.isArray(d.field_mappings) ? d.field_mappings : [],
        linked_forms: Array.isArray(d.linked_forms) ? d.linked_forms : [],
      })) as DataSource[];
    },
    enabled: !!projectId,
  });

  // Load form fields when form is selected
  useEffect(() => {
    if (!selectedFormId) {
      setFormFields([]);
      setCrossRefFields([]);
      return;
    }
    setLoadingFields(true);
    supabase
      .from('form_fields')
      .select('id, label, field_type, custom_config')
      .eq('form_id', selectedFormId)
      .order('field_order')
      .then(({ data, error }) => {
        setLoadingFields(false);
        if (error || !data) return;
        const fields = data.map((f: any) => ({
          id: f.id,
          label: f.label,
          type: f.field_type,
          config: f.custom_config,
        }));
        setFormFields(fields);
        setCrossRefFields(fields.filter(f =>
          f.type === 'cross-reference' || f.type === 'child-cross-reference'
        ));
      });
  }, [selectedFormId]);

  const addFieldMapping = (field: FormField) => {
    if (fieldMappings.find(m => m.formFieldId === field.id)) return;
    const isNumeric = ['number', 'slider', 'currency'].includes(field.type);
    const isDate = ['date', 'datetime', 'time'].includes(field.type);
    setFieldMappings(prev => [...prev, {
      formFieldId: field.id,
      formFieldLabel: field.label,
      formFieldType: field.type,
      metricRole: isDate ? 'date_field' : isNumeric ? 'numeric_metric' : 'category',
      aggregation: isNumeric ? 'sum' : 'count',
      label: field.label,
    }]);
  };

  const removeFieldMapping = (fieldId: string) => {
    setFieldMappings(prev => prev.filter(m => m.formFieldId !== fieldId));
  };

  const updateMapping = (fieldId: string, key: string, value: string) => {
    setFieldMappings(prev => prev.map(m =>
      m.formFieldId === fieldId ? { ...m, [key]: value } : m
    ));
  };

  // Load linked form fields for cross-reference
  const addLinkedForm = async (crossRefField: FormField) => {
    const targetFormId = crossRefField.config?.targetFormId;
    if (!targetFormId) return;

    const { data: targetForm } = await supabase
      .from('forms')
      .select('id, name')
      .eq('id', targetFormId)
      .single();

    if (!targetForm) return;

    if (linkedForms.find(lf => lf.crossRefFieldId === crossRefField.id)) return;

    setLinkedForms(prev => [...prev, {
      formId: targetForm.id,
      formName: targetForm.name,
      crossRefFieldId: crossRefField.id,
      crossRefFieldLabel: crossRefField.label,
      fieldMappings: [],
    }]);
  };

  const removeLinkedForm = (crossRefFieldId: string) => {
    setLinkedForms(prev => prev.filter(lf => lf.crossRefFieldId !== crossRefFieldId));
  };

  // Create data source
  const createDataSource = useMutation({
    mutationFn: async () => {
      if (!projectId || !userProfile || !selectedFormId) throw new Error('Missing data');
      const selectedForm = forms.find(f => f.id === selectedFormId);
      const { data, error } = await supabase
        .from('performance_data_sources')
        .insert({
          project_id: projectId,
          organization_id: userProfile.organization_id,
          created_by: userProfile.id,
          source_form_id: selectedFormId,
          source_form_name: selectedForm?.name || '',
          field_mappings: fieldMappings as any,
          linked_forms: linkedForms as any,
          data_limit: dataLimit,
          date_field_id: dateFieldId || null,
          is_active: true,
          ...(perfProjectId ? { performance_project_id: perfProjectId } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-data-sources', projectId, perfProjectId] });
      toast({ title: 'Data Source Created', description: 'Form data source configured for analysis.' });
      setOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteDataSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('performance_data_sources')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-data-sources', projectId] });
      toast({ title: 'Data Source Removed' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('performance_data_sources')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-data-sources', projectId] });
    },
  });

  const resetForm = () => {
    setSelectedFormId('');
    setFormFields([]);
    setCrossRefFields([]);
    setFieldMappings([]);
    setLinkedForms([]);
    setDataLimit(500);
    setDateFieldId('');
  };

  const numericFields = formFields.filter(f =>
    ['number', 'slider', 'currency'].includes(f.type)
  );
  const dateFields = formFields.filter(f =>
    ['date', 'datetime'].includes(f.type)
  );
  const unmappedFields = formFields.filter(f =>
    !fieldMappings.find(m => m.formFieldId === f.id) &&
    !['cross-reference', 'child-cross-reference', 'section', 'divider', 'heading', 'spacer'].includes(f.type)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Data Sources</h2>
          <p className="text-sm text-muted-foreground">
            Connect forms to analyze their submission data with AI-powered insights
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Data Source</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure Form Data Source</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Step 1: Select Form */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">1. Select Source Form</Label>
                <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a form..." />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} <span className="text-muted-foreground ml-1">({f.reference_id})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingFields && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}

              {selectedFormId && formFields.length > 0 && (
                <>
                  {/* Step 2: Data Limit & Date Field */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">2. Record Limit</Label>
                      <Input
                        type="number"
                        min={10}
                        max={1000}
                        value={dataLimit}
                        onChange={e => setDataLimit(Math.min(1000, Math.max(10, parseInt(e.target.value) || 100)))}
                      />
                      <p className="text-xs text-muted-foreground">Max records to include in analysis (10-1000)</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Date/Time Field</Label>
                      <Select value={dateFieldId} onValueChange={setDateFieldId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select date field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="created_at">Created At (system)</SelectItem>
                          <SelectItem value="updated_at">Updated At (system)</SelectItem>
                          {dateFields.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Used for trend analysis ordering</p>
                    </div>
                  </div>

                  {/* Step 3: Map Fields */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">3. Map Fields for Analysis</Label>
                    <p className="text-xs text-muted-foreground">
                      Select which form fields should be analyzed. Numeric fields become metrics, text fields become categories.
                    </p>

                    {/* Available fields */}
                    {unmappedFields.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {unmappedFields.map(f => (
                          <Button
                            key={f.id}
                            variant="outline"
                            size="sm"
                            onClick={() => addFieldMapping(f)}
                            className="text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {f.label}
                            <Badge variant="secondary" className="ml-1 text-[10px]">{f.type}</Badge>
                          </Button>
                          ))}
                      </div>
                    )}

                    {/* Mapped fields */}
                    {fieldMappings.length > 0 && (
                      <div className="space-y-2">
                        {fieldMappings.map(mapping => (
                          <Card key={mapping.formFieldId} className="bg-muted/30">
                            <CardContent className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                                  <div>
                                    <p className="text-xs font-medium text-foreground">{mapping.formFieldLabel}</p>
                                    <Badge variant="secondary" className="text-[10px]">{mapping.formFieldType}</Badge>
                                  </div>
                                  <Select
                                    value={mapping.metricRole}
                                    onValueChange={v => updateMapping(mapping.formFieldId, 'metricRole', v)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {METRIC_ROLES.map(r => (
                                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={mapping.aggregation}
                                    onValueChange={v => updateMapping(mapping.formFieldId, 'aggregation', v)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {AGGREGATIONS.map(a => (
                                        <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    className="h-8 text-xs"
                                    value={mapping.label}
                                    onChange={e => updateMapping(mapping.formFieldId, 'label', e.target.value)}
                                    placeholder="Display label"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => removeFieldMapping(mapping.formFieldId)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Step 4: Cross-Reference Linked Forms */}
                  {crossRefFields.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">4. Include Linked Forms (Cross-References)</Label>
                      <p className="text-xs text-muted-foreground">
                        Pull data from forms linked via cross-reference fields for deeper analysis.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {crossRefFields
                          .filter(f => !linkedForms.find(lf => lf.crossRefFieldId === f.id))
                          .map(f => (
                            <Button
                              key={f.id}
                              variant="outline"
                              size="sm"
                              onClick={() => addLinkedForm(f)}
                              className="text-xs"
                            >
                              <Link2 className="h-3 w-3 mr-1" />
                              {f.label}
                            </Button>
                          ))}
                      </div>

                      {linkedForms.map(lf => (
                        <Card key={lf.crossRefFieldId} className="border-primary/20">
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Link2 className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-foreground">{lf.crossRefFieldLabel}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge variant="secondary">{lf.formName}</Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeLinkedForm(lf.crossRefFieldId)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Data from "{lf.formName}" will be included via the "{lf.crossRefFieldLabel}" relationship.
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    onClick={() => createDataSource.mutate()}
                    disabled={fieldMappings.length === 0 || createDataSource.isPending}
                    className="w-full"
                  >
                    {createDataSource.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="mr-2 h-4 w-4" />
                    )}
                    Save Data Source ({fieldMappings.length} fields mapped)
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Data Sources */}
      <div className="space-y-3">
        {dataSources.map(ds => (
          <Card key={ds.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{ds.source_form_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {(ds.field_mappings || []).length} fields mapped
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Limit: {ds.data_limit} records
                      </Badge>
                      {(ds.linked_forms || []).length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Link2 className="h-3 w-3 mr-1" />
                          {(ds.linked_forms || []).length} linked form(s)
                        </Badge>
                      )}
                      <Badge variant={ds.is_active ? 'default' : 'secondary'} className="text-xs">
                        {ds.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ds.is_active}
                    onCheckedChange={v => toggleActive.mutate({ id: ds.id, is_active: v })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteDataSource.mutate(ds.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {dataSources.length === 0 && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Database className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No data sources configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect a form to start analyzing its submission data with AI-powered insights.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
