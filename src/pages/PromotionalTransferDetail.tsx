import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PageContent from '@/components/PageContent';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { promotionApi } from '@/lib/promotion/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PromotionalTransferDetail() {
  const { id } = useParams<{ id: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!id || userProfile?.role !== 'admin') return;
    (async () => {
      setLoading(true);
      try {
        setData(await promotionApi.getPackage(id));
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load promotion');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, userProfile?.role]);

  if (userProfile && userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const pkg = data?.package;

  return (
    <PageContent
      title={pkg?.name || 'Promotion detail'}
      description={pkg ? `${pkg.promotion_id} · ${pkg.source_environment} → ${pkg.target_environment}` : 'Loading…'}
      actions={
        <Button variant="outline" onClick={() => navigate('/promotional-transfer')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : !pkg ? (
        <p className="text-sm text-muted-foreground">Promotion not found.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">{pkg.status}</Badge>
            <Badge variant="outline">{pkg.module}</Badge>
            <span className="text-sm text-muted-foreground">
              Created {new Date(pkg.created_at).toLocaleString()}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Package contents</CardTitle>
                <CardDescription>Selected objects and included dependencies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border divide-y max-h-80 overflow-auto">
                  {(data.items || []).map((i: any) => (
                    <div key={i.id} className="px-3 py-2 text-sm">
                      <div className="font-medium flex justify-between gap-2">
                        <span>{i.object_name}</span>
                        <Badge variant="outline" className="text-[10px]">{i.execution_status || i.validation_status || i.selection_source}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {i.object_type} · {i.stable_id}
                        {i.dev_version ? ` · Dev ${i.dev_version}` : ''}
                        {i.prod_version ? ` · Prod ${i.prod_version}` : ''}
                      </div>
                      {i.execution_error && (
                        <div className="text-xs text-red-600 mt-1">{i.execution_error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border divide-y max-h-80 overflow-auto">
                  {(data.validations || []).length === 0 && (
                    <p className="p-3 text-sm text-muted-foreground">No validation records.</p>
                  )}
                  {(data.validations || []).map((v: any) => (
                    <div key={v.id} className="px-3 py-2 text-sm">
                      <div className="font-medium capitalize">{v.severity} · {v.code}</div>
                      <div className="text-muted-foreground text-xs">{v.message}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit history</CardTitle>
              <CardDescription>Who did what, and when</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border divide-y max-h-96 overflow-auto">
                {(data.audit || []).map((a: any) => (
                  <div key={a.id} className="px-3 py-2 text-sm">
                    <div className="font-medium">{a.event_type}</div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(a.created_at).toLocaleString()} — {a.message}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {pkg.promotion_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Execution summary</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-auto max-h-64">
                  {JSON.stringify(pkg.promotion_summary, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          <Button variant="outline" asChild>
            <Link to="/promotional-transfer/history">Back to history</Link>
          </Button>
        </div>
      )}
    </PageContent>
  );
}
