import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Mail, Phone, Globe, Calendar, Edit } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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

const UserProfile = () => {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    nationality: '',
    gender: '',
    timezone: '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        email: userProfile.email || '',
        mobile: userProfile.mobile || '',
        nationality: userProfile.nationality || '',
        gender: userProfile.gender || '',
        timezone: userProfile.timezone || '',
      });
    }
  }, [userProfile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          mobile: formData.mobile,
          nationality: formData.nationality,
          gender: formData.gender,
          timezone: formData.timezone,
        })
        .eq('id', userProfile?.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to update profile. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully.',
      });
      
      setIsEditMode(false);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (userProfile) {
      setFormData({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        email: userProfile.email || '',
        mobile: userProfile.mobile || '',
        nationality: userProfile.nationality || '',
        gender: userProfile.gender || '',
        timezone: userProfile.timezone || '',
      });
    }
    setIsEditMode(false);
  };

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const initials = `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase() || 'U';

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your personal information and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isEditMode ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    <User className="inline h-4 w-4 mr-2" />
                    First Name
                  </Label>
                  <p className="text-base font-medium">{formData.first_name || 'Not set'}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    <User className="inline h-4 w-4 mr-2" />
                    Last Name
                  </Label>
                  <p className="text-base font-medium">{formData.last_name || 'Not set'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  <Mail className="inline h-4 w-4 mr-2" />
                  Email
                </Label>
                <p className="text-base font-medium">{formData.email}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  <Phone className="inline h-4 w-4 mr-2" />
                  Mobile
                </Label>
                <p className="text-base font-medium">{formData.mobile || 'Not set'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  <Globe className="inline h-4 w-4 mr-2" />
                  Nationality
                </Label>
                <p className="text-base font-medium">
                  {NATIONALITY_OPTIONS.find(n => n.value === formData.nationality)?.label || 'Not set'}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  <User className="inline h-4 w-4 mr-2" />
                  Gender
                </Label>
                <p className="text-base font-medium capitalize">{formData.gender?.replace('_', ' ') || 'Not set'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">
                <Calendar className="inline h-4 w-4 mr-2" />
                Timezone
              </Label>
              <p className="text-base font-medium">
                {TIMEZONE_OPTIONS.find(tz => tz.value === formData.timezone)?.label || 'Not set'}
              </p>
            </div>

              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Account Information</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Role:</span> {userProfile.role}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> {userProfile.status}
                    </div>
                    <div>
                      <span className="font-medium">Member since:</span> {new Date(userProfile.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setIsEditMode(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Update Profile
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">
                  <User className="inline h-4 w-4 mr-2" />
                  First Name
                </Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Enter first name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">
                  <User className="inline h-4 w-4 mr-2" />
                  Last Name
                </Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="inline h-4 w-4 mr-2" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">
                <Phone className="inline h-4 w-4 mr-2" />
                Mobile
              </Label>
              <Input
                id="mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleInputChange('mobile', e.target.value)}
                placeholder="Enter mobile number"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nationality">
                  <Globe className="inline h-4 w-4 mr-2" />
                  Nationality
                </Label>
                <Select
                  value={formData.nationality}
                  onValueChange={(value) => handleInputChange('nationality', value)}
                >
                  <SelectTrigger id="nationality">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONALITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">
                  <User className="inline h-4 w-4 mr-2" />
                  Gender
                </Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => handleInputChange('gender', value)}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">
                <Calendar className="inline h-4 w-4 mr-2" />
                Timezone
              </Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => handleInputChange('timezone', value)}
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">Account Information</p>
                  <p className="text-xs text-muted-foreground">Role: {userProfile.role}</p>
                  <p className="text-xs text-muted-foreground">Status: {userProfile.status}</p>
                  <p className="text-xs text-muted-foreground">
                    Member since: {new Date(userProfile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserProfile;
