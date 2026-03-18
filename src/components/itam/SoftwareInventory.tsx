import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Package } from 'lucide-react';

interface SoftwareEntry {
  software_name: string;
  version: string;
  publisher: string;
  install_count: number;
  assets: string[];
}

export function SoftwareInventory() {
  const { userProfile } = useAuth();
  const [software, setSoftware] = useState<SoftwareEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!userProfile?.organization_id) return;
      setLoading(true);
      try {
        // Get all software with asset names
        const { data, error } = await supabase
          .from('asset_software')
          .select(`
            software_name, version, publisher,
            it_assets!inner(display_name, organization_id)
          `)
          .eq('is_system_component', false)
          .order('software_name');

        if (error) throw error;

        // Group by software name
        const grouped: Record<string, SoftwareEntry> = {};
        ((data as any[]) || []).forEach(item => {
          if (item.it_assets?.organization_id !== userProfile.organization_id) return;
          const key = `${item.software_name}__${item.version || ''}`;
          if (!grouped[key]) {
            grouped[key] = {
              software_name: item.software_name,
              version: item.version || '',
              publisher: item.publisher || '',
              install_count: 0,
              assets: [],
            };
          }
          grouped[key].install_count++;
          if (!grouped[key].assets.includes(item.it_assets.display_name)) {
            grouped[key].assets.push(item.it_assets.display_name);
          }
        });

        setSoftware(Object.values(grouped).sort((a, b) => b.install_count - a.install_count));
      } catch (e) {
        console.error('Error loading software:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userProfile?.organization_id]);

  const filtered = software.filter(s =>
    !search || s.software_name.toLowerCase().includes(search.toLowerCase()) ||
    s.publisher.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Software Inventory ({software.length} unique)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search software..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading software inventory...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {software.length === 0 ? 'No software data collected. Install agents on your systems.' : 'No software matches your search.'}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Software</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Publisher</TableHead>
                    <TableHead>Installed On</TableHead>
                    <TableHead>Installs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{s.software_name}</TableCell>
                      <TableCell className="text-xs font-mono">{s.version || '-'}</TableCell>
                      <TableCell className="text-xs">{s.publisher || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.assets.slice(0, 3).map((a, j) => (
                            <Badge key={j} variant="outline" className="text-xs">{a}</Badge>
                          ))}
                          {s.assets.length > 3 && (
                            <Badge variant="secondary" className="text-xs">+{s.assets.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{s.install_count}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
