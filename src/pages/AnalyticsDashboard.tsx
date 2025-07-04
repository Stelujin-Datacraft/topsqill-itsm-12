
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useForm } from '@/contexts/FormContext';
import { useReports } from '@/hooks/useReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart3, TrendingUp, Users, Activity, PieChart, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const { forms } = useForm();
  const { getFormSubmissionData } = useReports();
  const { toast } = useToast();
  
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [submissionData, setSubmissionData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const selectedForm = forms.find(f => f.id === selectedFormId);

  useEffect(() => {
    if (selectedFormId) {
      loadAnalytics();
    }
  }, [selectedFormId]);

  const loadAnalytics = async () => {
    if (!selectedFormId) return;
    
    try {
      setLoading(true);
      const submissions = await getFormSubmissionData(selectedFormId);
      setSubmissionData(submissions);
      
      // Calculate analytics
      const totalSubmissions = submissions.length;
      const submissionsByDate = calculateSubmissionsByDate(submissions);
      const fieldAnalytics = calculateFieldAnalytics(submissions, selectedForm?.fields || []);
      const averageSubmissionsPerDay = calculateAverageSubmissions(submissions);
      const recentSubmissions = submissions.slice(0, 10);
      
      setAnalytics({
        totalSubmissions,
        submissionsByDate,
        fieldAnalytics,
        averageSubmissionsPerDay,
        recentSubmissions
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

  const calculateFieldAnalytics = (submissions: any[], fields: any[]) => {
    const fieldStats: Record<string, any> = {};
    
    fields.forEach(field => {
      const responses = submissions
        .map(s => s.submission_data[field.id])
        .filter(value => value !== undefined && value !== null && value !== '');
      
      const responseRate = (responses.length / submissions.length) * 100;
      const uniqueValues = [...new Set(responses)];
      const valueCounts: Record<string, number> = {};
      
      responses.forEach(value => {
        const stringValue = String(value);
        valueCounts[stringValue] = (valueCounts[stringValue] || 0) + 1;
      });
      
      fieldStats[field.id] = {
        label: field.label,
        type: field.type,
        responseRate: responseRate.toFixed(1),
        totalResponses: responses.length,
        uniqueValues: uniqueValues.length,
        mostCommon: Object.entries(valueCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([value, count]) => ({ value, count, percentage: ((count / responses.length) * 100).toFixed(1) }))
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
                      <p className="text-3xl font-bold">{selectedForm.fields.length}</p>
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
              <CardHeader>
                <CardTitle>Field-Level Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(analytics.fieldAnalytics).map(([fieldId, stats]: [string, any]) => (
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
                          <p className="font-semibold text-sm">
                            {stats.mostCommon[0]?.value || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {stats.mostCommon.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Top Responses:</p>
                          <div className="space-y-1">
                            {stats.mostCommon.map((item: any, index: number) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span className="truncate max-w-xs">{item.value}</span>
                                <div className="flex items-center gap-2">
                                  <span>{item.count} ({item.percentage}%)</span>
                                  <div 
                                    className="h-2 bg-blue-500 rounded"
                                    style={{ width: `${Math.min(item.percentage, 100)}px` }}
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
