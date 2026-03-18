import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ITAsset, AssetHardwareInfo, AssetSoftware, AssetHistory, useITAssets } from '@/hooks/useITAssets';
import { ArrowLeft, Cpu, HardDrive, MemoryStick, Monitor, Server, Clock, Package } from 'lucide-react';
import { format } from 'date-fns';

interface AssetDetailViewProps {
  asset: ITAsset;
  onBack: () => void;
}

export function AssetDetailView({ asset, onBack }: AssetDetailViewProps) {
  const { getAssetDetails } = useITAssets();
  const [hardware, setHardware] = useState<AssetHardwareInfo | null>(null);
  const [software, setSoftware] = useState<AssetSoftware[]>([]);
  const [history, setHistory] = useState<AssetHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const details = await getAssetDetails(asset.id);
      setHardware(details.hardware);
      setSoftware(details.software);
      setHistory(details.history);
      setLoading(false);
    };
    load();
  }, [asset.id]);

  return (
    <div className="space-y-4 mt-4">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />Back to Assets
      </Button>

      {/* Asset Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Monitor className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{asset.display_name}</h2>
                <p className="text-muted-foreground">{asset.asset_tag} · {asset.hostname || 'No hostname'}</p>
                <div className="flex gap-2 mt-2">
                  <Badge>{asset.status}</Badge>
                  <Badge variant="outline">{asset.asset_type}</Badge>
                  {asset.condition && <Badge variant="secondary">{asset.condition}</Badge>}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Device Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Manufacturer</span><span>{asset.manufacturer || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Model</span><span>{asset.model || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Serial #</span><span className="font-mono">{asset.serial_number || '-'}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Network</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">IP Address</span><span className="font-mono">{asset.ip_address || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">MAC Address</span><span className="font-mono text-xs">{asset.mac_address || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{asset.location || '-'}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Financial</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Purchase Date</span><span>{asset.purchase_date ? format(new Date(asset.purchase_date), 'MMM d, yyyy') : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span>{asset.purchase_cost ? `$${asset.purchase_cost.toFixed(2)}` : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Warranty</span><span>{asset.warranty_expiry ? format(new Date(asset.warranty_expiry), 'MMM d, yyyy') : '-'}</span></div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Loading details...</p>
      ) : (
        <Tabs defaultValue="hardware" className="w-full">
          <TabsList>
            <TabsTrigger value="hardware"><Cpu className="h-4 w-4 mr-2" />Hardware</TabsTrigger>
            <TabsTrigger value="software"><Package className="h-4 w-4 mr-2" />Software ({software.length})</TabsTrigger>
            <TabsTrigger value="history"><Clock className="h-4 w-4 mr-2" />History ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="hardware">
            {hardware ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4" />Processor</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Model</span><span>{hardware.cpu_model || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cores</span><span>{hardware.cpu_cores || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Speed</span><span>{hardware.cpu_speed_mhz ? `${hardware.cpu_speed_mhz} MHz` : '-'}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MemoryStick className="h-4 w-4" />Memory & Storage</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">RAM</span><span>{hardware.ram_total_gb ? `${hardware.ram_total_gb} GB` : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Disk Total</span><span>{hardware.disk_total_gb ? `${hardware.disk_total_gb} GB` : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Disk Free</span><span>{hardware.disk_free_gb ? `${hardware.disk_free_gb} GB` : '-'}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4" />OS & System</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">OS</span><span>{hardware.os_name || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>{hardware.os_version || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Architecture</span><span>{hardware.os_architecture || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">GPU</span><span>{hardware.gpu_model || '-'}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" />Board & BIOS</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Motherboard</span><span>{hardware.motherboard_model || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">BIOS</span><span>{hardware.bios_version || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Last Boot</span><span>{hardware.last_boot_time ? format(new Date(hardware.last_boot_time), 'MMM d, yyyy HH:mm') : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Uptime</span><span>{hardware.uptime_hours ? `${Math.round(hardware.uptime_hours)} hrs` : '-'}</span></div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No hardware information available. Install the agent to collect hardware data.</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="software">
            {software.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No software inventory. Install the agent to collect installed software.</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="pt-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Software</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Publisher</TableHead>
                          <TableHead>Install Date</TableHead>
                          <TableHead>Size</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {software.filter(s => !s.is_system_component).map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium text-sm">{s.software_name}</TableCell>
                            <TableCell className="text-xs font-mono">{s.version || '-'}</TableCell>
                            <TableCell className="text-xs">{s.publisher || '-'}</TableCell>
                            <TableCell className="text-xs">{s.install_date ? format(new Date(s.install_date), 'MMM d, yyyy') : '-'}</TableCell>
                            <TableCell className="text-xs">{s.size_mb ? `${s.size_mb} MB` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            {history.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No history records yet.</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {history.map(h => (
                      <div key={h.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">{h.event_type}</Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(h.performed_at), 'MMM d, yyyy HH:mm')}</span>
                          </div>
                          {h.description && <p className="text-sm mt-1">{h.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
