import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cloud, Server, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

async function itamFetch(path: string, init?: RequestInit) {
  const { getApiBaseUrl } = await import('@/services/api/apiClient');
  const base = getApiBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };
  const org = localStorage.getItem('current_organization_id') || '';
  if (org) headers['x-organization-id'] = org;
  headers['x-itam-roles'] = 'ITAM_ADMIN';
  try {
    const { rawSupabase } = await import('@/integrations/supabase/rawClient');
    const { data: { session } } = await rawSupabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  } catch {
    /* optional auth */
  }
  const res = await fetch(`${base}/itam${path}`, { ...init, headers });
  if (!res.ok) throw new Error(await res.text() || res.statusText);
  return res.json();
}

/** Cloud + VMware discovery UI — uses credentialReferenceId only. */
export function CloudDiscoveryPanel() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.organization_id || '';
  const [tab, setTab] = useState('providers');
  const [providers, setProviders] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [form, setForm] = useState({
    providerType: 'AWS',
    name: '',
    credentialReferenceId: '',
  });

  const refresh = async () => {
    if (!orgId) return;
    localStorage.setItem('current_organization_id', orgId);
    const [p, r, j] = await Promise.all([
      itamFetch('/cloud/providers'),
      itamFetch('/cloud/resources'),
      itamFetch('/cloud/discovery/jobs'),
    ]);
    setProviders(p);
    setResources(r);
    setJobs(j);
  };

  useMemo(() => { if (orgId) void refresh().catch(() => undefined); }, [orgId]);

  const createProvider = async () => {
    try {
      await itamFetch('/cloud/providers', { method: 'POST', body: JSON.stringify(form) });
      toast({ title: 'Cloud provider created' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const createAndStartJob = async (providerId: string) => {
    try {
      const job = await itamFetch('/cloud/discovery/jobs', {
        method: 'POST',
        body: JSON.stringify({ providerId, name: `Discover ${providerId.slice(0, 8)}` }),
      });
      await itamFetch(`/cloud/discovery/jobs/${job.id}/start`, { method: 'POST', body: '{}' });
      toast({ title: 'Cloud discovery started' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Job failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Cloud className="h-5 w-5" /> Cloud Discovery</h2>
        <p className="text-sm text-muted-foreground">
          Discover AWS / Azure / GCP resources via official APIs. Credentials use SecretProvider references only.
        </p>
      </div>
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm flex gap-2 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
        Never paste access keys or client secrets here. Provide a credentialReferenceId only.
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="vmware">VMware</TabsTrigger>
        </TabsList>
        <TabsContent value="providers" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add cloud provider</CardTitle>
              <CardDescription>LAB/TEST environments by default.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Type</Label>
                <Input value={form.providerType} onChange={(e) => setForm({ ...form, providerType: e.target.value })} />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Credential reference</Label>
                <Input value={form.credentialReferenceId} onChange={(e) => setForm({ ...form, credentialReferenceId: e.target.value })} placeholder="secret-ref-id" />
              </div>
              <Button onClick={() => void createProvider()}>Create</Button>
            </CardContent>
          </Card>
          {providers.filter((p) => p.providerType !== 'VMWARE').map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{p.name} <Badge className="ml-2">{p.providerType}</Badge></div>
                  <div className="text-xs text-muted-foreground">ref: {p.credentialReferenceId} · {p.status}</div>
                </div>
                <Button size="sm" onClick={() => void createAndStartJob(p.id)}>Discover</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="resources">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="p-2">Type</th><th className="p-2">Resource</th><th className="p-2">Name</th>
                <th className="p-2">Region</th><th className="p-2">Asset</th>
              </tr></thead>
              <tbody>
                {resources.filter((r) => r.providerType !== 'VMWARE').map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.resourceType}</td>
                    <td className="p-2 font-mono text-xs">{r.resourceId}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.region}</td>
                    <td className="p-2 font-mono text-xs">{r.assetId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!resources.length && <p className="p-4 text-sm text-muted-foreground">No cloud resources yet.</p>}
          </div>
        </TabsContent>
        <TabsContent value="jobs" className="space-y-2">
          {jobs.map((j) => (
            <Card key={j.id}><CardContent className="flex justify-between py-3">
              <div><div className="font-medium">{j.name}</div>
              <div className="text-xs text-muted-foreground">{JSON.stringify(j.progress || {})}</div></div>
              <Badge>{j.status}</Badge>
            </CardContent></Card>
          ))}
        </TabsContent>
        <TabsContent value="vmware" className="space-y-3">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Server className="h-4 w-4" /> VMware / vCenter discovery uses the same credentialReferenceId pattern.
          </p>
          <Button variant="outline" onClick={() => {
            setForm({ providerType: 'VMWARE', name: 'vCenter', credentialReferenceId: form.credentialReferenceId });
            setTab('providers');
          }}>Configure VMware provider</Button>
          <div className="text-sm">{resources.filter((r) => r.providerType === 'VMWARE').length} VMware resources</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
