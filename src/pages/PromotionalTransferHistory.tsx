import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PageContent from '@/components/PageContent';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { promotionApi } from '@/lib/promotion/api';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function PromotionalTransferHistory() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;
    (async () => {
      setLoading(true);
      try {
        const res = await promotionApi.listPackages();
        setPackages(res.packages || []);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load promotion history');
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile?.role]);

  if (userProfile && userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageContent
      title="Promotion History"
      description="Inspect previous promotional transfers"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/promotional-transfer')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <Button onClick={() => navigate('/promotional-transfer/new')}>
            <Plus className="h-4 w-4 mr-2" /> Create New
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All promotions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !packages.length ? (
            <p className="text-sm text-muted-foreground">No promotion packages yet.</p>
          ) : (
            <div className="rounded-md border divide-y">
              {packages.map((p) => (
                <Link
                  key={p.id}
                  to={`/promotional-transfer/${p.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.promotion_id} · {p.module} · {p.source_environment} → {p.target_environment} ·{' '}
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContent>
  );
}
