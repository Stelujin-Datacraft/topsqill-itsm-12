import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useITAssets, ITAsset } from '@/hooks/useITAssets';
import { Plus, Search, Trash2, Edit, Eye, Monitor, Server, Laptop, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import { AssetDetailView } from './AssetDetailView';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default', inactive: 'secondary', maintenance: 'outline',
  retired: 'secondary', disposed: 'destructive', lost: 'destructive', stolen: 'destructive',
};

const ASSET_TYPES = ['workstation', 'server', 'laptop', 'mobile', 'network', 'printer', 'peripheral', 'other'];
const STATUSES = ['active', 'inactive', 'maintenance', 'retired', 'disposed', 'lost', 'stolen'];
const CONDITIONS = ['new', 'good', 'fair', 'poor', 'broken'];

export function AssetList() {
  const { assets, loading, createAsset, updateAsset, deleteAsset } = useITAssets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editAsset, setEditAsset] = useState<ITAsset | null>(null);
  const [viewAsset, setViewAsset] = useState<ITAsset | null>(null);
  const [formData, setFormData] = useState({
    display_name: '', asset_type: 'workstation', hostname: '', manufacturer: '',
    model: '', serial_number: '', status: 'active', condition: 'good',
    department: '', location: '', ip_address: '', mac_address: '',
    purchase_date: '', purchase_cost: '', warranty_expiry: '', notes: '',
  });

  const filteredAssets = assets.filter(a => {
    const matchesSearch = !search || 
      a.display_name.toLowerCase().includes(search.toLowerCase()) ||
      a.hostname?.toLowerCase().includes(search.toLowerCase()) ||
      a.asset_tag?.toLowerCase().includes(search.toLowerCase()) ||
      a.ip_address?.toLowerCase().includes(search.toLowerCase()) ||
      a.serial_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesType = typeFilter === 'all' || a.asset_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const openAddDialog = () => {
    setFormData({
      display_name: '', asset_type: 'workstation', hostname: '', manufacturer: '',
      model: '', serial_number: '', status: 'active', condition: 'good',
      department: '', location: '', ip_address: '', mac_address: '',
      purchase_date: '', purchase_cost: '', warranty_expiry: '', notes: '',
    });
    setEditAsset(null);
    setShowAddDialog(true);
  };

  const openEditDialog = (asset: ITAsset) => {
    setFormData({
      display_name: asset.display_name, asset_type: asset.asset_type, hostname: asset.hostname || '',
      manufacturer: asset.manufacturer || '', model: asset.model || '', serial_number: asset.serial_number || '',
      status: asset.status, condition: asset.condition || 'good',
      department: asset.department || '', location: asset.location || '',
      ip_address: asset.ip_address || '', mac_address: asset.mac_address || '',
      purchase_date: asset.purchase_date || '', purchase_cost: asset.purchase_cost?.toString() || '',
      warranty_expiry: asset.warranty_expiry || '', notes: asset.notes || '',
    });
    setEditAsset(asset);
    setShowAddDialog(true);
  };

  const handleSubmit = async () => {
    const data: any = { ...formData };
    if (data.purchase_cost) data.purchase_cost = parseFloat(data.purchase_cost);
    else delete data.purchase_cost;
    if (!data.purchase_date) delete data.purchase_date;
    if (!data.warranty_expiry) delete data.warranty_expiry;

    if (editAsset) {
      await updateAsset(editAsset.id, data);
    } else {
      await createAsset(data);
    }
    setShowAddDialog(false);
  };

  if (viewAsset) {
    return <AssetDetailView asset={viewAsset} onBack={() => setViewAsset(null)} />;
  }

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Asset Inventory</CardTitle>
            <Button onClick={openAddDialog} size="sm"><Plus className="h-4 w-4 mr-2" />Add Asset</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filteredAssets.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No assets found.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map(asset => (
                    <TableRow key={asset.id} className="cursor-pointer" onClick={() => setViewAsset(asset)}>
                      <TableCell className="font-mono text-xs">{asset.asset_tag}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{asset.display_name}</p>
                          {asset.hostname && <p className="text-xs text-muted-foreground">{asset.hostname}</p>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{asset.asset_type}</Badge></TableCell>
                      <TableCell><Badge variant={STATUS_VARIANTS[asset.status] || 'secondary'}>{asset.status}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{asset.ip_address || '-'}</TableCell>
                      <TableCell className="text-xs">{asset.location || '-'}</TableCell>
                      <TableCell className="text-xs">{format(new Date(asset.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewAsset(asset)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(asset)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteAsset(asset.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAsset ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
            <DialogDescription>Enter the asset information below.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input value={formData.display_name} onChange={e => setFormData(p => ({ ...p, display_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Hostname</Label>
              <Input value={formData.hostname} onChange={e => setFormData(p => ({ ...p, hostname: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Select value={formData.asset_type} onValueChange={v => setFormData(p => ({ ...p, asset_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={formData.condition} onValueChange={v => setFormData(p => ({ ...p, condition: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input value={formData.manufacturer} onChange={e => setFormData(p => ({ ...p, manufacturer: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input value={formData.serial_number} onChange={e => setFormData(p => ({ ...p, serial_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input value={formData.ip_address} onChange={e => setFormData(p => ({ ...p, ip_address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>MAC Address</Label>
              <Input value={formData.mac_address} onChange={e => setFormData(p => ({ ...p, mac_address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={formData.department} onChange={e => setFormData(p => ({ ...p, department: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input type="date" value={formData.purchase_date} onChange={e => setFormData(p => ({ ...p, purchase_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Purchase Cost</Label>
              <Input type="number" value={formData.purchase_cost} onChange={e => setFormData(p => ({ ...p, purchase_cost: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Warranty Expiry</Label>
              <Input type="date" value={formData.warranty_expiry} onChange={e => setFormData(p => ({ ...p, warranty_expiry: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.display_name}>{editAsset ? 'Update' : 'Create'} Asset</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
