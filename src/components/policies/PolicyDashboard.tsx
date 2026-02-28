import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, Clock, AlertTriangle, Archive, Shield, CalendarClock, UserCheck, AlertOctagon } from 'lucide-react';
import type { Policy } from '@/types/policy';
import { POLICY_CATEGORIES, POLICY_PRIORITIES } from '@/types/policy';
import { format, isPast, addDays, isWithinInterval } from 'date-fns';

interface PolicyDashboardProps {
  policies: Policy[];
}

export function PolicyDashboard({ policies }: PolicyDashboardProps) {
  const draft = policies.filter(p => p.status === 'draft').length;
  const published = policies.filter(p => p.status === 'published').length;
  const pending = policies.filter(p => p.status === 'pending_approval').length;
  const retired = policies.filter(p => p.status === 'retired').length;

  const requireAck = policies.filter(p => p.acknowledgment_required).length;
  const dueForReview = policies.filter(p => 
    p.next_review_date && isPast(new Date(p.next_review_date))
  ).length;
  const upcomingReview = policies.filter(p => {
    if (!p.next_review_date) return false;
    const reviewDate = new Date(p.next_review_date);
    return !isPast(reviewDate) && isWithinInterval(reviewDate, {
      start: new Date(),
      end: addDays(new Date(), 30),
    });
  }).length;
  const expiringSoon = policies.filter(p => {
    if (!p.expiry_date) return false;
    const expiryDate = new Date(p.expiry_date);
    return !isPast(expiryDate) && isWithinInterval(expiryDate, {
      start: new Date(),
      end: addDays(new Date(), 30),
    });
  }).length;

  const byCategory = POLICY_CATEGORIES.map(cat => ({
    category: cat,
    count: policies.filter(p => p.category === cat).length,
  })).filter(c => c.count > 0);

  const byDepartment = Object.entries(
    policies.reduce((acc, p) => {
      const dept = p.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  const byPriority = POLICY_PRIORITIES.map(p => ({
    ...p,
    count: policies.filter(pol => (pol.priority || 'medium') === p.value).length,
  })).filter(p => p.count > 0);

  const complianceCoverage = Object.entries(
    policies.reduce((acc, p) => {
      if (p.compliance_standard) {
        acc[p.compliance_standard] = (acc[p.compliance_standard] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  const stats = [
    { label: 'Total', value: policies.length, icon: FileText, className: 'text-primary' },
    { label: 'Published', value: published, icon: CheckCircle, className: 'text-green-600' },
    { label: 'Pending', value: pending, icon: Clock, className: 'text-yellow-600' },
    { label: 'Draft', value: draft, icon: AlertTriangle, className: 'text-muted-foreground' },
    { label: 'Retired', value: retired, icon: Archive, className: 'text-destructive' },
  ];

  const actionItems = [
    { label: 'Overdue Reviews', value: dueForReview, icon: CalendarClock, className: 'text-destructive', show: dueForReview > 0 },
    { label: 'Reviews in 30 Days', value: upcomingReview, icon: CalendarClock, className: 'text-yellow-600', show: upcomingReview > 0 },
    { label: 'Expiring in 30 Days', value: expiringSoon, icon: AlertOctagon, className: 'text-orange-600', show: expiringSoon > 0 },
    { label: 'Require Acknowledgment', value: requireAck, icon: UserCheck, className: 'text-blue-600', show: requireAck > 0 },
  ].filter(a => a.show);

  return (
    <div className="space-y-6">
      {/* Status Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4 text-center">
              <stat.icon className={`h-6 w-6 mx-auto mb-2 ${stat.className}`} />
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {actionItems.map(item => (
                <div key={item.label} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <item.icon className={`h-4 w-4 shrink-0 ${item.className}`} />
                  <div>
                    <div className="text-lg font-bold">{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-3">
                {byCategory.map(({ category, count }) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm">{category}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(count / policies.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Department */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By Department</CardTitle>
          </CardHeader>
          <CardContent>
            {byDepartment.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-3">
                {byDepartment.map(([dept, count]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <span className="text-sm">{dept}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(count / policies.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Priority */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By Priority</CardTitle>
          </CardHeader>
          <CardContent>
            {byPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-3">
                {byPriority.map(p => (
                  <div key={p.value} className="flex items-center justify-between">
                    <Badge className={p.color}>{p.label}</Badge>
                    <span className="text-sm font-medium">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance Coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Compliance Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {complianceCoverage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No compliance standards mapped</p>
            ) : (
              <div className="space-y-3">
                {complianceCoverage.map(([standard, count]) => (
                  <div key={standard} className="flex items-center justify-between">
                    <span className="text-sm">{standard}</span>
                    <Badge variant="outline">{count} {count === 1 ? 'policy' : 'policies'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
