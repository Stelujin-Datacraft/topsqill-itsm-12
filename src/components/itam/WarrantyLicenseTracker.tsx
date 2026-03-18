import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useITAssets } from '@/hooks/useITAssets';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, addDays } from 'date-fns';
import { ShieldCheck, Key, AlertTriangle, Clock, Plus, Edit, Trash2, Search, Calendar } from 'lucide-react';

interface License {
  id: string;
  organization_id: string;
  asset_id: string | null;
  license_name: string;
  license_key: string | null;
  license_type: string;
  vendor: string | null;
  product: string | null;
  purchase_date: string | null;
  expiry_date: string | null;
  cost: number | null;
  currency: string;
  seats_total: number;
  seats_used: number;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const LICENSE_TYPES = ['per-device', 'per-user', 'site', 'volume', 'subscription', 'perpetual'];
const LICENSE_STATUSES = ['active', 'expired', 'expiring_soon', 'inactive', 'revoked'];

export function WarrantyLicenseTracker() {
  const { assets } = useITAssets();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('warranties');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editLicense, setEditLicense] = useState<License | null>(null);
  const [formData, setFormData] = useState({
    license_name: '', license_key: '', license_type: 'per-device', vendor: '',
    product: '', asset_id: '', purchase_date: '', expiry_date: '',
    cost: '', currency: 'USD', seats_total: '1', seats_used: '0',
    status: 'active', notes: '',
  });

