import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Network, Radio } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

async function itamFetch(path: string, init?: RequestInit) {
  const base = import.meta.env.VITE_API_URL || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };
  const org = localStorage.getItem('current_organization_id') || '';
  if (org) headers['x-organization-id'] = org;
  headers['x-itam-roles'] = 'ITAM_ADMIN';
  const res = await fetch(`${base}/api/itam${path}`, { ...init, headers });
  if (!res.ok) throw new Error(await res.text() || res.statusText);
  return res.json();
}

export function NetworkIntelligencePanel() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.organization_id || '';
  const [observations, setObservations] = useState<any[]>([]);
  const [dhcp, setDhcp] = useState<any[]>([]);
  const [dns, setDns] = useState<any[]>([]);
  const [switches, setSwitches] = useState<any[]>([]);

  const refresh = async () => {
    if (!orgId) return;
    localStorage.setItem('current_organization_id', orgId);
    const [o, d, n, s] = await Promise.all([
      itamFetch('/network-intelligence/observations'),
      itamFetch('/network-intelligence/dhcp'),
      itamFetch('/network-intelligence/dns'),
      itamFetch('/network-intelligence/switches'),
    ]);
    setObservations(o);
    setDhcp(d);
    setDns(n);
    setSwitches(s);
  };

  useMemo(() => { if (orgId) void refresh().catch(() => undefined); }, [orgId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Radio className="h-5 w-5" /> Network Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Passive DHCP / ARP / DNS / switch MAC observations correlated into ITAM assets. Authorized sources only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh().catch((e) => toast({ title: 'Load failed', description: String(e.message), variant: 'destructive' }))}>
          Refresh
        </Button>
      </div>
      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="dhcp">DHCP</TabsTrigger>
          <TabsTrigger value="dns">DNS</TabsTrigger>
          <TabsTrigger value="switch">Switch MAC</TabsTrigger>
        </TabsList>
        <TabsContent value="recent" className="space-y-2">
          {observations.slice(0, 50).map((o) => (
            <Card key={o.id}><CardContent className="py-3 flex justify-between gap-2 text-sm">
              <div>
                <span className="font-mono">{o.ipAddress || '—'}</span> · {o.macAddress || '—'} · {o.hostname || '—'}
                <div className="text-xs text-muted-foreground">{o.observedAt}</div>
              </div>
              <Badge variant="outline">{o.sourceType}</Badge>
            </CardContent></Card>
          ))}
          {!observations.length && <p className="text-sm text-muted-foreground">No observations yet.</p>}
        </TabsContent>
        <TabsContent value="dhcp"><ObsTable rows={dhcp} /></TabsContent>
        <TabsContent value="dns"><ObsTable rows={dns} /></TabsContent>
        <TabsContent value="switch"><ObsTable rows={switches} extra /></TabsContent>
      </Tabs>
    </div>
  );
}

function ObsTable({ rows, extra }: { rows: any[]; extra?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>
          <th className="p-2">IP</th><th className="p-2">MAC</th><th className="p-2">Hostname</th>
          {extra && <th className="p-2">Switch</th>}
          {extra && <th className="p-2">Port</th>}
          <th className="p-2">Asset</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-mono">{r.ipAddress}</td>
              <td className="p-2 font-mono text-xs">{r.macAddress}</td>
              <td className="p-2">{r.hostname}</td>
              {extra && <td className="p-2">{r.switchId}</td>}
              {extra && <td className="p-2">{r.interfaceName}</td>}
              <td className="p-2 font-mono text-xs">{r.assetId || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-4 text-sm text-muted-foreground">No rows.</p>}
    </div>
  );
}

export function TopologyPanel() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.organization_id || '';
  const [summary, setSummary] = useState<any>(null);
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [hideLow, setHideLow] = useState(true);
  const [filter, setFilter] = useState('');

  const refresh = async () => {
    if (!orgId) return;
    localStorage.setItem('current_organization_id', orgId);
    const [s, g] = await Promise.all([
      itamFetch('/topology/summary'),
      itamFetch(`/topology?maxNodes=200${hideLow ? '' : '&includeLowConfidence=1'}`),
    ]);
    setSummary(s);
    setGraph(g);
  };

  useMemo(() => { if (orgId) void refresh().catch(() => undefined); }, [orgId, hideLow]);

  const nodes = graph.nodes.filter((n) =>
    !filter || String(n.displayName || n.logicalKey).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Network className="h-5 w-5" /> Topology</h2>
          <p className="text-sm text-muted-foreground">
            Evidence-based relationships between ITAM assets, switches, cloud, and VMware. Bounded traversal only.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant={hideLow ? 'default' : 'outline'} size="sm" onClick={() => setHideLow(!hideLow)}>
            {hideLow ? 'Hiding LOW confidence' : 'Showing LOW confidence'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>Refresh</Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nodes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.nodes ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Edges</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.edges ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">History</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.history ?? '—'}</CardContent></Card>
      </div>
      <input
        className="w-full rounded-md border px-3 py-2 text-sm"
        placeholder="Filter nodes…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border max-h-96 overflow-auto">
          <div className="p-2 text-xs font-medium bg-muted/50">Nodes (lazy / bounded)</div>
          {nodes.map((n) => (
            <div key={n.id} className="border-t px-3 py-2 text-sm flex justify-between gap-2">
              <div>
                <div className="font-medium">{n.displayName || n.logicalKey}</div>
                <div className="text-xs text-muted-foreground font-mono">{n.nodeKind} · {n.logicalKey}</div>
              </div>
              {n.assetId && <Badge variant="outline">asset</Badge>}
            </div>
          ))}
        </div>
        <div className="rounded-md border max-h-96 overflow-auto">
          <div className="p-2 text-xs font-medium bg-muted/50">Edges</div>
          {graph.edges.map((e) => (
            <div key={e.id} className="border-t px-3 py-2 text-sm flex justify-between gap-2">
              <div>
                <div className="font-medium">{e.relationshipType}</div>
                <div className="text-xs text-muted-foreground">source: {e.source}</div>
              </div>
              <Badge variant={e.confidence === 'HIGH' ? 'default' : 'secondary'}>{e.confidence}</Badge>
            </div>
          ))}
          {!graph.edges.length && <p className="p-4 text-sm text-muted-foreground">No topology edges yet.</p>}
        </div>
      </div>
    </div>
  );
}
