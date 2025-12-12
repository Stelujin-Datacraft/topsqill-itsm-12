
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useForm } from '@/contexts/FormContext';
import { useReports } from '@/hooks/useReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart3, TrendingUp, Activity, FileText, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend } from 'recharts';
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
          // Try exact id match
          if (data[field.id] !== undefined) return data[field.id];
          // Try label match
          if (data[field.label] !== undefined) return data[field.label];
          // Try case-insensitive label match
          const labelLower = field.label.toLowerCase();
          const matchingKey = Object.keys(data).find(k => k.toLowerCase() === labelLower);
          if (matchingKey) return data[matchingKey];
          return undefined;
        })
        .filter(value => value !== undefined && value !== null && value !== '');
      
      const responseRate = submissions.length > 0 ? (responses.length / submissions.length) * 100 : 0;
      const valueCounts: Record<string, number> = {};
      
      responses.forEach(value => {
        // Handle arrays and objects
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
      
      // Create pie chart data for this field
      const pieChartData = Object.entries(valueCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([value, count]) => ({
          name: value.length > 20 ? value.substring(0, 20) + '...' : value,
          fullName: value,
          value: count,
          percentage: ((count / responses.length) * 100).toFixed(1)
        }));
      
      fieldStats[field.id] = {
        label: field.label,
        type: field.field_type,
        responseRate: responseRate.toFixed(1),
        totalResponses: responses.length,
        uniqueValues,
        pieChartData,
        mostCommon: Object.entries(valueCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([value, count]) => ({ 
            value: value.length > 50 ? value.substring(0, 50) + '...' : value, 
            count, 
            percentage: ((count / responses.length) * 100).toFixed(1) 
          }))
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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

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
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Response Rate</p>
                            <p className="font-semibold">{stats.responseRate}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Responses</p>
                            <p className="font-semibold">{stats.totalResponses}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Unique Values</p>
                            <p className="font-semibold">{stats.uniqueValues}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Most Common</p>
                            <p className="font-semibold text-sm truncate">
                              {stats.mostCommon[0]?.value || 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Pie Chart for Field Distribution */}
                        {stats.pieChartData && stats.pieChartData.length > 0 && stats.uniqueValues <= 10 && (
                          <div className="mb-4">
                            <p className="text-sm text-muted-foreground mb-2">Value Distribution:</p>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                  <Pie
                                    data={stats.pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={60}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                                  >
                                    {stats.pieChartData.map((entry: any, index: number) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip 
                                    formatter={(value: any, name: any, props: any) => [
                                      `${value} (${props.payload.percentage}%)`,
                                      props.payload.fullName
                                    ]}
                                  />
                                  <Legend />
                                </RechartsPieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Top Responses List */}
                        {stats.mostCommon.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Top Responses:</p>
                            <div className="space-y-2">
                              {stats.mostCommon.map((item: any, index: number) => (
                                <div key={index} className="flex items-center justify-between text-sm gap-4">
                                  <span className="truncate flex-1" title={item.value}>{item.value}</span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-muted-foreground">{item.count} ({item.percentage}%)</span>
                                    <div 
                                      className="h-2 rounded"
                                      style={{ 
                                        width: `${Math.min(parseFloat(item.percentage), 100)}px`,
                                        backgroundColor: COLORS[index % COLORS.length]
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
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
