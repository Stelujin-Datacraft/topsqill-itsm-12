import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, TrendingUp, Users } from 'lucide-react';

interface SubmissionAnalyticsProps {
  data: any[];
}

export function SubmissionAnalytics({ data }: SubmissionAnalyticsProps) {
  const analytics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalSubmissions: 0,
        todaySubmissions: 0,
        thisWeekSubmissions: 0,
        averageSubmissionsPerDay: 0,
        uniqueSubmitters: 0
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todaySubmissions = data.filter(row => {
      const submittedAt = new Date(row.submitted_at);
      return submittedAt >= today;
    }).length;

    const thisWeekSubmissions = data.filter(row => {
      const submittedAt = new Date(row.submitted_at);
      return submittedAt >= weekAgo;
    }).length;

    const uniqueSubmitters = new Set(
      data.map(row => row.submitted_by).filter(Boolean)
    ).size;

    const oldestSubmission = data.reduce((oldest, row) => {
      const submittedAt = new Date(row.submitted_at);
      return !oldest || submittedAt < oldest ? submittedAt : oldest;
    }, null);

    const daysSinceFirst = oldestSubmission 
      ? Math.max(1, Math.ceil((now.getTime() - oldestSubmission.getTime()) / (24 * 60 * 60 * 1000)))
      : 1;

    const averageSubmissionsPerDay = Math.round((data.length / daysSinceFirst) * 10) / 10;

    return {
      totalSubmissions: data.length,
      todaySubmissions,
      thisWeekSubmissions,
      averageSubmissionsPerDay,
      uniqueSubmitters
    };
  }, [data]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{analytics.totalSubmissions}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-success" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today</p>
              <p className="text-2xl font-bold text-success">{analytics.todaySubmissions}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-warning" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold text-warning">{analytics.thisWeekSubmissions}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-info" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg/Day</p>
              <p className="text-2xl font-bold text-info">{analytics.averageSubmissionsPerDay}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-accent-foreground" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Submitters</p>
              <p className="text-2xl font-bold text-accent-foreground">{analytics.uniqueSubmitters}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}