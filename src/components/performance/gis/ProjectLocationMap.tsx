import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2, Save, Edit2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Props {
  perfProjectId?: string;
}

interface ProjectLocation {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  alertCount: number;
}

export function ProjectLocationMap({ perfProjectId }: Props) {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const projectId = currentProject?.id;

  const [editOpen, setEditOpen] = useState(false);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editLocName, setEditLocName] = useState('');

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
      toast({ title: 'Location Saved' });
      setEditOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const projectLocations: ProjectLocation[] = perfProjects
    .filter((p: any) => p.latitude && p.longitude)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      location_name: p.location_name,
      alertCount: alerts.filter(a => a.performance_project_id === p.id).length,
    }));

  const center: [number, number] = projectLocations.length > 0
    ? [projectLocations[0].latitude!, projectLocations[0].longitude!]
    : [20, 0];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            GIS & Location Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">
            Geospatial view of performance projects
          </p>
        </div>
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

      {/* Map */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          <div className="h-[400px]">
            {projectLocations.length > 0 ? (
              <MapContainer center={center} zoom={4} className="h-full w-full z-0">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {projectLocations.map(loc => (
                  <Marker key={loc.id} position={[loc.latitude!, loc.longitude!]}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{loc.name}</p>
                        {loc.location_name && <p className="text-muted-foreground">{loc.location_name}</p>}
                        <p className="mt-1">{loc.alertCount} active alerts</p>
                      </div>
                    </Popup>
                  </Marker>
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

      {/* Location List */}
      {projectLocations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Project Locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectLocations.map(loc => (
              <div key={loc.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{loc.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {loc.location_name || `${loc.latitude?.toFixed(4)}, ${loc.longitude?.toFixed(4)}`}
                  </p>
                </div>
                <Badge variant={loc.alertCount > 0 ? 'destructive' : 'default'} className="text-[10px]">
                  {loc.alertCount} alerts
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
