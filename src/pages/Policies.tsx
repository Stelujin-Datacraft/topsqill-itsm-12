import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, BarChart3, CalendarClock, AlertTriangle, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePolicies } from '@/hooks/usePolicies';
import { useProject } from '@/contexts/ProjectContext';
import { POLICY_CATEGORIES, POLICY_STATUSES, POLICY_PRIORITIES } from '@/types/policy';
import { CreatePolicyDialog } from '@/components/policies/CreatePolicyDialog';
import { CreateTemplateDialog } from '@/components/policies/CreateTemplateDialog';
import { PolicyDashboard } from '@/components/policies/PolicyDashboard';
import { format, isPast } from 'date-fns';

const Policies = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { policies, isLoading } = usePolicies();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  const filtered = useMemo(() => {
    return policies.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()) ||
        p.policy_number?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchPriority = priorityFilter === 'all' || (p.priority || 'medium') === priorityFilter;
      return matchSearch && matchStatus && matchCategory && matchPriority;
    });
  }, [policies, search, statusFilter, categoryFilter, priorityFilter]);

  const getStatusBadge = (status: string) => {
    const s = POLICY_STATUSES.find(st => st.value === status);
    return <Badge className={s?.color || ''}>{s?.label || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const p = POLICY_PRIORITIES.find(pr => pr.value === priority);
    return <Badge className={p?.color || ''} variant="outline">{p?.label || priority}</Badge>;
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium">No Project Selected</h3>
          <p className="text-sm text-muted-foreground">Select a project to manage policies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Policies</h1>
          <p className="text-sm text-muted-foreground">Manage organizational policies, compliance, and governance</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Policy
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <FileText className="h-4 w-4" />
            All Policies
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, description, or policy number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {POLICY_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {POLICY_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {POLICY_PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Policy List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4 h-20" />
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium">No policies found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {policies.length === 0 ? 'Create your first policy to get started.' : 'Try adjusting your filters.'}
                </p>
                {policies.length === 0 && (
                  <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Create Policy
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(policy => {
                const isOverdueReview = policy.next_review_date && isPast(new Date(policy.next_review_date));
                return (
                  <Card
                    key={policy.id}
                    className={`cursor-pointer hover:border-primary/50 transition-colors ${isOverdueReview ? 'border-destructive/30' : ''}`}
                    onClick={() => navigate(`/policy/${policy.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {policy.policy_number && (
                              <span className="text-xs font-mono text-muted-foreground">{policy.policy_number}</span>
                            )}
                            <h3 className="font-medium text-foreground truncate">{policy.name}</h3>
                            {getStatusBadge(policy.status)}
                            <Badge variant="outline">{policy.category}</Badge>
                            {getPriorityBadge(policy.priority || 'medium')}
                            {policy.department && (
                              <Badge variant="secondary">{policy.department}</Badge>
                            )}
                            {isOverdueReview && (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <CalendarClock className="h-3 w-3" />
                                Review Overdue
                              </Badge>
                            )}
                            {policy.acknowledgment_required && (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-300">
                                ACK Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {policy.description || 'No description'}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground ml-4 shrink-0 space-y-0.5">
                          <div>v{policy.current_version}</div>
                          <div>{format(new Date(policy.updated_at), 'MMM d, yyyy')}</div>
                          {policy.compliance_standard && (
                            <div className="text-primary">{policy.compliance_standard}</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dashboard">
          <PolicyDashboard policies={policies} />
        </TabsContent>
      </Tabs>

      <CreatePolicyDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

export default Policies;
