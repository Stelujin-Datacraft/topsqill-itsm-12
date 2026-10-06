import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import PageContent from '@/components/PageContent';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { promotionApi } from '@/lib/promotion/api';
import { ArrowRight, CheckCircle2, History, Loader2, Package, Plus, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Failed: 'bg-red-100 text-red-800 border-red-200',
    PartiallyCompleted: 'bg-amber-100 text-amber-800 border-amber-200',
    Promoting: 'bg-blue-100 text-blue-800 border-blue-200',
    Ready: 'bg-sky-100 text-sky-800 border-sky-200',
    Draft: 'bg-slate-100 text-slate-700 border-slate-200',
    Validating: 'bg-violet-100 text-violet-800 border-violet-200',
  };
  return (
    <Badge variant="outline" className={map[status] || ''}>
      {status}
    </Badge>
  );
}

export default function PromotionalTransferDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await promotionApi.dashboard();
      setData(d);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load promotional transfer dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'admin') load();
  }, [userProfile?.role, load]);

  if (userProfile && userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const envs = data?.environments || [];
  const source = envs.find((e: any) => e.role === 'source');
  const target = envs.find((e: any) => e.role === 'target');

  return (
    <PageContent
      title="Promotional Transfer"
      description="Selectively promote supported configuration from Dev to Prod"
      actions={
        <Button onClick={() => navigate('/promotional-transfer/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Promotion
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-8">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Successful</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  {data?.counts?.completed ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Failed / Partial</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <XCircle className="h-6 w-6 text-red-600" />
                  {data?.counts?.failed ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>In progress</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                  {data?.counts?.inProgress ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Promotable object types</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Package className="h-6 w-6 text-slate-700" />
                  {data?.promotableObjectTypes ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {data?.schema && !data.schema.ok && (
            <Card className="border-amber-300 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-900">Database setup required</CardTitle>
                <CardDescription className="text-amber-800">{data.schema.message}</CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configured environments</CardTitle>
              <CardDescription>
                Source and target are controlled by configuration. Supported flow: Dev → Prod only.
                {source?.transferMode === 'logical_snapshot' && (
                  <span className="block mt-1 text-amber-700">
                    Dual-DB Prod credentials are not configured — promotions write to the logical Prod snapshot store.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">{source?.label || 'TopsqillITSM_Dev'}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary">{target?.label || 'TopsqillITSM_Prod'}</Badge>
              {data?.lastPromotion && (
                <span className="text-muted-foreground ml-auto">
                  Last promotion: {new Date(data.lastPromotion).toLocaleString()}
                </span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" /> Recent promotions
                </CardTitle>
                <CardDescription>Open a promotion to inspect selection, validation, and results</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/promotional-transfer/history')}>
                Full history
              </Button>
            </CardHeader>
            <CardContent>
              {!data?.recent?.length ? (
                <p className="text-sm text-muted-foreground">No promotions yet. Create a new promotion to get started.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {data.recent.map((p: any) => (
                    <Link
                      key={p.id}
                      to={`/promotional-transfer/${p.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.promotion_id} · {p.module} · {new Date(p.created_at).toLocaleString()}
                        </div>
                      </div>
                      {statusBadge(p.status)}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageContent>
  );
}
