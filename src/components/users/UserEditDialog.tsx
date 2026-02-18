
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserData {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  status: string;
  mobile?: string;
  nationality?: string;
  gender?: string;
  timezone?: string;
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'viewer', label: 'Viewer' },
];

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Pacific/Midway', label: '(GMT-11:00) Midway Island' },
  { value: 'Pacific/Honolulu', label: '(GMT-10:00) Hawaii' },
  { value: 'America/Anchorage', label: '(GMT-09:00) Alaska' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time (US & Canada)' },
  { value: 'America/Phoenix', label: '(GMT-07:00) Arizona' },
  { value: 'America/Denver', label: '(GMT-07:00) Mountain Time (US & Canada)' },
  { value: 'America/Chicago', label: '(GMT-06:00) Central Time (US & Canada)' },
  { value: 'America/Mexico_City', label: '(GMT-06:00) Mexico City' },
  { value: 'America/New_York', label: '(GMT-05:00) Eastern Time (US & Canada)' },
  { value: 'America/Bogota', label: '(GMT-05:00) Bogota, Lima' },
  { value: 'America/Caracas', label: '(GMT-04:00) Caracas' },
  { value: 'America/Halifax', label: '(GMT-04:00) Atlantic Time (Canada)' },
  { value: 'America/Santiago', label: '(GMT-04:00) Santiago' },
  { value: 'America/Sao_Paulo', label: '(GMT-03:00) Brasilia' },
  { value: 'America/Argentina/Buenos_Aires', label: '(GMT-03:00) Buenos Aires' },
  { value: 'America/St_Johns', label: '(GMT-03:30) Newfoundland' },
  { value: 'Atlantic/Azores', label: '(GMT-01:00) Azores' },
  { value: 'Atlantic/Cape_Verde', label: '(GMT-01:00) Cape Verde Is.' },
  { value: 'Europe/London', label: '(GMT+00:00) London, Dublin' },
  { value: 'Africa/Casablanca', label: '(GMT+00:00) Casablanca' },
  { value: 'Europe/Paris', label: '(GMT+01:00) Paris, Brussels, Madrid' },
  { value: 'Europe/Berlin', label: '(GMT+01:00) Berlin, Rome' },
  { value: 'Africa/Lagos', label: '(GMT+01:00) West Central Africa' },
  { value: 'Europe/Athens', label: '(GMT+02:00) Athens, Istanbul' },
  { value: 'Africa/Cairo', label: '(GMT+02:00) Cairo' },
  { value: 'Europe/Helsinki', label: '(GMT+02:00) Helsinki, Kyiv' },
  { value: 'Asia/Jerusalem', label: '(GMT+02:00) Jerusalem' },
  { value: 'Africa/Johannesburg', label: '(GMT+02:00) Johannesburg' },
  { value: 'Europe/Moscow', label: '(GMT+03:00) Moscow, St. Petersburg' },
  { value: 'Asia/Kuwait', label: '(GMT+03:00) Kuwait, Riyadh' },
  { value: 'Africa/Nairobi', label: '(GMT+03:00) Nairobi' },
  { value: 'Asia/Baghdad', label: '(GMT+03:00) Baghdad' },
  { value: 'Asia/Tehran', label: '(GMT+03:30) Tehran' },
  { value: 'Asia/Dubai', label: '(GMT+04:00) Abu Dhabi, Muscat' },
  { value: 'Asia/Baku', label: '(GMT+04:00) Baku, Tbilisi, Yerevan' },
  { value: 'Asia/Kabul', label: '(GMT+04:30) Kabul' },
  { value: 'Asia/Karachi', label: '(GMT+05:00) Islamabad, Karachi' },
  { value: 'Asia/Tashkent', label: '(GMT+05:00) Tashkent' },
  { value: 'Asia/Kolkata', label: '(GMT+05:30) India Standard Time' },
  { value: 'Asia/Colombo', label: '(GMT+05:30) Sri Jayawardenepura' },
  { value: 'Asia/Kathmandu', label: '(GMT+05:45) Kathmandu' },
  { value: 'Asia/Dhaka', label: '(GMT+06:00) Dhaka' },
  { value: 'Asia/Almaty', label: '(GMT+06:00) Almaty' },
  { value: 'Asia/Yangon', label: '(GMT+06:30) Yangon (Rangoon)' },
  { value: 'Asia/Bangkok', label: '(GMT+07:00) Bangkok, Hanoi, Jakarta' },
  { value: 'Asia/Shanghai', label: '(GMT+08:00) Beijing, Shanghai' },
  { value: 'Asia/Hong_Kong', label: '(GMT+08:00) Hong Kong' },
  { value: 'Asia/Singapore', label: '(GMT+08:00) Singapore' },
  { value: 'Australia/Perth', label: '(GMT+08:00) Perth' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo, Osaka' },
  { value: 'Asia/Seoul', label: '(GMT+09:00) Seoul' },
  { value: 'Australia/Adelaide', label: '(GMT+09:30) Adelaide' },
  { value: 'Australia/Darwin', label: '(GMT+09:30) Darwin' },
  { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney, Melbourne' },
  { value: 'Australia/Brisbane', label: '(GMT+10:00) Brisbane' },
  { value: 'Pacific/Guam', label: '(GMT+10:00) Guam, Port Moresby' },
  { value: 'Pacific/Noumea', label: '(GMT+11:00) Solomon Is., New Caledonia' },
  { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland, Wellington' },
  { value: 'Pacific/Fiji', label: '(GMT+12:00) Fiji' },
  { value: 'Pacific/Tongatapu', label: '(GMT+13:00) Nuku\'alofa' },
];

const NATIONALITY_OPTIONS = [
  { value: 'AF', label: 'Afghanistan' },
  { value: 'AL', label: 'Albania' },
  { value: 'DZ', label: 'Algeria' },
  { value: 'AR', label: 'Argentina' },
  { value: 'AM', label: 'Armenia' },
  { value: 'AU', label: 'Australia' },
  { value: 'AT', label: 'Austria' },
  { value: 'AZ', label: 'Azerbaijan' },
  { value: 'BH', label: 'Bahrain' },
  { value: 'BD', label: 'Bangladesh' },
  { value: 'BY', label: 'Belarus' },
  { value: 'BE', label: 'Belgium' },
  { value: 'BR', label: 'Brazil' },
  { value: 'BG', label: 'Bulgaria' },
  { value: 'CA', label: 'Canada' },
  { value: 'CL', label: 'Chile' },
  { value: 'CN', label: 'China' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'HR', label: 'Croatia' },
  { value: 'CU', label: 'Cuba' },
  { value: 'CY', label: 'Cyprus' },
  { value: 'CZ', label: 'Czech Republic' },
  { value: 'DK', label: 'Denmark' },
  { value: 'EG', label: 'Egypt' },
  { value: 'EE', label: 'Estonia' },
  { value: 'ET', label: 'Ethiopia' },
  { value: 'FI', label: 'Finland' },
  { value: 'FR', label: 'France' },
  { value: 'GE', label: 'Georgia' },
  { value: 'DE', label: 'Germany' },
  { value: 'GH', label: 'Ghana' },
  { value: 'GR', label: 'Greece' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'HU', label: 'Hungary' },
  { value: 'IS', label: 'Iceland' },
  { value: 'IN', label: 'India' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'IR', label: 'Iran' },
  { value: 'IQ', label: 'Iraq' },
  { value: 'IE', label: 'Ireland' },
  { value: 'IL', label: 'Israel' },
  { value: 'IT', label: 'Italy' },
  { value: 'JP', label: 'Japan' },
  { value: 'JO', label: 'Jordan' },
  { value: 'KZ', label: 'Kazakhstan' },
  { value: 'KE', label: 'Kenya' },
  { value: 'KW', label: 'Kuwait' },
  { value: 'LV', label: 'Latvia' },
  { value: 'LB', label: 'Lebanon' },
  { value: 'LT', label: 'Lithuania' },
  { value: 'LU', label: 'Luxembourg' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'MX', label: 'Mexico' },
  { value: 'MA', label: 'Morocco' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'NO', label: 'Norway' },
  { value: 'OM', label: 'Oman' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'PE', label: 'Peru' },
  { value: 'PH', label: 'Philippines' },
  { value: 'PL', label: 'Poland' },
  { value: 'PT', label: 'Portugal' },
  { value: 'QA', label: 'Qatar' },
  { value: 'RO', label: 'Romania' },
  { value: 'RU', label: 'Russia' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'RS', label: 'Serbia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'SK', label: 'Slovakia' },
  { value: 'SI', label: 'Slovenia' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'KR', label: 'South Korea' },
  { value: 'ES', label: 'Spain' },
  { value: 'LK', label: 'Sri Lanka' },
  { value: 'SE', label: 'Sweden' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'TH', label: 'Thailand' },
  { value: 'TR', label: 'Turkey' },
  { value: 'UA', label: 'Ukraine' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'VN', label: 'Vietnam' },
];

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
  onUserUpdated: () => void;
}

export function UserEditDialog({ open, onOpenChange, user, onUserUpdated }: UserEditDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'user',
    mobile: '',
    nationality: '',
    gender: '',
    timezone: '',
    status: 'active',
  });

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        role: user.role || 'user',
        mobile: user.mobile || '',
        nationality: user.nationality || '',
        gender: user.gender || '',
        timezone: user.timezone || '',
        status: user.status || 'active',
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          role: form.role,
          mobile: form.mobile || null,
          nationality: form.nationality || null,
          gender: form.gender || null,
          timezone: form.timezone || null,
          status: form.status,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'User updated successfully' });
      onUserUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update user', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user profile information for {user.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input id="first_name" value={form.first_name} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" value={form.last_name} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={form.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input id="mobile" type="tel" value={form.mobile} onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+1 234 567 8900" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Select value={form.nationality} onValueChange={(v) => setForm(f => ({ ...f, nationality: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select nationality" />
                </SelectTrigger>
                <SelectContent>
                  {NATIONALITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm(f => ({ ...f, gender: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm(f => ({ ...f, timezone: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
