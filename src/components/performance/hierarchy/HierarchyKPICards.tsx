import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Clock, Target, ShieldAlert, BarChart3, Users, CheckCircle2, Activity } from 'lucide-react';
import { HierarchyKPIs } from '@/hooks/useHierarchyData';

interface Props {
  kpis: HierarchyKPIs;
  levelKey: string;
}

function formatCurrency(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatPct(val: number) {
  return `${val.toFixed(1)}%`;
}

interface KPICardData {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  status: 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
}

function getKPICards(kpis: HierarchyKPIs, levelKey: string): KPICardData[] {
  const cards: KPICardData[] = [];

  // Common cards for all levels
  cards.push({
    label: 'Total Records',
    value: kpis.totalRecords.toString(),
    icon: <BarChart3 className="h-4 w-4" />,
    status: 'info',
    subtitle: `${kpis.completedRecords} completed, ${kpis.inProgressRecords} in progress`,
  });

  cards.push({
    label: 'Completion Rate',
    value: formatPct(kpis.completionRate),
    icon: <CheckCircle2 className="h-4 w-4" />,
    status: kpis.completionRate >= 75 ? 'success' : kpis.completionRate >= 50 ? 'warning' : 'danger',
    trend: kpis.completionRate >= 75 ? 'up' : 'down',
  });

  // Budget cards (for levels that have budget data)
  if (['projects', 'wbs'].includes(levelKey) && kpis.plannedBudget > 0) {
    const budgetUtil = kpis.plannedBudget > 0 ? (kpis.actualCost / kpis.plannedBudget) * 100 : 0;
    cards.push({
      label: 'Budget Utilization',
      value: formatPct(budgetUtil),
      icon: <DollarSign className="h-4 w-4" />,
      status: budgetUtil <= 100 ? 'success' : 'danger',
      trend: budgetUtil <= 100 ? 'up' : 'down',
      subtitle: `${formatCurrency(kpis.actualCost)} / ${formatCurrency(kpis.plannedBudget)}`,
    });
  }

  // CPI & SPI (for levels with EV data)
  if (kpis.earnedValue > 0) {
    cards.push({
      label: 'CPI',
      value: kpis.cpi.toFixed(2),
      icon: <TrendingUp className="h-4 w-4" />,
      status: kpis.cpi >= 1 ? 'success' : kpis.cpi >= 0.9 ? 'warning' : 'danger',
      trend: kpis.cpi >= 1 ? 'up' : 'down',
      subtitle: 'Cost Performance Index',
    });

    cards.push({
      label: 'SPI',
      value: kpis.spi.toFixed(2),
      icon: <Activity className="h-4 w-4" />,
      status: kpis.spi >= 1 ? 'success' : kpis.spi >= 0.9 ? 'warning' : 'danger',
      trend: kpis.spi >= 1 ? 'up' : 'down',
      subtitle: 'Schedule Performance Index',
    });
  }

  // Resource utilization (for levels with hours data)
  if (kpis.plannedHours > 0) {
    cards.push({
      label: 'Resource Utilization',
      value: formatPct(kpis.resourceUtilization),
      icon: <Users className="h-4 w-4" />,
      status: kpis.resourceUtilization <= 100 ? 'success' : 'warning',
      subtitle: `${kpis.actualHours.toFixed(0)}h / ${kpis.plannedHours.toFixed(0)}h`,
    });
  }

  // Risk score
  if (kpis.avgRiskScore > 0) {
    cards.push({
      label: 'Avg Risk Score',
      value: kpis.avgRiskScore.toFixed(1),
      icon: <ShieldAlert className="h-4 w-4" />,
      status: kpis.avgRiskScore <= 30 ? 'success' : kpis.avgRiskScore <= 70 ? 'warning' : 'danger',
      trend: kpis.avgRiskScore <= 30 ? 'up' : 'down',
    });
  }

  // Delay days
  if (kpis.avgDelayDays !== 0) {
    cards.push({
      label: 'Avg Delay',
      value: `${kpis.avgDelayDays.toFixed(1)} days`,
      icon: <Clock className="h-4 w-4" />,
      status: kpis.avgDelayDays <= 0 ? 'success' : kpis.avgDelayDays <= 5 ? 'warning' : 'danger',
      trend: kpis.avgDelayDays <= 0 ? 'up' : 'down',
    });
  }

  return cards;
}

const statusStyles: Record<string, string> = {
  success: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-card',
  warning: 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-card',
  danger: 'border-red-500/30 bg-gradient-to-br from-red-500/5 via-card to-card',
  info: 'border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card',
};

const accentStyles: Record<string, string> = {
  success: 'from-emerald-500 to-emerald-600',
  warning: 'from-amber-500 to-amber-600',
  danger: 'from-red-500 to-red-600',
  info: 'from-primary to-primary',
};

const iconBgStyles: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600',
  warning: 'bg-amber-500/10 text-amber-600',
  danger: 'bg-red-500/10 text-red-600',
  info: 'bg-primary/10 text-primary',
};

export function HierarchyKPICards({ kpis, levelKey }: Props) {
  const cards = getKPICards(kpis, levelKey);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className={`relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${statusStyles[card.status]}`}>
          <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accentStyles[card.status]}`} />
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className={`p-1.5 rounded-lg ${iconBgStyles[card.status]}`}>
                {card.icon}
              </div>
              {card.trend && (
                <span className={`text-xs font-medium ${card.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {card.trend === 'up' ? '▲' : '▼'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{card.label}</p>
            <p className="text-xl font-bold leading-none text-foreground">{card.value}</p>
            {card.subtitle && (
              <p className="text-[10px] text-muted-foreground mt-1 truncate">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
