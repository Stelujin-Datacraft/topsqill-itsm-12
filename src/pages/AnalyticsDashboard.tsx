
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useForm } from '@/contexts/FormContext';
import { useReports } from '@/hooks/useReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart3, TrendingUp, Activity, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Hash, Type, Calendar, ToggleLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const { forms } = useForm();
  const { getFormSubmissionData } = useReports();
  const { toast } = useToast();
  
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [submissionData, setSubmissionData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

  const selectedForm = forms.find(f => f.id === selectedFormId);

  // Fetch form fields directly from Supabase
  useEffect(() => {
    const fetchFormFields = async () => {
      if (!selectedFormId) {
        setFormFields([]);
        return;
      }

      try {
        const { data: fields, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type')
          .eq('form_id', selectedFormId)
          .order('field_order', { ascending: true });

        if (error) {
          console.error('Error fetching form fields:', error);
          setFormFields([]);
          return;
        }

        setFormFields(fields || []);
        // Reset selected fields when form changes
        setSelectedFieldIds([]);
      } catch (err) {
        console.error('Error in fetchFormFields:', err);
        setFormFields([]);
      }
    };

    fetchFormFields();
  }, [selectedFormId]);

  useEffect(() => {
    if (selectedFormId && formFields.length >= 0) {
      loadAnalytics();
    }
  }, [selectedFormId, formFields]);

  const loadAnalytics = async () => {
    if (!selectedFormId) return;
    
    try {
      setLoading(true);
      const submissions = await getFormSubmissionData(selectedFormId);
      setSubmissionData(submissions);
      
      // Calculate analytics using fetched formFields
      const totalSubmissions = submissions.length;
      const submissionsByDate = calculateSubmissionsByDate(submissions);
      const fieldAnalytics = calculateFieldAnalytics(submissions, formFields);
      const averageSubmissionsPerDay = calculateAverageSubmissions(submissions);
      const recentSubmissions = submissions.slice(0, 10);
      
      setAnalytics({
        totalSubmissions,
        submissionsByDate,
        fieldAnalytics,
        averageSubmissionsPerDay,
        recentSubmissions,
        fieldCount: formFields.length
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSubmissionsByDate = (submissions: any[]) => {
    const dateCount: Record<string, number> = {};
    submissions.forEach(submission => {
      const date = new Date(submission.submitted_at).toLocaleDateString();
      dateCount[date] = (dateCount[date] || 0) + 1;
    });
    
    return Object.entries(dateCount)
      .map(([date, count]) => ({ date, count }))
      .slice(-7); // Last 7 days
  };

  const calculateFieldAnalytics = (submissions: any[], fields: FormField[]) => {
    const fieldStats: Record<string, any> = {};
    
    if (submissions.length === 0) return fieldStats;
    
    fields.forEach(field => {
      // Try to get value by field.id or field.label (case insensitive)
      const responses = submissions
        .map(s => {
          const data = s.submission_data || {};
          if (data[field.id] !== undefined) return data[field.id];
          if (data[field.label] !== undefined) return data[field.label];
          const labelLower = field.label.toLowerCase();
          const matchingKey = Object.keys(data).find(k => k.toLowerCase() === labelLower);
          if (matchingKey) return data[matchingKey];
          return undefined;
        })
        .filter(value => value !== undefined && value !== null && value !== '');
      
      const responseRate = submissions.length > 0 ? (responses.length / submissions.length) * 100 : 0;
      const valueCounts: Record<string, number> = {};
      
      responses.forEach(value => {
        let stringValue: string;
        if (Array.isArray(value)) {
          stringValue = value.join(', ');
        } else if (typeof value === 'object') {
          stringValue = JSON.stringify(value);
        } else {
          stringValue = String(value);
        }
        valueCounts[stringValue] = (valueCounts[stringValue] || 0) + 1;
      });
      
      const uniqueValues = Object.keys(valueCounts).length;
      const emptyResponses = submissions.length - responses.length;
      const dataQuality = responseRate >= 80 ? 'excellent' : responseRate >= 50 ? 'good' : responseRate >= 20 ? 'fair' : 'poor';
      
      // Calculate aggregations based on field type
      let aggregations: Record<string, any> = {};
      const isNumericField = ['number', 'currency', 'slider', 'rating', 'star-rating'].includes(field.field_type);
      const isDateField = ['date', 'datetime', 'time'].includes(field.field_type);
      const isTextLikeField = ['text', 'textarea', 'email', 'url', 'phone'].includes(field.field_type);
      
      if (isNumericField && responses.length > 0) {
        const numericValues = responses.map(v => parseFloat(String(v))).filter(n => !isNaN(n));
        if (numericValues.length > 0) {
          const sum = numericValues.reduce((a, b) => a + b, 0);
          const avg = sum / numericValues.length;
          const sorted = [...numericValues].sort((a, b) => a - b);
          const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];
          
          aggregations = {
            type: 'numeric',
            sum: parseFloat(sum.toFixed(2)),
            average: parseFloat(avg.toFixed(2)),
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
            median: parseFloat(median.toFixed(2)),
            range: parseFloat((Math.max(...numericValues) - Math.min(...numericValues)).toFixed(2))
          };
        }
      } else if (isDateField && responses.length > 0) {
        const dateValues = responses.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
        if (dateValues.length > 0) {
          const timestamps = dateValues.map(d => d.getTime());
          const earliest = new Date(Math.min(...timestamps));
          const latest = new Date(Math.max(...timestamps));
          const daySpan = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
          
          aggregations = {
            type: 'date',
            earliest: earliest.toLocaleDateString(),
            latest: latest.toLocaleDateString(),
            daySpan
          };
        }
      } else if (isTextLikeField && responses.length > 0) {
        const lengths = responses.map(v => String(v).length);
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        
        aggregations = {
          type: 'text',
          avgLength: Math.round(avgLength),
          minLength: Math.min(...lengths),
          maxLength: Math.max(...lengths),
          totalCharacters: lengths.reduce((a, b) => a + b, 0)
        };
      } else {
        // For categorical fields (select, radio, checkbox, etc.)
        const sortedValues = Object.entries(valueCounts).sort(([,a], [,b]) => b - a);
        aggregations = {
          type: 'categorical',
          mostCommon: sortedValues[0]?.[0] || 'N/A',
          mostCommonCount: sortedValues[0]?.[1] || 0,
          leastCommon: sortedValues[sortedValues.length - 1]?.[0] || 'N/A',
          leastCommonCount: sortedValues[sortedValues.length - 1]?.[1] || 0
        };
      }
      
      fieldStats[field.id] = {
        label: field.label,
        type: field.field_type,
        responseRate: parseFloat(responseRate.toFixed(1)),
        totalResponses: responses.length,
        emptyResponses,
        uniqueValues,
        dataQuality,
        aggregations
      };
    });
    
    return fieldStats;
  };

  const calculateAverageSubmissions = (submissions: any[]) => {
    if (submissions.length === 0) return 0;
    
    const firstSubmission = new Date(submissions[submissions.length - 1].submitted_at);
    const lastSubmission = new Date(submissions[0].submitted_at);
    const daysDiff = Math.ceil((lastSubmission.getTime() - firstSubmission.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysDiff > 0 ? (submissions.length / daysDiff).toFixed(1) : submissions.length.toString();
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getQualityIcon = (quality: string) => {
    if (quality === 'excellent' || quality === 'good') {
      return <CheckCircle2 className={`h-4 w-4 ${getQualityColor(quality)}`} />;
    }
    return <AlertCircle className={`h-4 w-4 ${getQualityColor(quality)}`} />;
  };

  return (
    <DashboardLayout title="Analytics Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/reports')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>

        {/* Form Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Form to Analyze</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedFormId} onValueChange={setSelectedFormId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a form to analyze" />
              </SelectTrigger>
              <SelectContent>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedForm && !loading && analytics.totalSubmissions !== undefined && (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Total Submissions</p>
                      <p className="text-3xl font-bold">{analytics.totalSubmissions}</p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-50">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Average/Day</p>
                      <p className="text-3xl font-bold">{analytics.averageSubmissionsPerDay}</p>
                    </div>
                    <div className="p-3 rounded-full bg-green-50">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Form Fields</p>
                      <p className="text-3xl font-bold">{formFields.length}</p>
                    </div>
                    <div className="p-3 rounded-full bg-purple-50">
                      <BarChart3 className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
                      <p className="text-3xl font-bold">
                        {analytics.totalSubmissions > 0 ? '100%' : '0%'}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-orange-50">
                      <Activity className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Submissions Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Submission Trends (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.submissionsByDate}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Field Analytics */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Field-Level Analytics</CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Select Fields ({selectedFieldIds.length === 0 ? 'All' : selectedFieldIds.length})
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Choose Fields to Analyze</p>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedFieldIds([])}
                        >
                          Clear
                        </Button>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="space-y-2">
                          {formFields.map(field => (
                            <div 
                              key={field.id} 
                              className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                              onClick={() => {
                                setSelectedFieldIds(prev => 
                                  prev.includes(field.id)
                                    ? prev.filter(id => id !== field.id)
                                    : [...prev, field.id]
                                );
                              }}
                            >
                              <Checkbox 
                                checked={selectedFieldIds.includes(field.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedFieldIds(prev => 
                                    checked
                                      ? [...prev, field.id]
                                      : prev.filter(id => id !== field.id)
                                  );
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{field.label}</p>
                                <p className="text-xs text-muted-foreground">{field.field_type}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setSelectedFieldIds(formFields.map(f => f.id))}
                      >
                        Select All
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </CardHeader>
              <CardContent>
                {selectedFieldIds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select fields above to view their analytics.</p>
                  </div>
                ) : Object.keys(analytics.fieldAnalytics || {}).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No field analytics available. Make sure the form has submissions with field data.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(analytics.fieldAnalytics)
                      .filter(([fieldId]) => selectedFieldIds.includes(fieldId))
                      .map(([fieldId, stats]: [string, any]) => (
                      <div key={fieldId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{stats.label}</h4>
                          <Badge variant="outline">{stats.type}</Badge>
                        </div>
                        
                        {/* Response Rate Visual */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Response Rate</span>
                            <span className="text-sm font-medium">{stats.responseRate}%</span>
                          </div>
                          <Progress value={stats.responseRate} className="h-2" />
                        </div>

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Responses</p>
                            <p className="text-lg font-semibold">{stats.totalResponses}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Empty</p>
                            <p className="text-lg font-semibold">{stats.emptyResponses}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Unique Values</p>
                            <p className="text-lg font-semibold">{stats.uniqueValues}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center gap-1">
                              <p className="text-xs text-muted-foreground">Data Quality</p>
                              {getQualityIcon(stats.dataQuality)}
                            </div>
                            <p className={`text-lg font-semibold capitalize ${getQualityColor(stats.dataQuality)}`}>
                              {stats.dataQuality}
                            </p>
                          </div>
                        </div>

                        {/* Aggregation Calculations */}
                        {stats.aggregations && (
                          <div className="border-t pt-4">
                            <div className="flex items-center gap-2 mb-3">
                              {stats.aggregations.type === 'numeric' && <Hash className="h-4 w-4 text-blue-500" />}
                              {stats.aggregations.type === 'text' && <Type className="h-4 w-4 text-green-500" />}
                              {stats.aggregations.type === 'date' && <Calendar className="h-4 w-4 text-purple-500" />}
                              {stats.aggregations.type === 'categorical' && <ToggleLeft className="h-4 w-4 text-orange-500" />}
                              <p className="text-sm font-medium">Aggregations</p>
                            </div>
                            
                            {stats.aggregations.type === 'numeric' && (
                              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Sum</p>
                                  <p className="font-semibold text-blue-600">{stats.aggregations.sum}</p>
                                </div>
                                <div className="text-center p-2 bg-green-50 dark:bg-green-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Average</p>
                                  <p className="font-semibold text-green-600">{stats.aggregations.average}</p>
                                </div>
                                <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Median</p>
                                  <p className="font-semibold text-purple-600">{stats.aggregations.median}</p>
                                </div>
                                <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Min</p>
                                  <p className="font-semibold text-orange-600">{stats.aggregations.min}</p>
                                </div>
                                <div className="text-center p-2 bg-red-50 dark:bg-red-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Max</p>
                                  <p className="font-semibold text-red-600">{stats.aggregations.max}</p>
                                </div>
                                <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Range</p>
                                  <p className="font-semibold text-indigo-600">{stats.aggregations.range}</p>
                                </div>
                              </div>
                            )}
                            
                            {stats.aggregations.type === 'text' && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="text-center p-2 bg-green-50 dark:bg-green-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Avg Length</p>
                                  <p className="font-semibold text-green-600">{stats.aggregations.avgLength} chars</p>
                                </div>
                                <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Min Length</p>
                                  <p className="font-semibold text-blue-600">{stats.aggregations.minLength} chars</p>
                                </div>
                                <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Max Length</p>
                                  <p className="font-semibold text-purple-600">{stats.aggregations.maxLength} chars</p>
                                </div>
                                <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Total Chars</p>
                                  <p className="font-semibold text-orange-600">{stats.aggregations.totalCharacters}</p>
                                </div>
                              </div>
                            )}
                            
                            {stats.aggregations.type === 'date' && (
                              <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Earliest</p>
                                  <p className="font-semibold text-purple-600 text-sm">{stats.aggregations.earliest}</p>
                                </div>
                                <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Latest</p>
                                  <p className="font-semibold text-blue-600 text-sm">{stats.aggregations.latest}</p>
                                </div>
                                <div className="text-center p-2 bg-green-50 dark:bg-green-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Day Span</p>
                                  <p className="font-semibold text-green-600">{stats.aggregations.daySpan} days</p>
                                </div>
                              </div>
                            )}
                            
                            {stats.aggregations.type === 'categorical' && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Most Common</p>
                                  <p className="font-semibold text-green-600 text-sm truncate" title={stats.aggregations.mostCommon}>
                                    {stats.aggregations.mostCommon}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{stats.aggregations.mostCommonCount} responses</p>
                                </div>
                                <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                                  <p className="text-xs text-muted-foreground">Least Common</p>
                                  <p className="font-semibold text-orange-600 text-sm truncate" title={stats.aggregations.leastCommon}>
                                    {stats.aggregations.leastCommon}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{stats.aggregations.leastCommonCount} responses</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {loading && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading analytics...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedFormId && !loading && analytics.totalSubmissions === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
                <p className="text-muted-foreground">
                  This form hasn't received any submissions yet.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsDashboard;