  const loadLicenses = useCallback(async () => {
    if (!userProfile?.organization_id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('asset_licenses')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLicenses((data as any[]) || []);
    } catch (e: any) {
      console.error('Error loading licenses:', e);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.organization_id]);

  useEffect(() => { loadLicenses(); }, [loadLicenses]);

  const now = new Date();
  const thirtyDaysFromNow = addDays(now, 30);
  const sixtyDaysFromNow = addDays(now, 60);

  // Warranty data from assets
  const assetsWithWarranty = assets.filter(a => a.warranty_expiry);
  const warrantyExpired = assetsWithWarranty.filter(a => new Date(a.warranty_expiry!) < now);
  const warrantyExpiringSoon = assetsWithWarranty.filter(a => {
    const exp = new Date(a.warranty_expiry!);
    return exp >= now && exp <= sixtyDaysFromNow;
  });
  const warrantyActive = assetsWithWarranty.filter(a => new Date(a.warranty_expiry!) > sixtyDaysFromNow);

  // License stats
  const activeLicenses = licenses.filter(l => l.status === 'active');
  const expiringLicenses = licenses.filter(l => {
    if (!l.expiry_date) return false;
    const exp = new Date(l.expiry_date);
    return exp >= now && exp <= thirtyDaysFromNow;
  });
  const expiredLicenses = licenses.filter(l => l.expiry_date && new Date(l.expiry_date) < now && l.status !== 'inactive');

  const filteredWarrantyAssets = assetsWithWarranty.filter(a =>
    !search || a.display_name.toLowerCase().includes(search.toLowerCase()) ||
    a.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
    a.serial_number?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLicenses = licenses.filter(l =>
    !search || l.license_name.toLowerCase().includes(search.toLowerCase()) ||
    l.vendor?.toLowerCase().includes(search.toLowerCase()) ||
    l.product?.toLowerCase().includes(search.toLowerCase())
  );

  const getWarrantyBadge = (expiryDate: string) => {
    const exp = new Date(expiryDate);
    const days = differenceInDays(exp, now);
    if (days < 0) return <Badge variant="destructive">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-red-500/90 text-white">Expires in {days}d</Badge>;
    if (days <= 60) return <Badge className="bg-amber-500/90 text-white">Expires in {days}d</Badge>;
    return <Badge className="bg-emerald-500/90 text-white">Valid ({days}d left)</Badge>;
  };

  const getLicenseBadge = (license: License) => {
    if (!license.expiry_date) return <Badge variant="outline">Perpetual</Badge>;
    const exp = new Date(license.expiry_date);
    const days = differenceInDays(exp, now);
    if (days < 0) return <Badge variant="destructive">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-red-500/90 text-white">{days}d left</Badge>;
    if (days <= 60) return <Badge className="bg-amber-500/90 text-white">{days}d left</Badge>;
    return <Badge className="bg-emerald-500/90 text-white">Active</Badge>;
  };

  const openAddDialog = () => {
    setFormData({
      license_name: '', license_key: '', license_type: 'per-device', vendor: '',
      product: '', asset_id: '', purchase_date: '', expiry_date: '',
      cost: '', currency: 'USD', seats_total: '1', seats_used: '0',
      status: 'active', notes: '',
    });
    setEditLicense(null);
    setShowDialog(true);
  };

  const openEditDialog = (license: License) => {
    setFormData({
      license_name: license.license_name,
      license_key: license.license_key || '',
      license_type: license.license_type,
      vendor: license.vendor || '',
      product: license.product || '',
      asset_id: license.asset_id || '',
      purchase_date: license.purchase_date || '',
      expiry_date: license.expiry_date || '',
      cost: license.cost?.toString() || '',
      currency: license.currency || 'USD',
      seats_total: license.seats_total?.toString() || '1',
      seats_used: license.seats_used?.toString() || '0',
      status: license.status,
      notes: license.notes || '',
    });
    setEditLicense(license);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!userProfile) return;
    const payload: any = {
      license_name: formData.license_name,
      license_key: formData.license_key || null,
      license_type: formData.license_type,
      vendor: formData.vendor || null,
      product: formData.product || null,
      asset_id: formData.asset_id || null,
      purchase_date: formData.purchase_date || null,
      expiry_date: formData.expiry_date || null,
      cost: formData.cost ? parseFloat(formData.cost) : null,
      currency: formData.currency,
      seats_total: parseInt(formData.seats_total) || 1,
      seats_used: parseInt(formData.seats_used) || 0,
      status: formData.status,
      notes: formData.notes || null,
    };

    try {
      if (editLicense) {
        const { error } = await supabase.from('asset_licenses').update(payload).eq('id', editLicense.id);
        if (error) throw error;
        toast({ title: 'License updated' });
      } else {
        const { error } = await supabase.from('asset_licenses').insert({
          ...payload,
          organization_id: userProfile.organization_id,
          created_by: userProfile.id,
        });
        if (error) throw error;
        toast({ title: 'License created' });
      }
      setShowDialog(false);
      loadLicenses();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const deleteLicense = async (id: string) => {
    try {
      const { error } = await supabase.from('asset_licenses').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'License deleted' });
      loadLicenses();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><ShieldCheck className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{warrantyActive.length}</p>
                <p className="text-xs text-muted-foreground">Warranty Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
              <div>
                <p className="text-2xl font-bold">{warrantyExpiringSoon.length}</p>
                <p className="text-xs text-muted-foreground">Warranty Expiring</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><Clock className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{warrantyExpired.length}</p>
                <p className="text-xs text-muted-foreground">Warranty Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Key className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{activeLicenses.length}</p>
                <p className="text-xs text-muted-foreground">Active Licenses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
              <div>
                <p className="text-2xl font-bold">{expiringLicenses.length}</p>
                <p className="text-xs text-muted-foreground">Licenses Expiring</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><Clock className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{expiredLicenses.length}</p>
                <p className="text-xs text-muted-foreground">Licenses Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Warranties and Licenses */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="warranties" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />Warranties ({assetsWithWarranty.length})
            </TabsTrigger>
            <TabsTrigger value="licenses" className="flex items-center gap-2">
              <Key className="h-4 w-4" />Licenses ({licenses.length})
            </TabsTrigger>
          </TabsList>
          {activeTab === 'licenses' && (
            <Button size="sm" onClick={openAddDialog}><Plus className="h-4 w-4 mr-2" />Add License</Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Warranties Tab */}
        <TabsContent value="warranties">
          <Card>
            <CardContent className="pt-4">
              {filteredWarrantyAssets.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No assets with warranty data. Add warranty expiry dates to your assets to track them here.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>Tag</TableHead>
                        <TableHead>Manufacturer</TableHead>
                        <TableHead>Serial #</TableHead>
                        <TableHead>Purchase Date</TableHead>
                        <TableHead>Warranty Expiry</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWarrantyAssets
                        .sort((a, b) => new Date(a.warranty_expiry!).getTime() - new Date(b.warranty_expiry!).getTime())
                        .map(asset => (
                          <TableRow key={asset.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{asset.display_name}</p>
                                <p className="text-xs text-muted-foreground">{asset.asset_type}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{asset.asset_tag || '-'}</TableCell>
                            <TableCell className="text-sm">{asset.manufacturer || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">{asset.serial_number || '-'}</TableCell>
                            <TableCell className="text-sm">{asset.purchase_date ? format(new Date(asset.purchase_date), 'MMM d, yyyy') : '-'}</TableCell>
                            <TableCell className="text-sm">{format(new Date(asset.warranty_expiry!), 'MMM d, yyyy')}</TableCell>
                            <TableCell>{getWarrantyBadge(asset.warranty_expiry!)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Licenses Tab */}
        <TabsContent value="licenses">
          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Loading licenses...</p>
              ) : filteredLicenses.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No licenses found. Click "Add License" to start tracking software licenses.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>License</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Seats</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLicenses.map(license => (
                        <TableRow key={license.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{license.license_name}</p>
                              {license.product && <p className="text-xs text-muted-foreground">{license.product}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{license.vendor || '-'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{license.license_type}</Badge></TableCell>
                          <TableCell className="text-sm">
                            <span className={license.seats_used >= license.seats_total ? 'text-destructive font-medium' : ''}>
                              {license.seats_used}/{license.seats_total}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {license.expiry_date ? format(new Date(license.expiry_date), 'MMM d, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {license.cost ? `${license.currency} ${license.cost.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell>{getLicenseBadge(license)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(license)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteLicense(license.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        </TabsContent>
      </Tabs>

      {/* Add/Edit License Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLicense ? 'Edit License' : 'Add New License'}</DialogTitle>
            <DialogDescription>Enter the license details below.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>License Name *</Label>
              <Input value={formData.license_name} onChange={e => setFormData(p => ({ ...p, license_name: e.target.value }))} placeholder="e.g. Microsoft 365 E3" />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input value={formData.vendor} onChange={e => setFormData(p => ({ ...p, vendor: e.target.value }))} placeholder="e.g. Microsoft" />
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Input value={formData.product} onChange={e => setFormData(p => ({ ...p, product: e.target.value }))} placeholder="e.g. Office 365" />
            </div>
            <div className="space-y-2">
              <Label>License Type</Label>
              <Select value={formData.license_type} onValueChange={v => setFormData(p => ({ ...p, license_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>License Key</Label>
              <Input value={formData.license_key} onChange={e => setFormData(p => ({ ...p, license_key: e.target.value }))} placeholder="XXXXX-XXXXX-XXXXX" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Assigned Asset</Label>
              <Select value={formData.asset_id} onValueChange={v => setFormData(p => ({ ...p, asset_id: v }))}>
                <SelectTrigger><SelectValue placeholder="None (org-wide)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (org-wide)</SelectItem>
                  {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LICENSE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input type="date" value={formData.purchase_date} onChange={e => setFormData(p => ({ ...p, purchase_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input type="date" value={formData.expiry_date} onChange={e => setFormData(p => ({ ...p, expiry_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Total Seats</Label>
              <Input type="number" value={formData.seats_total} onChange={e => setFormData(p => ({ ...p, seats_total: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Seats Used</Label>
              <Input type="number" value={formData.seats_used} onChange={e => setFormData(p => ({ ...p, seats_used: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input type="number" step="0.01" value={formData.cost} onChange={e => setFormData(p => ({ ...p, cost: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={formData.currency} onValueChange={v => setFormData(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.license_name}>{editLicense ? 'Update' : 'Create'} License</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
