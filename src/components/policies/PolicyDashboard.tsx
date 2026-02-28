import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { FileText, CheckCircle, Clock, AlertTriangle, Archive, Shield, CalendarClock, UserCheck, AlertOctagon, ChevronDown } from 'lucide-react';
import type { Policy } from '@/types/policy';
import { POLICY_CATEGORIES, POLICY_PRIORITIES } from '@/types/policy';
import { isPast, addDays, isWithinInterval } from 'date-fns';

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

  const byPriority = POLICY_PRIORITIES.map(p => ({
    ...p,
    count: policies.filter(pol => (pol.priority || 'medium') === p.value).length,
  })).filter(p => p.count > 0);

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
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Overview Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Status ({policies.length})
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Policy Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {stats.map(stat => (
            <DropdownMenuItem key={stat.label} className="gap-2 cursor-default">
              <stat.icon className={`h-4 w-4 ${stat.className}`} />
              <span className="flex-1">{stat.label}</span>
              <span className="font-bold">{stat.value}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Attention Dropdown */}
      {actionItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 border-yellow-300 text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              Attention ({actionItems.length})
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Attention Required</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {actionItems.map(item => (
              <DropdownMenuItem key={item.label} className="gap-2 cursor-default">
                <item.icon className={`h-4 w-4 ${item.className}`} />
                <span className="flex-1 text-xs">{item.label}</span>
                <span className="font-bold">{item.value}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Category Dropdown */}
      {byCategory.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Categories
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>By Category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {byCategory.map(({ category, count }) => (
              <DropdownMenuItem key={category} className="gap-2 cursor-default">
                <span className="flex-1 text-sm">{category}</span>
                <Badge variant="secondary" className="text-xs">{count}</Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Priority Dropdown */}
      {byPriority.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              Priority
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>By Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {byPriority.map(p => (
              <DropdownMenuItem key={p.value} className="gap-2 cursor-default">
                <Badge className={p.color}>{p.label}</Badge>
                <span className="ml-auto font-bold">{p.count}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
