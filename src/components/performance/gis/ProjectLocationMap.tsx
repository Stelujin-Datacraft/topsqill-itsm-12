import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { usePerformanceAuditLog } from '@/hooks/usePerformanceAuditLog';
import { MapPin, Loader2, Save, Edit2, Layers, BarChart3, AlertTriangle, Ruler, Globe2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom colored markers for severity
function createColoredIcon(color: string) {
  return new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

const severityIcons = {
  healthy: createColoredIcon('#10b981'),
  warning: createColoredIcon('#f59e0b'),
  critical: createColoredIcon('#ef4444'),
};

interface Props {
  perfProjectId?: string;
}

interface ProjectLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  alertCount: number;
  criticalAlerts: number;
  thresholdCount: number;
  health: 'healthy' | 'warning' | 'critical';
}

type TileLayerType = 'street' | 'satellite' | 'terrain';

const TILE_LAYERS: Record<TileLayerType, { url: string; attribution: string; label: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    label: 'Street',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    label: 'Satellite',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    label: 'Terrain',
  },
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ProjectLocationMap({ perfProjectId }: Props) {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logAction } = usePerformanceAuditLog(perfProjectId);
  const projectId = currentProject?.id;

  const [editOpen, setEditOpen] = useState(false);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editLocName, setEditLocName] = useState('');
  const [tileLayer, setTileLayer] = useState<TileLayerType>('street');
  const [showAlertRadius, setShowAlertRadius] = useState(false);
  const [gisTab, setGisTab] = useState('map');

  const { data: perfProjects = [], isLoading } = useQuery({
    queryKey: ['gis-projects', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_projects')
        .select('id, name, latitude, longitude, location_name')
        .eq('project_id', projectId)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!projectId,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['gis-alerts', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_alerts')
        .select('id, performance_project_id, severity, status')
        .eq('project_id', projectId)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!projectId,
  });

  const { data: allThresholds = [] } = useQuery({
    queryKey: ['gis-thresholds', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('performance_thresholds')
        .select('id, performance_project_id, is_active')
        .eq('project_id', projectId)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!projectId,
  });

  const currentPerfProject = perfProjects.find((p: any) => p.id === perfProjectId);

  useEffect(() => {
    if (currentPerfProject) {
      setEditLat(currentPerfProject.latitude?.toString() || '');
      setEditLng(currentPerfProject.longitude?.toString() || '');
      setEditLocName(currentPerfProject.location_name || '');
    }
  }, [currentPerfProject]);

  const saveLocation = useMutation({
    mutationFn: async () => {
      if (!perfProjectId) throw new Error('No project');
      const { error } = await supabase
        .from('performance_projects')
        .update({
          latitude: editLat ? parseFloat(editLat) : null,
          longitude: editLng ? parseFloat(editLng) : null,
          location_name: editLocName || null,
        })
        .eq('id', perfProjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-projects'] });
      logAction.mutate({
        action_type: 'location_updated',
        action_category: 'gis',
        title: 'Project location updated',
        description: `Location set to ${editLocName || `${editLat}, ${editLng}`}`,
      });
      toast({ title: 'Location Saved' });
      setEditOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const projectLocations: ProjectLocation[] = useMemo(() =>
    perfProjects
      .filter((p: any) => p.latitude && p.longitude)
      .map((p: any) => {
        const projectAlerts = alerts.filter(a => a.performance_project_id === p.id);
        const criticalAlerts = projectAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
        const health: ProjectLocation['health'] = criticalAlerts > 0 ? 'critical' : projectAlerts.length > 0 ? 'warning' : 'healthy';
        return {
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          location_name: p.location_name,
          alertCount: projectAlerts.length,
          criticalAlerts,
          thresholdCount: allThresholds.filter(t => t.performance_project_id === p.id).length,
          health,
        };
      }),
    [perfProjects, alerts, allThresholds]
  );

  // Spatial analytics
  const spatialStats = useMemo(() => {
    if (projectLocations.length < 2) return null;
    const distances: number[] = [];
    for (let i = 0; i < projectLocations.length; i++) {
      for (let j = i + 1; j < projectLocations.length; j++) {
        distances.push(haversineDistance(
          projectLocations[i].latitude, projectLocations[i].longitude,
          projectLocations[j].latitude, projectLocations[j].longitude
        ));
      }
    }
    const avgDist = distances.reduce((s, d) => s + d, 0) / distances.length;
    const maxDist = Math.max(...distances);
    const centroidLat = projectLocations.reduce((s, p) => s + p.latitude, 0) / projectLocations.length;
    const centroidLng = projectLocations.reduce((s, p) => s + p.longitude, 0) / projectLocations.length;
    const criticalNearby = projectLocations.filter(p => p.health === 'critical');
    let clusterRisk = false;
    for (let i = 0; i < criticalNearby.length; i++) {
      for (let j = i + 1; j < criticalNearby.length; j++) {
        if (haversineDistance(criticalNearby[i].latitude, criticalNearby[i].longitude, criticalNearby[j].latitude, criticalNearby[j].longitude) < 50) {
          clusterRisk = true;
        }
      }
    }
    return { avgDist, maxDist, centroidLat, centroidLng, clusterRisk, totalLocations: projectLocations.length };
  }, [projectLocations]);

  const center: [number, number] = projectLocations.length > 0
    ? [projectLocations[0].latitude, projectLocations[0].longitude]
    : [20, 0];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const tile = TILE_LAYERS[tileLayer];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            GIS & Engineering Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">
            Geospatial analysis, layer controls, and spatial risk clustering
          </p>
        </div>
        <div className="flex items-center gap-2">
          {perfProjectId && (
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit2 className="h-3.5 w-3.5" />
                  {currentPerfProject?.latitude ? 'Edit Location' : 'Set Location'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Project Location</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Location Name</Label>
                    <Input value={editLocName} onChange={e => setEditLocName(e.target.value)} placeholder="e.g., New York Office" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Latitude</Label>
                      <Input value={editLat} onChange={e => setEditLat(e.target.value)} placeholder="40.7128" type="number" step="any" />
                    </div>
                    <div>
                      <Label>Longitude</Label>
                      <Input value={editLng} onChange={e => setEditLng(e.target.value)} placeholder="-74.0060" type="number" step="any" />
                    </div>
                  </div>
                  <Button className="w-full gap-2" onClick={() => saveLocation.mutate()} disabled={saveLocation.isPending}>
                    {saveLocation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Location
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs value={gisTab} onValueChange={setGisTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="map" className="gap-1.5 text-xs"><Globe2 className="h-3.5 w-3.5" />Map View</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" />Spatial Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-3 mt-3">
          {/* Layer Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <Select value={tileLayer} onValueChange={(v) => setTileLayer(v as TileLayerType)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TILE_LAYERS).map(([key, val]) => (
                    <SelectItem key={key} value={key} className="text-xs">{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={showAlertRadius ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setShowAlertRadius(!showAlertRadius)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Alert Zones
            </Button>
            <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Healthy</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />Warning</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Critical</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <div className="h-[450px]">
                {projectLocations.length > 0 ? (
                  <MapContainer center={center} zoom={4} className="h-full w-full z-0">
                    <TileLayer attribution={tile.attribution} url={tile.url} />
                    {projectLocations.map(loc => (
                      <React.Fragment key={loc.id}>
                        <Marker position={[loc.latitude, loc.longitude]} icon={severityIcons[loc.health]}>
                          <Popup>
                            <div className="text-sm min-w-[180px]">
                              <p className="font-semibold text-foreground">{loc.name}</p>
                              {loc.location_name && <p className="text-muted-foreground text-xs">{loc.location_name}</p>}
                              <div className="mt-2 space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span>Active Alerts</span>
                                  <span className="font-medium">{loc.alertCount}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Critical/High</span>
                                  <span className="font-medium text-red-600">{loc.criticalAlerts}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Active Thresholds</span>
                                  <span className="font-medium">{loc.thresholdCount}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Health</span>
                                  <span className={`font-medium ${loc.health === 'healthy' ? 'text-emerald-600' : loc.health === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {loc.health.charAt(0).toUpperCase() + loc.health.slice(1)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                        {showAlertRadius && loc.alertCount > 0 && (
                          <Circle
                            center={[loc.latitude, loc.longitude]}
                            radius={loc.criticalAlerts > 0 ? 50000 : 25000}
                            pathOptions={{
                              color: loc.health === 'critical' ? '#ef4444' : '#f59e0b',
                              fillColor: loc.health === 'critical' ? '#ef4444' : '#f59e0b',
                              fillOpacity: 0.1,
                              weight: 1,
                            }}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </MapContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-muted/30">
                    <MapPin className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="font-medium text-foreground">No locations configured</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Set coordinates on your performance projects to see them on the map.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location List with enriched data */}
          {projectLocations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Project Locations ({projectLocations.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {projectLocations.map(loc => (
                  <div key={loc.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${loc.health === 'healthy' ? 'bg-emerald-500' : loc.health === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{loc.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {loc.location_name || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{loc.thresholdCount} rules</Badge>
                      <Badge variant={loc.alertCount > 0 ? 'destructive' : 'default'} className="text-[10px]">
                        {loc.alertCount} alerts
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Spatial Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-primary" />
                  Spatial Summary
                </CardTitle>
                <CardDescription className="text-xs">Distance and distribution analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {spatialStats ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Locations</span>
                      <span className="font-medium">{spatialStats.totalLocations}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Distance</span>
                      <span className="font-medium">{spatialStats.avgDist.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Max Spread</span>
                      <span className="font-medium">{spatialStats.maxDist.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Centroid</span>
                      <span className="font-medium text-xs">{spatialStats.centroidLat.toFixed(4)}, {spatialStats.centroidLng.toFixed(4)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Need at least 2 locations for analysis.</p>
                )}
              </CardContent>
            </Card>

            {/* Risk Clustering */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Geospatial Risk
                </CardTitle>
                <CardDescription className="text-xs">Spatial risk cluster detection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Healthy Sites</span>
                  <span className="font-medium text-emerald-600">{projectLocations.filter(p => p.health === 'healthy').length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Warning Sites</span>
                  <span className="font-medium text-yellow-600">{projectLocations.filter(p => p.health === 'warning').length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Critical Sites</span>
                  <span className="font-medium text-red-600">{projectLocations.filter(p => p.health === 'critical').length}</span>
                </div>
                {spatialStats?.clusterRisk && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                    <p className="font-medium text-red-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Risk Cluster Detected
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Multiple critical sites within 50km radius — potential regional issue.
                    </p>
                  </div>
                )}
                {spatialStats && !spatialStats.clusterRisk && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    <p className="font-medium text-emerald-600">No Risk Clusters</p>
                    <p className="text-muted-foreground mt-1">Critical sites are geographically dispersed.</p>
                  </div>
                )}
                {!spatialStats && (
                  <p className="text-sm text-muted-foreground">Need multiple locations for cluster analysis.</p>
                )}
              </CardContent>
            </Card>

            {/* Per-Location Metrics */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Location Metrics Matrix</CardTitle>
                <CardDescription className="text-xs">Performance indicators per geographic site</CardDescription>
              </CardHeader>
              <CardContent>
                {projectLocations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Site</th>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Location</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Alerts</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Critical</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Rules</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Health</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectLocations.map(loc => (
                          <tr key={loc.id} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{loc.name}</td>
                            <td className="py-2 pr-4 text-muted-foreground">{loc.location_name || `${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}`}</td>
                            <td className="py-2 px-2 text-center">{loc.alertCount}</td>
                            <td className="py-2 px-2 text-center text-red-600">{loc.criticalAlerts}</td>
                            <td className="py-2 px-2 text-center">{loc.thresholdCount}</td>
                            <td className="py-2 px-2 text-center">
                              <Badge variant={loc.health === 'healthy' ? 'default' : loc.health === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                                {loc.health}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No locations configured yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
