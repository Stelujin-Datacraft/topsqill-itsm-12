import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Network, Radar, Shield, Server, AlertTriangle, Play, Pause, Square, CheckCircle2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Network Discovery UI — configures authorized scopes and jobs.
 * Actual scan execution is performed by the Nest ITAM discovery APIs.
 * Existing agent management is unchanged (Agents tab).
 */

type ScopeRow = {
  id: string;
  name: string;
  cidr: string;
  environment: string;
  scopeKind: string;
  authorizationStatus: string;
};

type JobRow = {
  id: string;
  name: string;
  status: string;
  networkRanges: string[];
  discoveryMode: string;
  progress?: Record<string, unknown>;
};

type DiscoveredRow = {
  id: string;
  ipAddress?: string;
  hostname?: string;
  macAddress?: string;
  deviceType?: string;
  osName?: string;
  confidence?: string;
  status?: string;
  serialNumber?: string;
  assetId?: string;
};

async function itamFetch(path: string, init?: RequestInit) {
  const base = import.meta.env.VITE_API_URL || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };
  // Org/roles forwarded for Nest discovery RBAC context
  const org = localStorage.getItem('current_organization_id') || '';
  if (org) headers['x-organization-id'] = org;
  headers['x-itam-roles'] = 'ITAM_ADMIN';
  const res = await fetch(`${base}/api/itam${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export function NetworkDiscoveryPanel() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.organization_id || '';
  const [tab, setTab] = useState('dashboard');
  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredRow[]>([]);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const [scopeForm, setScopeForm] = useState({
    name: '',
    cidr: '10.10.10.0/24',
    environment: 'LAB',
    scopeKind: 'INCLUDE',
    description: '',
  });
  const [jobForm, setJobForm] = useState({
    name: '',
    networkRanges: '10.10.10.0/24',
    excludedRanges: '',
    discoveryMode: 'ACTIVE',
    maxConcurrency: '32',
    maxHosts: '1024',
    enableTcp: true,
    enableCredentialed: false,
  });

  const refresh = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      localStorage.setItem('current_organization_id', orgId);
      const [d, s, j, h] = await Promise.all([
        itamFetch('/discovery/dashboard'),
        itamFetch('/network-scopes'),
        itamFetch('/discovery/jobs'),
        itamFetch('/discovered-assets'),
      ]);
      setDashboard(d);
      setScopes(s);
      setJobs(j);
      setDiscovered(h);
    } catch (e: any) {
      // Backend may be unavailable in pure frontend preview — show guidance
      toast({
        title: 'Discovery API',
        description: e?.message || 'Unable to reach /api/itam discovery endpoints',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useMemo(() => {
    if (orgId) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const createScope = async () => {
    try {
      await itamFetch('/network-scopes', {
        method: 'POST',
        body: JSON.stringify(scopeForm),
      });
      toast({ title: 'Scope created', description: 'Pending approval before scanning' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Scope failed', description: e.message, variant: 'destructive' });
    }
  };

  const approveScope = async (id: string) => {
    try {
      await itamFetch(`/network-scopes/${id}/approve`, { method: 'POST', body: '{}' });
      toast({ title: 'Scope approved' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Approve failed', description: e.message, variant: 'destructive' });
    }
  };

  const createJob = async () => {
    try {
      const body = {
        name: jobForm.name || 'Network discovery',
        networkRanges: jobForm.networkRanges.split(',').map((s) => s.trim()).filter(Boolean),
        excludedRanges: jobForm.excludedRanges.split(',').map((s) => s.trim()).filter(Boolean),
        discoveryMode: jobForm.discoveryMode,
        maxConcurrency: Number(jobForm.maxConcurrency),
        maxHosts: Number(jobForm.maxHosts),
        enableTcp: jobForm.enableTcp,
        enableCredentialed: jobForm.enableCredentialed,
        environmentId: 'LAB',
      };
      const job = await itamFetch('/discovery/jobs', { method: 'POST', body: JSON.stringify(body) });
      await itamFetch(`/discovery/jobs/${job.id}/validate`, { method: 'POST', body: '{}' });
      toast({ title: 'Job created & validated', description: 'Review estimate before start' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Job failed', description: e.message, variant: 'destructive' });
    }
  };

  const startJob = async (id: string) => {
    try {
      await itamFetch(`/discovery/jobs/${id}/start`, { method: 'POST', body: '{}' });
      toast({ title: 'Discovery started' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Start failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radar className="h-5 w-5" /> Network Discovery
          </h2>
          <p className="text-sm text-muted-foreground">
            Discover assets on authorized enterprise networks. Does not replace the ITAM agent.
            Agent remains the authoritative detailed inventory source when installed.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-sm flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
        <div>
          Scanning requires <strong>APPROVED</strong> network scopes (LAB/TEST/UAT by default).
          Out-of-scope IPs are never scanned. Credentials use SecretProvider references only — never paste passwords here.
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="scopes">Network Scopes</TabsTrigger>
          <TabsTrigger value="jobs">Discovery Jobs</TabsTrigger>
          <TabsTrigger value="discovered">Discovered Assets</TabsTrigger>
          <TabsTrigger value="unmanaged">Unmanaged</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Jobs', value: dashboard?.jobs ?? '—', icon: Network },
              { label: 'Discovered hosts', value: dashboard?.discoveredHosts ?? '—', icon: Server },
              { label: 'Unmanaged', value: dashboard?.unmanagedAssets ?? '—', icon: Shield },
              { label: 'Software rows', value: dashboard?.softwareRows ?? '—', icon: CheckCircle2 },
            ].map((c) => (
              <Card key={c.label}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <c.icon className="h-3.5 w-3.5" /> {c.label}
                  </CardDescription>
                  <CardTitle className="text-2xl">{String(c.value)}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scopes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create network scope</CardTitle>
              <CardDescription>CIDR must be approved before any discovery job can use it.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={scopeForm.name} onChange={(e) => setScopeForm({ ...scopeForm, name: e.target.value })} />
              </div>
              <div>
                <Label>CIDR</Label>
                <Input value={scopeForm.cidr} onChange={(e) => setScopeForm({ ...scopeForm, cidr: e.target.value })} />
              </div>
              <div>
                <Label>Environment</Label>
                <Input value={scopeForm.environment} onChange={(e) => setScopeForm({ ...scopeForm, environment: e.target.value })} />
              </div>
              <div>
                <Label>Kind (INCLUDE / EXCLUDE)</Label>
                <Input value={scopeForm.scopeKind} onChange={(e) => setScopeForm({ ...scopeForm, scopeKind: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={() => void createScope()}>Create scope</Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {scopes.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <div className="font-medium">{s.name} <span className="text-muted-foreground font-mono text-sm">{s.cidr}</span></div>
                    <div className="text-xs text-muted-foreground">{s.environment} · {s.scopeKind}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.authorizationStatus === 'APPROVED' ? 'default' : 'secondary'}>
                      {s.authorizationStatus}
                    </Badge>
                    {s.authorizationStatus !== 'APPROVED' && (
                      <Button size="sm" onClick={() => void approveScope(s.id)}>Approve</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!scopes.length && <p className="text-sm text-muted-foreground">No scopes yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create discovery job</CardTitle>
              <CardDescription>Only APPROVED include CIDRs are accepted. Large ranges require confirmation.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={jobForm.name} onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Mode</Label>
                <Input value={jobForm.discoveryMode} onChange={(e) => setJobForm({ ...jobForm, discoveryMode: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Include CIDRs (comma-separated)</Label>
                <Input value={jobForm.networkRanges} onChange={(e) => setJobForm({ ...jobForm, networkRanges: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Exclude CIDRs</Label>
                <Input value={jobForm.excludedRanges} onChange={(e) => setJobForm({ ...jobForm, excludedRanges: e.target.value })} />
              </div>
              <div>
                <Label>Max concurrency</Label>
                <Input value={jobForm.maxConcurrency} onChange={(e) => setJobForm({ ...jobForm, maxConcurrency: e.target.value })} />
              </div>
              <div>
                <Label>Max hosts</Label>
                <Input value={jobForm.maxHosts} onChange={(e) => setJobForm({ ...jobForm, maxHosts: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={() => void createJob()}>Create & validate</Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {jobs.map((j) => (
              <Card key={j.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <div className="font-medium">{j.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {(j.networkRanges || []).join(', ')} · {j.discoveryMode}
                    </div>
                    {j.progress && (
                      <div className="text-xs mt-1">
                        Progress: {String(j.progress.hostsScanned || 0)} / {String(j.progress.hostsTargeted || '?')}
                        {' · '}discovered {String(j.progress.hostsDiscovered || 0)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{j.status}</Badge>
                    <Button size="sm" variant="default" onClick={() => void startJob(j.id)}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Start
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void itamFetch(`/discovery/jobs/${j.id}/pause`, { method: 'POST', body: '{}' }).then(refresh)}>
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void itamFetch(`/discovery/jobs/${j.id}/cancel`, { method: 'POST', body: '{}' }).then(refresh)}>
                      <Square className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="discovered">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">IP</th>
                  <th className="p-2">Hostname</th>
                  <th className="p-2">MAC</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">OS</th>
                  <th className="p-2">Confidence</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {discovered.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-2 font-mono">{h.ipAddress}</td>
                    <td className="p-2">{h.hostname}</td>
                    <td className="p-2 font-mono text-xs">{h.macAddress}</td>
                    <td className="p-2">{h.deviceType}</td>
                    <td className="p-2">{h.osName}</td>
                    <td className="p-2"><Badge variant="outline">{h.confidence}</Badge></td>
                    <td className="p-2">{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!discovered.length && <p className="p-4 text-sm text-muted-foreground">No discovered hosts yet. Approve a scope and run a job.</p>}
          </div>
        </TabsContent>

        <TabsContent value="unmanaged" className="space-y-3">
          <div className="rounded-md border px-3 py-2 text-sm space-y-1">
            <p className="font-medium">Agent not installed</p>
            <p className="text-muted-foreground">
              Network-discovered hosts without an ITAM agent stay <strong>UNMANAGED</strong> until an administrator
              explicitly approves agent onboarding. Installation is never automatic.
            </p>
          </div>
          <UnmanagedAssetsList orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UnmanagedAssetsList({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Array<{
    id: string;
    displayName?: string;
    hostname?: string;
    ipAddress?: string;
    discoveryLifecycle?: string;
    discoveryConfidence?: string;
    customFields?: Record<string, unknown>;
  }>>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!orgId) return;
    localStorage.setItem('current_organization_id', orgId);
    const data = await itamFetch('/unmanaged-assets');
    setRows(data);
  };

  useMemo(() => {
    void load().catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const approveOnboarding = async (assetId: string) => {
    setBusy(assetId);
    try {
      const res = await itamFetch(`/assets/${assetId}/approve-agent-onboarding`, {
        method: 'POST',
        body: '{}',
      });
      toast({
        title: 'Agent onboarding authorized',
        description: res.automaticInstall === false
          ? 'Authorization recorded. Deploy the agent separately — nothing was installed automatically.'
          : 'Approved',
      });
      await load();
    } catch (e: any) {
      toast({ title: 'Onboarding approval failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => void load()}>Refresh unmanaged</Button>
      {rows.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <div className="font-medium">{a.displayName || a.hostname || a.ipAddress || a.id}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {a.ipAddress} · {a.hostname || 'no hostname'} · confidence {a.discoveryConfidence || 'LOW'}
              </div>
              <div className="text-xs mt-1">
                Status: {a.discoveryLifecycle || 'DISCOVERED'} · Agent: not installed
                {a.customFields?.agentOnboardingApproved ? ' · Onboarding authorized (awaiting install)' : ''}
              </div>
            </div>
            <Button
              size="sm"
              disabled={busy === a.id || Boolean(a.customFields?.agentOnboardingApproved)}
              onClick={() => void approveOnboarding(a.id)}
            >
              Authorize agent install
            </Button>
          </CardContent>
        </Card>
      ))}
      {!rows.length && (
        <p className="text-sm text-muted-foreground">No unmanaged assets. Run discovery against an approved scope first.</p>
      )}
    </div>
  );
}
