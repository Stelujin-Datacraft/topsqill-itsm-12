import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FormField } from '@/types/form';
import { FieldRuleAction } from '@/types/rules';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, ChevronDown, X, Users, Loader2, Upload, Phone, ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectMembership } from '@/hooks/useProjectMembership';
import { SubmissionAccessInput } from './SubmissionAccessInput';
import { cn } from '@/lib/utils';

interface Country {
  code: string;
  name: string;
  flag: string;
}

interface ActionValueInputProps {
  action: FieldRuleAction;
  targetField: FormField | null;
  value: any;
  onChange: (value: any) => void;
}

export function ActionValueInput({ action, targetField, value, onChange }: ActionValueInputProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  
  // Hooks must be called unconditionally at the top level
  const { currentProject } = useProject();
  const { projectMembers, loading } = useProjectMembership(currentProject?.id || '');

  // Load countries when component mounts for address and country fields
  useEffect(() => {
    const loadCountries = async () => {
      setCountriesLoading(true);
      try {
        // Using a comprehensive list of countries with flags
        const countryList = [
          { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
          { code: 'AL', name: 'Albania', flag: '🇦🇱' },
          { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
          { code: 'AS', name: 'American Samoa', flag: '🇦🇸' },
          { code: 'AD', name: 'Andorra', flag: '🇦🇩' },
          { code: 'AO', name: 'Angola', flag: '🇦🇴' },
          { code: 'AI', name: 'Anguilla', flag: '🇦🇮' },
          { code: 'AQ', name: 'Antarctica', flag: '🇦🇶' },
          { code: 'AG', name: 'Antigua and Barbuda', flag: '🇦🇬' },
          { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
          { code: 'AM', name: 'Armenia', flag: '🇦🇲' },
          { code: 'AW', name: 'Aruba', flag: '🇦🇼' },
          { code: 'AU', name: 'Australia', flag: '🇦🇺' },
          { code: 'AT', name: 'Austria', flag: '🇦🇹' },
          { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿' },
          { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
          { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
          { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
          { code: 'BB', name: 'Barbados', flag: '🇧🇧' },
          { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
          { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
          { code: 'BZ', name: 'Belize', flag: '🇧🇿' },
          { code: 'BJ', name: 'Benin', flag: '🇧🇯' },
          { code: 'BM', name: 'Bermuda', flag: '🇧🇲' },
          { code: 'BT', name: 'Bhutan', flag: '🇧🇹' },
          { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
          { code: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
          { code: 'BW', name: 'Botswana', flag: '🇧🇼' },
          { code: 'BV', name: 'Bouvet Island', flag: '🇧🇻' },
          { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
          { code: 'IO', name: 'British Indian Ocean Territory', flag: '🇮🇴' },
          { code: 'BN', name: 'Brunei Darussalam', flag: '🇧🇳' },
          { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
          { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
          { code: 'BI', name: 'Burundi', flag: '🇧🇮' },
          { code: 'KH', name: 'Cambodia', flag: '🇰🇭' },
          { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
          { code: 'CA', name: 'Canada', flag: '🇨🇦' },
          { code: 'CV', name: 'Cape Verde', flag: '🇨🇻' },
          { code: 'KY', name: 'Cayman Islands', flag: '🇰🇾' },
          { code: 'CF', name: 'Central African Republic', flag: '🇨🇫' },
          { code: 'TD', name: 'Chad', flag: '🇹🇩' },
          { code: 'CL', name: 'Chile', flag: '🇨🇱' },
          { code: 'CN', name: 'China', flag: '🇨🇳' },
          { code: 'CX', name: 'Christmas Island', flag: '🇨🇽' },
          { code: 'CC', name: 'Cocos (Keeling) Islands', flag: '🇨🇨' },
          { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
          { code: 'KM', name: 'Comoros', flag: '🇰🇲' },
          { code: 'CG', name: 'Congo', flag: '🇨🇬' },
          { code: 'CD', name: 'Congo, Democratic Republic', flag: '🇨🇩' },
          { code: 'CK', name: 'Cook Islands', flag: '🇨🇰' },
          { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
          { code: 'CI', name: 'Cote D\'Ivoire', flag: '🇨🇮' },
          { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
          { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
          { code: 'CY', name: 'Cyprus', flag: '🇨🇾' },
          { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
          { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
          { code: 'DJ', name: 'Djibouti', flag: '🇩🇯' },
          { code: 'DM', name: 'Dominica', flag: '🇩🇲' },
          { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
          { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
          { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
          { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
          { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶' },
          { code: 'ER', name: 'Eritrea', flag: '🇪🇷' },
          { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
          { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
          { code: 'FK', name: 'Falkland Islands (Malvinas)', flag: '🇫🇰' },
          { code: 'FO', name: 'Faroe Islands', flag: '🇫🇴' },
          { code: 'FJ', name: 'Fiji', flag: '🇫🇯' },
          { code: 'FI', name: 'Finland', flag: '🇫🇮' },
          { code: 'FR', name: 'France', flag: '🇫🇷' },
          { code: 'GF', name: 'French Guiana', flag: '🇬🇫' },
          { code: 'PF', name: 'French Polynesia', flag: '🇵🇫' },
          { code: 'TF', name: 'French Southern Territories', flag: '🇹🇫' },
          { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
          { code: 'GM', name: 'Gambia', flag: '🇬🇲' },
          { code: 'GE', name: 'Georgia', flag: '🇬🇪' },
          { code: 'DE', name: 'Germany', flag: '🇩🇪' },
          { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
          { code: 'GI', name: 'Gibraltar', flag: '🇬🇮' },
          { code: 'GR', name: 'Greece', flag: '🇬🇷' },
          { code: 'GL', name: 'Greenland', flag: '🇬🇱' },
          { code: 'GD', name: 'Grenada', flag: '🇬🇩' },
          { code: 'GP', name: 'Guadeloupe', flag: '🇬🇵' },
          { code: 'GU', name: 'Guam', flag: '🇬🇺' },
          { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
          { code: 'GG', name: 'Guernsey', flag: '🇬🇬' },
          { code: 'GN', name: 'Guinea', flag: '🇬🇳' },
          { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼' },
          { code: 'GY', name: 'Guyana', flag: '🇬🇾' },
          { code: 'HT', name: 'Haiti', flag: '🇭🇹' },
          { code: 'HM', name: 'Heard Island & Mcdonald Islands', flag: '🇭🇲' },
          { code: 'VA', name: 'Holy See (Vatican City State)', flag: '🇻🇦' },
          { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
          { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
          { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
          { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
          { code: 'IN', name: 'India', flag: '🇮🇳' },
          { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
          { code: 'IR', name: 'Iran, Islamic Republic Of', flag: '🇮🇷' },
          { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
          { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
          { code: 'IM', name: 'Isle Of Man', flag: '🇮🇲' },
          { code: 'IL', name: 'Israel', flag: '🇮🇱' },
          { code: 'IT', name: 'Italy', flag: '🇮🇹' },
          { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
          { code: 'JP', name: 'Japan', flag: '🇯🇵' },
          { code: 'JE', name: 'Jersey', flag: '🇯🇪' },
          { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
          { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
          { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
          { code: 'KI', name: 'Kiribati', flag: '🇰🇮' },
          { code: 'KR', name: 'Korea', flag: '🇰🇷' },
          { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
          { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬' },
          { code: 'LA', name: 'Lao People\'s Democratic Republic', flag: '🇱🇦' },
          { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
          { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
          { code: 'LS', name: 'Lesotho', flag: '🇱🇸' },
          { code: 'LR', name: 'Liberia', flag: '🇱🇷' },
          { code: 'LY', name: 'Libyan Arab Jamahiriya', flag: '🇱🇾' },
          { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮' },
          { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
          { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
          { code: 'MO', name: 'Macao', flag: '🇲🇴' },
          { code: 'MK', name: 'Macedonia', flag: '🇲🇰' },
          { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
          { code: 'MW', name: 'Malawi', flag: '🇲🇼' },
          { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
          { code: 'MV', name: 'Maldives', flag: '🇲🇻' },
          { code: 'ML', name: 'Mali', flag: '🇲🇱' },
          { code: 'MT', name: 'Malta', flag: '🇲🇹' },
          { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭' },
          { code: 'MQ', name: 'Martinique', flag: '🇲🇶' },
          { code: 'MR', name: 'Mauritania', flag: '🇲🇷' },
          { code: 'MU', name: 'Mauritius', flag: '🇲🇺' },
          { code: 'YT', name: 'Mayotte', flag: '🇾🇹' },
          { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
          { code: 'FM', name: 'Micronesia, Federated States Of', flag: '🇫🇲' },
          { code: 'MD', name: 'Moldova', flag: '🇲🇩' },
          { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
          { code: 'MN', name: 'Mongolia', flag: '🇲🇳' },
          { code: 'ME', name: 'Montenegro', flag: '🇲🇪' },
          { code: 'MS', name: 'Montserrat', flag: '🇲🇸' },
          { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
          { code: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
          { code: 'MM', name: 'Myanmar', flag: '🇲🇲' },
          { code: 'NA', name: 'Namibia', flag: '🇳🇦' },
          { code: 'NR', name: 'Nauru', flag: '🇳🇷' },
          { code: 'NP', name: 'Nepal', flag: '🇳🇵' },
          { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
          { code: 'AN', name: 'Netherlands Antilles', flag: '🇦🇳' },
          { code: 'NC', name: 'New Caledonia', flag: '🇳🇨' },
          { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
          { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
          { code: 'NE', name: 'Niger', flag: '🇳🇪' },
          { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
          { code: 'NU', name: 'Niue', flag: '🇳🇺' },
          { code: 'NF', name: 'Norfolk Island', flag: '🇳🇫' },
          { code: 'MP', name: 'Northern Mariana Islands', flag: '🇲🇵' },
          { code: 'NO', name: 'Norway', flag: '🇳🇴' },
          { code: 'OM', name: 'Oman', flag: '🇴🇲' },
          { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
          { code: 'PW', name: 'Palau', flag: '🇵🇼' },
          { code: 'PS', name: 'Palestinian Territory, Occupied', flag: '🇵🇸' },
          { code: 'PA', name: 'Panama', flag: '🇵🇦' },
          { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬' },
          { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
          { code: 'PE', name: 'Peru', flag: '🇵🇪' },
          { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
          { code: 'PN', name: 'Pitcairn', flag: '🇵🇳' },
          { code: 'PL', name: 'Poland', flag: '🇵🇱' },
          { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
          { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
          { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
          { code: 'RE', name: 'Reunion', flag: '🇷🇪' },
          { code: 'RO', name: 'Romania', flag: '🇷🇴' },
          { code: 'RU', name: 'Russian Federation', flag: '🇷🇺' },
          { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
          { code: 'BL', name: 'Saint Barthelemy', flag: '🇧🇱' },
          { code: 'SH', name: 'Saint Helena', flag: '🇸🇭' },
          { code: 'KN', name: 'Saint Kitts And Nevis', flag: '🇰🇳' },
          { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨' },
          { code: 'MF', name: 'Saint Martin', flag: '🇲🇫' },
          { code: 'PM', name: 'Saint Pierre And Miquelon', flag: '🇵🇲' },
          { code: 'VC', name: 'Saint Vincent And Grenadines', flag: '🇻🇨' },
          { code: 'WS', name: 'Samoa', flag: '🇼🇸' },
          { code: 'SM', name: 'San Marino', flag: '🇸🇲' },
          { code: 'ST', name: 'Sao Tome And Principe', flag: '🇸🇹' },
          { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
          { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
          { code: 'RS', name: 'Serbia', flag: '🇷🇸' },
          { code: 'SC', name: 'Seychelles', flag: '🇸🇨' },
          { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱' },
          { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
          { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
          { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
          { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧' },
          { code: 'SO', name: 'Somalia', flag: '🇸🇴' },
          { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
          { code: 'GS', name: 'South Georgia And Sandwich Isl.', flag: '🇬🇸' },
          { code: 'ES', name: 'Spain', flag: '🇪🇸' },
          { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
          { code: 'SD', name: 'Sudan', flag: '🇸🇩' },
          { code: 'SR', name: 'Suriname', flag: '🇸🇷' },
          { code: 'SJ', name: 'Svalbard And Jan Mayen', flag: '🇸🇯' },
          { code: 'SZ', name: 'Swaziland', flag: '🇸🇿' },
          { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
          { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
          { code: 'SY', name: 'Syrian Arab Republic', flag: '🇸🇾' },
          { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
          { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯' },
          { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
          { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
          { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱' },
          { code: 'TG', name: 'Togo', flag: '🇹🇬' },
          { code: 'TK', name: 'Tokelau', flag: '🇹🇰' },
          { code: 'TO', name: 'Tonga', flag: '🇹🇴' },
          { code: 'TT', name: 'Trinidad And Tobago', flag: '🇹🇹' },
          { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
          { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
          { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲' },
          { code: 'TC', name: 'Turks And Caicos Islands', flag: '🇹🇨' },
          { code: 'TV', name: 'Tuvalu', flag: '🇹🇻' },
          { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
          { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
          { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
          { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
          { code: 'US', name: 'United States', flag: '🇺🇸' },
          { code: 'UM', name: 'United States Outlying Islands', flag: '🇺🇲' },
          { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
          { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿' },
          { code: 'VU', name: 'Vanuatu', flag: '🇻🇺' },
          { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
          { code: 'VN', name: 'Viet Nam', flag: '🇻🇳' },
          { code: 'VG', name: 'Virgin Islands, British', flag: '🇻🇬' },
          { code: 'VI', name: 'Virgin Islands, U.S.', flag: '🇻🇮' },
          { code: 'WF', name: 'Wallis And Futuna', flag: '🇼🇫' },
          { code: 'EH', name: 'Western Sahara', flag: '🇪🇭' },
          { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
          { code: 'ZM', name: 'Zambia', flag: '🇿🇲' },
          { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' }
        ];
        setCountries(countryList);
      } catch (error) {
        console.error('Error loading countries:', error);
      } finally {
        setCountriesLoading(false);
      }
    };

    loadCountries();
  }, []);

  // Don't show input for actions that don't need values
  if (!['setDefault', 'changeLabel', 'showTooltip', 'showError', 'changeOptions', 'filterOptions'].includes(action)) {
    return null;
  }

  // Handle filterOptions action for select, multi-select, and radio fields
  if (action === 'filterOptions' && targetField && ['select', 'multi-select', 'radio'].includes(targetField.type)) {
    const currentOptions = Array.isArray(value) ? value : [];
    
    const handleOptionToggle = (option: any) => {
      const isSelected = currentOptions.some((opt: any) => 
        (typeof opt === 'string' ? opt === option.value : opt.value === option.value)
      );
      
      const newOptions = isSelected
        ? currentOptions.filter((opt: any) => 
            (typeof opt === 'string' ? opt !== option.value : opt.value !== option.value)
          )
        : [...currentOptions, option];
      
      onChange(newOptions);
    };
    
return (
  <div className="space-y-2">
    <Label className="text-sm font-medium">
      Select options to show when rule is active:
    </Label>
    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
      {Array.isArray(targetField.options)
        ? targetField.options
            .filter((option: any) => option.value && option.value.trim() !== '')
            .map((option: any) => {
              const isChecked = currentOptions.some((opt: any) => 
                (typeof opt === 'string' ? opt === option.value : opt.value === option.value)
              );
              
              return (
                <div key={option.id || option.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => handleOptionToggle(option)}
                  />
                  <Label className="text-sm cursor-pointer flex-1 flex items-center gap-2">
                    {option.color && (
                      <div 
                        className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" 
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    {option.image && (
                      <img
                        src={option.image}
                        alt={option.label || option.value}
                        className="h-6 w-6 object-contain rounded"
                      />
                    )}
                    <span>
                      {option.label && option.label.trim() !== '' ? option.label : option.value}
                    </span>
                  </Label>
                </div>
              );
            })
        : null}
    </div>
    {currentOptions.length > 0 && (
      <div className="text-xs text-muted-foreground">
        {currentOptions.length} option(s) will be visible when rule is active
      </div>
    )}
  </div>
);

  }

  // Handle changeOptions action with textarea
  if (action === 'changeOptions') {
    return (
      <div className="space-y-2">
        <textarea
          className="w-full p-2 border rounded min-h-[80px] text-sm"
          value={Array.isArray(value) ? value.map((opt: any) => typeof opt === 'string' ? opt : opt.label).join('\n') : value?.toString() || ''}
          onChange={(e) => {
            const lines = e.target.value.split('\n').filter(line => line.trim());
            // Convert lines to proper option objects
            const options = lines.map((line, index) => ({
              id: `option-${index}`,
              value: line.toLowerCase().replace(/\s+/g, '-'),
              label: line
            }));
            onChange(options);
          }}
          placeholder="Option 1&#10;Option 2&#10;Option 3"
        />
        <p className="text-xs text-muted-foreground">Enter one option per line</p>
      </div>
    );
  }

  // Handle setDefault action based on target field type
  if (action === 'setDefault' && targetField) {
    // User picker field
    if (targetField.type === 'user-picker') {
      const config = targetField.customConfig || {};
      const isMultiple = config.allowMultiple || config.maxSelections > 1;
      const selectedUserIds = Array.isArray(value) ? value : (value ? [value] : []);

      const filteredUsers = projectMembers?.filter(user => {
        if (config.roleFilter) {
          return user.role === config.roleFilter;
        }
        return true;
      }).filter(user => 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
      ) || [];

      const handleUserSelect = (userId: string) => {
        if (isMultiple) {
          const newSelection = selectedUserIds.includes(userId)
            ? selectedUserIds.filter(id => id !== userId)
            : [...selectedUserIds, userId];
          onChange(newSelection);
        } else {
          onChange(userId);
          setOpen(false);
        }
      };

      const removeUser = (userId: string) => {
        if (isMultiple) {
          onChange(selectedUserIds.filter(id => id !== userId));
        } else {
          onChange('');
        }
      };

      const getUserDisplayName = (user: any) => {
        return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
      };

      const getUserInitials = (user: any) => {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?';
      };

      return (
        <div className="space-y-2">
          {/* Selected users */}
          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUserIds.map(userId => {
                const user = projectMembers?.find(u => u.user_id === userId);
                if (!user) return null;
                return (
                  <Badge key={userId} variant="secondary" className="flex items-center gap-2">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-xs">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{getUserDisplayName(user)}</span>
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeUser(userId)}
                    />
                  </Badge>
                );
              })}
            </div>
          )}

          {/* User selection */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                disabled={loading}
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {selectedUserIds.length === 0 
                    ? "Select users..." 
                    : `${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''} selected`
                  }
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput 
                  placeholder="Search users..." 
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                />
                <CommandList>
                  <CommandEmpty>
                    {loading ? "Loading users..." : "No users found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredUsers.map((user) => (
                      <CommandItem
                        key={user.user_id}
                        value={user.email}
                        onSelect={() => handleUserSelect(user.user_id)}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedUserIds.includes(user.user_id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm">{getUserDisplayName(user)}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    // Country field
    if (targetField.type === 'country') {
      const selectedCountry = countries.find(c => c.code === value || c.name === value);

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={countriesLoading}
            >
              {selectedCountry ? (
                <div className="flex items-center gap-2">
                  <span className="text-base">{selectedCountry.flag}</span>
                  <span>{selectedCountry.name}</span>
                </div>
              ) : countriesLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading countries...</span>
                </div>
              ) : (
                <span>Select country...</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search countries..." />
              <CommandList>
                <CommandEmpty>
                  {countriesLoading ? "Loading countries..." : "No countries found."}
                </CommandEmpty>
                <CommandGroup>
                  {Array.isArray(countries) && countries.length > 0 ? countries.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={country.name}
                      onSelect={() => {
                        onChange(country.code);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === country.code || value === country.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-base">{country.flag}</span>
                      <span>{country.name}</span>
                    </CommandItem>
                  )) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      {countriesLoading ? 'Loading countries...' : 'No countries available'}
                    </div>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }

    // Select/Radio fields (single selection)
    if (['select', 'radio'].includes(targetField.type) && targetField.options) {
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {Array.isArray(targetField.options) ? targetField.options.filter((option: any) => option.value && option.value.trim() !== '').map((option: any) => (
              <SelectItem key={option.id || option.value} value={option.value}>
                {option.label || option.value}
              </SelectItem>
            )) : null}
          </SelectContent>
        </Select>
      );
    }

    // Multi-select field (multiple selection with checkboxes)
    if (targetField.type === 'multi-select' && targetField.options) {
      const currentValues = Array.isArray(value) ? value : [];
      const handleOptionToggle = (optionValue: string) => {
        const newValues = currentValues.includes(optionValue)
          ? currentValues.filter(v => v !== optionValue)
          : [...currentValues, optionValue];
        onChange(newValues);
      };

      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select multiple values:</Label>
          <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
            {Array.isArray(targetField.options) ? targetField.options.filter((option: any) => option.value && option.value.trim() !== '').map((option: any) => (
              <div key={option.id || option.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={currentValues.includes(option.value)}
                  onCheckedChange={() => handleOptionToggle(option.value)}
                />
                <Label className="text-sm cursor-pointer flex-1">
                  {option.label || option.value}
                </Label>
              </div>
            )) : null}
          </div>
          {currentValues.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Selected: {currentValues.join(', ')}
            </div>
          )}
        </div>
      );
    }

    // Email field
    if (targetField.type === 'email') {
      return (
        <Input
          type="email"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter email address"
        />
      );
    }

    // Number field
    if (targetField.type === 'number') {
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter number"
        />
      );
    }

    // Date field
    if (targetField.type === 'date') {
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // Time field
    if (targetField.type === 'time') {
      return (
        <Input
          type="time"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // DateTime field
    if (targetField.type === 'datetime') {
      return (
        <Input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // Checkbox field
    if (targetField.type === 'checkbox') {
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={value === true || value === 'true'}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label className="text-sm">
            {value === true || value === 'true' ? 'Checked' : 'Unchecked'}
          </Label>
        </div>
      );
    }

    // Toggle Switch field
    if (targetField.type === 'toggle-switch') {
      return (
        <div className="flex items-center space-x-2">
          <Switch
            checked={value === true || value === 'true'}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label className="text-sm">
            {value === true || value === 'true' ? 'On' : 'Off'}
          </Label>
        </div>
      );
    }

    // Slider field
    if (targetField.type === 'slider') {
      const min = targetField.validation?.min || 0;
      const max = targetField.validation?.max || 100;
      return (
        <div className="space-y-2">
          <input
            type="range"
            min={min}
            max={max}
            value={value || min}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-sm text-center">Value: {value || min}</div>
        </div>
      );
    }

    // Rating field
    if (targetField.type === 'rating') {
      const config = targetField.customConfig as any || {};
      const maxRating = config.maxRating || 5;
      return (
        <div className="space-y-2">
          <Input
            type="number"
            min={1}
            max={maxRating}
            value={value || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={`Rating (1-${maxRating})`}
          />
        </div>
      );
    }

    // Tags field
    if (targetField.type === 'tags') {
      const tagsArray = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          <textarea
            className="w-full p-2 border rounded min-h-[60px] text-sm"
            value={tagsArray.join(', ')}
            onChange={(e) => {
              const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
              onChange(tags);
            }}
            placeholder="Enter tags separated by commas"
          />
          <p className="text-xs text-muted-foreground">Separate tags with commas</p>
        </div>
      );
    }

    // Currency field
    if (targetField.type === 'currency') {
      const currencyValue = typeof value === 'object' ? value : { amount: 0, currency: 'USD' };
      return (
        <div className="space-y-2">
          <Input
            type="number"
            step="0.01"
            value={currencyValue.amount || ''}
            onChange={(e) => onChange({ ...currencyValue, amount: Number(e.target.value) })}
            placeholder="Amount"
          />
          <Select
            value={currencyValue.currency || 'USD'}
            onValueChange={(currency) => onChange({ ...currencyValue, currency })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
              <SelectItem value="JPY">JPY (¥)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Phone field
    if (targetField.type === 'phone') {
      const phoneValue = typeof value === 'object' ? value : { number: value || '', countryCode: '+1' };
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Phone Number:</Label>
          <div className="flex space-x-2">
            <Select
              value={phoneValue.countryCode || '+1'}
              onValueChange={(countryCode) => onChange({ ...phoneValue, countryCode })}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+1">🇺🇸 +1</SelectItem>
                <SelectItem value="+44">🇬🇧 +44</SelectItem>
                <SelectItem value="+33">🇫🇷 +33</SelectItem>
                <SelectItem value="+49">🇩🇪 +49</SelectItem>
                <SelectItem value="+81">🇯🇵 +81</SelectItem>
                <SelectItem value="+86">🇨🇳 +86</SelectItem>
                <SelectItem value="+91">🇮🇳 +91</SelectItem>
                <SelectItem value="+61">🇦🇺 +61</SelectItem>
                <SelectItem value="+55">🇧🇷 +55</SelectItem>
                <SelectItem value="+7">🇷🇺 +7</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="tel"
              value={phoneValue.number || ''}
              onChange={(e) => onChange({ ...phoneValue, number: e.target.value })}
              placeholder="Phone number"
              className="flex-1"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Full number: {phoneValue.countryCode}{phoneValue.number}
          </div>
        </div>
      );
    }

    // Address field
if (targetField.type === 'address') {
  const addressValue = typeof value === 'object' ? value : {};
  const safeCountries = Array.isArray(countries) ? countries : [];
  const selectedCountry = safeCountries.find(
    (country) => country.code === addressValue.country
  );

  return (
    <div className="space-y-2">
      <Input
        value={addressValue.street || ''}
        onChange={(e) => onChange({ ...addressValue, street: e.target.value })}
        placeholder="Street Address"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={addressValue.city || ''}
          onChange={(e) => onChange({ ...addressValue, city: e.target.value })}
          placeholder="City"
        />
        <Input
          value={addressValue.state || ''}
          onChange={(e) => onChange({ ...addressValue, state: e.target.value })}
          placeholder="State"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={addressValue.postal || ''}
          onChange={(e) => onChange({ ...addressValue, postal: e.target.value })}
          placeholder="Postal Code"
        />
        <Popover open={isCountryOpen} onOpenChange={setIsCountryOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isCountryOpen}
              className="justify-between"
            >
              {selectedCountry ? selectedCountry.name : "Select country..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
            <div className="max-h-60 overflow-auto">
              {safeCountries.length > 0 ? (
                safeCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    className={`w-full px-3 py-2 text-left hover:bg-accent/40 ${
                      selectedCountry?.code === country.code ? "bg-accent/20" : ""
                    }`}
                    onClick={() => {
                      onChange({ ...addressValue, country: country.code });
                      setIsCountryOpen(false);
                    }}
                  >
                    <span className="text-sm">{country.name}</span>
                  </button>
                ))
              ) : (
                <div className="p-2 text-sm text-muted-foreground">
                  {countriesLoading ? "Loading countries..." : "No countries available"}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}


    // Signature field
    if (targetField.type === 'signature') {
      return (
        <div className="space-y-2">
          <div className="p-4 border-2 border-dashed border-muted-foreground/25 rounded-md text-center">
            <p className="text-sm text-muted-foreground">
              Signature fields cannot have default values in rules.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Signatures must be created by users during form submission.
            </p>
          </div>
        </div>
      );
    }

    // Barcode field
    if (targetField.type === 'barcode') {
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter barcode value"
        />
      );
    }

    // File field
    if (targetField.type === 'file') {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Default File Message:</Label>
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter message about default file (e.g., 'Default template.pdf')"
          />
          <div className="flex items-center space-x-2 p-3 border-2 border-dashed border-muted-foreground/25 rounded-md">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              File upload defaults cannot be set through rules. Users must upload files during form submission.
            </span>
          </div>
        </div>
      );
    }

    // Submission access field
    if (targetField.type === 'submission-access') {
      return <SubmissionAccessInput targetField={targetField} value={value} onChange={onChange} />;
    }
  }

  // Default input for other actions
  return (
    <Input
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        action === 'changeLabel' ? 'New label text' :
        action === 'setDefault' ? 'Default value' :
        action === 'showTooltip' ? 'Tooltip text' :
        action === 'showError' ? 'Error message' :
        'Enter action value'
      }
    />
  );
}