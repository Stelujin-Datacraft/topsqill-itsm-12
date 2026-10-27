import { FormEvent, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject } from '@/contexts/ProjectContext';
import { reApi, type ReProfile } from '@/lib/re/api';
import { RE_PROFILE_TYPES } from '@/lib/re/constants';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ReProfilesPage() {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const orgId = currentOrganization?.id;
  const [rows, setRows] = useState<ReProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [profileType, setProfileType] = useState('buyer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setDisplayName('');
    setProfileType('buyer');
    setEmail('');
    setPhone('');
  };

  const reload = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reApi.listProfiles(orgId);
      setRows(res.profiles || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profiles');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const startEdit = (row: ReProfile) => {
    setEditingId(row.id);
    setDisplayName(row.display_name || '');
    setProfileType(row.profile_type || 'buyer');
    setEmail(row.email || '');
    setPhone(row.phone || '');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !displayName.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await reApi.updateProfile(editingId, {
          organizationId: orgId,
          displayName: displayName.trim(),
          profileType,
          email: email || null,
          phone: phone || null,
        });
        toast({ title: 'Profile updated' });
      } else {
        await reApi.createProfile({
          organizationId: orgId,
          projectId: currentProject?.id || null,
          displayName: displayName.trim(),
          profileType,
          email: email || null,
          phone: phone || null,
        });
        toast({ title: 'Profile created' });
      }
      resetForm();
      await reload();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end max-w-5xl">
        <div className="space-y-1.5 lg:col-span-1">
          <Label htmlFor="re-profile-name">Name</Label>
          <Input
            id="re-profile-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={profileType} onValueChange={setProfileType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RE_PROFILE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-profile-email">Email</Label>
          <Input
            id="re-profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-profile-phone">Phone</Label>
          <Input
            id="re-profile-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!orgId || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? 'Update' : 'Add profile'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No RE profiles yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.display_name}</TableCell>
                  <TableCell>{row.profile_type}</TableCell>
                  <TableCell>{row.email || '—'}</TableCell>
                  <TableCell>{row.phone || '—'}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(row)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
