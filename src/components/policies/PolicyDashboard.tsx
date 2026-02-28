import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle, Clock, AlertTriangle, Archive } from 'lucide-react';
import type { Policy } from '@/types/policy';
import { POLICY_CATEGORIES } from '@/types/policy';

interface PolicyDashboardProps {
  policies: Policy[];
}

export function PolicyDashboard({ policies }: PolicyDashboardProps) {
  const draft = policies.filter(p => p.status === 'draft').length;
  const published = policies.filter(p => p.status === 'published').length;
  const pending = policies.filter(p => p.status === 'pending_approval').length;
  const retired = policies.filter(p => p.status === 'retired').length;

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

  const stats = [
    { label: 'Total Policies', value: policies.length, icon: FileText, className: 'text-primary' },
    { label: 'Published', value: published, icon: CheckCircle, className: 'text-green-600' },
    { label: 'Pending Approval', value: pending, icon: Clock, className: 'text-yellow-600' },
    { label: 'Draft', value: draft, icon: AlertTriangle, className: 'text-muted-foreground' },
    { label: 'Retired', value: retired, icon: Archive, className: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats cards */}
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
      </div>
    </div>
  );
}
