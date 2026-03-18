import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useITAssets } from '@/hooks/useITAssets';
import { Monitor, Server, Laptop, Smartphone, Wifi, WifiOff, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e', inactive: '#6b7280', maintenance: '#f59e0b',
  retired: '#8b5cf6', disposed: '#ef4444', lost: '#dc2626', stolen: '#991b1b',
};

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  workstation: Laptop, server: Server, laptop: Laptop,
  mobile: Smartphone, network: Wifi, default: Monitor,
};

export function AssetDashboard() {
  const { assets, agents, loading } = useITAssets();

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading dashboard...</div>;
  }

  const totalAssets = assets.length;
  const activeAssets = assets.filter(a => a.status === 'active').length;
  const onlineAgents = agents.filter(a => a.status === 'online').length;
  const offlineAgents = agents.filter(a => a.status === 'offline' || 
    (a.last_heartbeat && new Date(a.last_heartbeat) < new Date(Date.now() - 5 * 60 * 1000))).length;
  const maintenanceAssets = assets.filter(a => a.status === 'maintenance').length;
  const warrantyExpiring = assets.filter(a => {
    if (!a.warranty_expiry) return false;
    const exp = new Date(a.warranty_expiry);
    return exp > new Date() && exp < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }).length;

  // Status distribution
  const statusData = Object.entries(
    assets.reduce((acc: Record<string, number>, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Type distribution
  const typeData = Object.entries(
    assets.reduce((acc: Record<string, number>, a) => {
      acc[a.asset_type] = (acc[a.asset_type] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  return (
    <div className="space-y-6 mt-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Monitor className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{totalAssets}</p>
                <p className="text-xs text-muted-foreground">Total Assets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-500" /></div>
              <div>
                <p className="text-2xl font-bold">{activeAssets}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><Wifi className="h-5 w-5 text-emerald-500" /></div>
              <div>
                <p className="text-2xl font-bold">{onlineAgents}</p>
                <p className="text-xs text-muted-foreground">Agents Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10"><WifiOff className="h-5 w-5 text-red-500" /></div>
              <div>
                <p className="text-2xl font-bold">{offlineAgents}</p>
                <p className="text-xs text-muted-foreground">Agents Offline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="h-5 w-5 text-yellow-500" /></div>
              <div>
                <p className="text-2xl font-bold">{maintenanceAssets}</p>
                <p className="text-xs text-muted-foreground">Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10"><AlertTriangle className="h-5 w-5 text-orange-500" /></div>
              <div>
                <p className="text-2xl font-bold">{warrantyExpiring}</p>
                <p className="text-xs text-muted-foreground">Warranty Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Assets by Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">No assets yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Assets by Type</CardTitle></CardHeader>
          <CardContent>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">No assets yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Assets */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Recently Added Assets</CardTitle></CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No assets registered. Install agents or add assets manually to get started.</p>
          ) : (
            <div className="space-y-3">
              {assets.slice(0, 5).map(asset => {
                const Icon = TYPE_ICONS[asset.asset_type] || TYPE_ICONS.default;
                return (
                  <div key={asset.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{asset.display_name}</p>
                        <p className="text-xs text-muted-foreground">{asset.asset_tag} · {asset.asset_type} · {asset.ip_address || 'No IP'}</p>
                      </div>
                    </div>
                    <Badge variant={asset.status === 'active' ? 'default' : 'secondary'}>{asset.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
