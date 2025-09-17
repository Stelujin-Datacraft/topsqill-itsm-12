import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Calendar, DollarSign, Clock, Link as LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect,useState } from 'react';
import  axios  from 'axios';
import { useUsersAndGroups } from '@/hooks/useUsersAndGroups';

interface FormDataCellProps {
  value: any;
  fieldType: string;
  field: any;
}

export function FormDataCell({ value, fieldType, field }: FormDataCellProps) {
  const { getUserDisplayName, getGroupDisplayName } = useUsersAndGroups();

  function countryCodeToEmoji(code: string) {
    if (!code) return "";
    return code
      .toUpperCase()
      .replace(/./g, char =>
        String.fromCodePoint(127397 + char.charCodeAt(0))
      );
  }
  
  interface Country {
    code: string;
    name: string;
    flag: string;
  }
  
  const useCountries=()=> {
    const [countries, setCountries] = useState<Country[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      const fetchCountries = async () => {
        try {
          const response = await axios.get(
            "https://restcountries.com/v3.1/all?fields=name,cca2"
          );
          const data = response.data.map((country: any) => ({
            code: country.cca2,
            name: country.name?.common || "",
          }));
          // sort alphabetically
          data.sort((a: Country, b: Country) =>
            a.name.localeCompare(b.name)
          );
          setCountries(data);
          setError(null);
        } catch (err) {
          console.error("Error fetching countries:", err);
          setError("Failed to fetch countries");
        } finally {
          setLoading(false);
        }
      };
      fetchCountries();
    }, []);
  
    return { countries, loading, error };
  }
  
  // 👇 Top of InlineEditDialog component
  const { countries, loading: countriesLoading, error: countriesError } = useCountries();
  
  
  const navigate = useNavigate();

  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    return (
      <Badge variant="outline" className="italic opacity-70 text-muted-foreground/80 bg-muted/50">N/A</Badge>
    );
  }



const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AQ', name: 'Antarctica' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BV', name: 'Bouvet Island' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo, Democratic Republic' },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: 'Côte d\'Ivoire' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FK', name: 'Falkland Islands' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GF', name: 'French Guiana' },
  { code: 'PF', name: 'French Polynesia' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GR', name: 'Greece' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'North Korea' },
  { code: 'KR', name: 'South Korea' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macao' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NC', name: 'New Caledonia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'NF', name: 'Norfolk Island' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PN', name: 'Pitcairn' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RE', name: 'Réunion' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'BL', name: 'Saint Barthélemy' },
  { code: 'SH', name: 'Saint Helena' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'MF', name: 'Saint Martin' },
  { code: 'PM', name: 'Saint Pierre and Miquelon' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'São Tomé and Príncipe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SX', name: 'Sint Maarten' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TC', name: 'Turks and Caicos Islands' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'VG', name: 'British Virgin Islands' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'WF', name: 'Wallis and Futuna' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];
  if (fieldType === "address" && typeof value === "object" && value !== null) {
  const { street, city, state, postal, country } = value;

  // Find country name from your COUNTRIES array
  const selectedCountry = COUNTRIES.find(c => c.code === country);

  const displayAddress = [
    street,
    city,
    state,
    postal,
    selectedCountry ? selectedCountry.name : country
  ]
    .filter(Boolean) // remove empty values
    .join(", ");

  if (!displayAddress) {
    return (
      <Badge variant="outline" className="italic opacity-70">
        No address provided
      </Badge>
    );
  }

  return (
    <div className="max-w-[350px] truncate" title={displayAddress}>
      {displayAddress}
    </div>
  );
}


  // Handle cross-reference fields  
  if (fieldType === 'cross-reference') {
    let submissionRefIds: string[] = [];
    
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        submissionRefIds = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        submissionRefIds = [value];
      }
    } else if (Array.isArray(value)) {
      // Extract submission_ref_id from objects if they exist
      submissionRefIds = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return item.submission_ref_id || item.record_id || item.id || String(item);
        }
        return String(item);
      });
    } else if (value && typeof value === 'object') {
      // Handle single object with submission_ref_id
      submissionRefIds = [value.submission_ref_id || value.record_id || value.id || String(value)];
    } else if (value) {
      // Handle any other non-null value by converting to array
      submissionRefIds = [String(value)];
    }
    
    // Ensure submissionRefIds is always an array and filter out invalid entries
    if (!Array.isArray(submissionRefIds)) {
      submissionRefIds = [];
    }
    
    // Filter out empty, null, undefined, or [object Object] strings
    submissionRefIds = submissionRefIds.filter(id => 
      id && 
      String(id).trim() !== '' && 
      String(id) !== '[object Object]' &&
      String(id) !== 'undefined' &&
      String(id) !== 'null'
    );
    
    if (submissionRefIds.length === 0) {
      return <Badge variant="outline" className="italic opacity-70">No references</Badge>;
    }
    
    return (
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer hover:bg-accent text-left justify-start h-auto py-1 px-2"
        onClick={() => {
          console.log('Cross-reference button clicked', { submissionRefIds, field });
          // Trigger dialog with all IDs for this specific field
          const dynamicTable = document.querySelector('[data-dynamic-table="main"]');
          console.log('Dynamic table element found:', dynamicTable);
          if (dynamicTable) {
            const event = new CustomEvent('showCrossReference', { 
              detail: { 
                submissionIds: submissionRefIds,
                fieldName: field?.label || 'Cross Reference'
              } 
            });
            console.log('Dispatching event with data:', event.detail);
            dynamicTable.dispatchEvent(event);
          } else {
            console.error('Dynamic table element not found');
          }
        }}
      >
        <div className="text-sm">
          <span className="text-primary font-medium">View ({submissionRefIds.length})</span>
        </div>
      </Button>
    );
  }

  // Handle approval fields
  if (fieldType === 'approval' && typeof value === 'object') {
    const status = value?.status || 'pending';
    const variant = status === 'approved' ? 'default' : 
                   status === 'rejected' ? 'destructive' : 'secondary';
    
    return (
      <div className="space-y-1">
        <Badge variant={variant}>{status}</Badge>
        {value?.timestamp && (
          <div className="text-xs text-muted-foreground">
            {new Date(value.timestamp).toLocaleDateString()}
          </div>
        )}
      </div>
    );
  }

  // Handle date fields
  if ((fieldType === 'date' || fieldType === 'datetime') && value) {
    try {
      const date = new Date(value);
      return (
        <div className="flex items-center space-x-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">
            {fieldType === 'datetime' 
              ? date.toLocaleString()
              : date.toLocaleDateString()
            }
          </span>
        </div>
      );
    } catch {
      return <span className="text-sm">{value.toString()}</span>;
    }
  }

  // Handle time fields
  if (fieldType === 'time' && value) {
    return (
      <div className="flex items-center space-x-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm">{value}</span>
      </div>
    );
  }

  // Handle currency fields
if (fieldType === 'currency' && value) {
  let parsed: { currency: string; amount: number | string } = { currency: '', amount: 0 };

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = { currency: '', amount: value };
    }
  } else if (typeof value === 'object') {
    parsed = { currency: value.currency || '', amount: value.amount || value.value || 0 };
  }

  const { currency, amount } = parsed;

  // Only format currency if a valid ISO code is present
  const formatted = currency
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount))
    : amount; // fallback: show just the number if currency invalid

  return (
    <div className="flex items-center space-x-1">
      <span className="text-sm font-medium">{formatted}</span>
    </div>
  );
}


  // Handle currency fields
  if (fieldType === 'currency' && typeof value === 'object') {
    const amount = value?.amount || value?.value || 0;
    const currency = value?.currency || 'USD';
    
    return (
      <div className="flex items-center space-x-1">
        <DollarSign className="h-3 w-3 text-success" />
        <span className="text-sm font-medium">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
          }).format(amount)}
        </span>
      </div>
    );
  }

  // Handle simple currency (just number)
  if (fieldType === 'currency' && typeof value === 'number') {
    return (
      <div className="flex items-center space-x-1">
        <DollarSign className="h-3 w-3 text-success" />
        <span className="text-sm font-medium">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(value)}
        </span>
      </div>
    );
  }

  // Handle phone fields
if (fieldType === 'phone' && value) {
  let parsed: { code: string; number: string } = { code: '+1', number: '' };

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = { code: '+1', number: value };
    }
  } else if (typeof value === 'object') {
    parsed = { code: value.code || '+1', number: value.number || '' };
  }

  const { code, number } = parsed;

  return (
    <a href={`tel:${code}${number}`} className="text-sm text-primary hover:underline">
      {code} {number}
    </a>
  );
}


  // Handle select/dropdown fields
  if (['select', 'radio'].includes(fieldType) && field?.options && Array.isArray(field.options)) {
    const selectedOption = field.options.find((opt: any) => opt.value === value);
    const displayValue = selectedOption?.label || value;
    
    return (
      <Badge variant="secondary" className="text-xs bg-secondary/80 text-secondary-foreground font-medium">
        {displayValue}
      </Badge>
    );
  }

  // Handle single or bulk checkbox
if (fieldType === 'checkbox') {
  if (Array.isArray(value)) {
    // Multiple checkboxes (bulk) - show True/False for each
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, index) => (
          <Badge
            key={index}
            variant={v ? 'default' : 'secondary'}
            className="text-xs"
          >
            {v ? 'True' : 'False'}
          </Badge>
        ))}
      </div>
    );
  }

  // Single checkbox
  return (
    <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
      {value ? 'True' : 'False'}
    </Badge>
  );
}



  // Handle multi-select fields
  if (['multi-select'].includes(fieldType)) {
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((item, index) => {
            const selectedOption = field?.options && Array.isArray(field.options) 
              ? field.options.find((opt: any) => opt.value === item)
              : null;
            const displayValue = selectedOption?.label || item;
            return (
              <Badge key={index} variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/30">
                {displayValue}
              </Badge>
            );
          })}
        </div>
      );
    }
    return <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">{value}</Badge>;
  }

  // Handle URL fields
  if (fieldType === 'url' && value) {
    return (
      <Badge
        variant="outline"
        className="cursor-pointer hover:opacity-90 border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
        onClick={() => window.open(value, '_blank')}
        title={value}
      >
        <LinkIcon className="h-3 w-3 mr-1" />
        <span className="text-xs">Open</span>
      </Badge>
    );
  }

  // Handle email fields
  if (fieldType === 'email' && value) {
    return (
      <Badge
        variant="outline"
        className="cursor-pointer hover:opacity-90 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
        onClick={() => (window.location.href = `mailto:${value}`)}
        title={`Email ${value}`}
      >
        {value}
      </Badge>
    );
  }

  // Handle phone fields
  if (fieldType === 'phone' && value) {
    return (
      <a 
        href={`tel:${value}`}
        className="text-sm text-primary hover:underline"
      >
        {value}
      </a>
    );
  }

  // Handle country fields
if (fieldType === 'country' && value) {
  // Map code to full name
  const countryObj = countries.find((c: any) => c.code === value);

  if (!countryObj) {
    return <Badge variant="outline" className="text-xs">N/A</Badge>;
  }

  return (
    <span className="text-sm flex items-center gap-1">
      {countryCodeToEmoji(countryObj.code)} {countryObj.name}
    </span>
  );
}


  // Handle boolean fields (toggle-switch, checkbox)
  if (['toggle-switch'].includes(fieldType) && typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'default' : 'secondary'}>
        {value ? 'Yes' : 'No'}
      </Badge>
    );
  }

  // Handle rating fields
  if (fieldType === 'rating' && typeof value === 'number') {
    const maxRating = field?.customConfig?.ratingScale || 5;
    return (
      <div className="flex items-center space-x-1">
        <span className="text-sm font-medium">{value}</span>
        <span className="text-xs text-muted-foreground">/ {maxRating}</span>
      </div>
    );
  }

  // Handle file/image fields
  // if (['file', 'image'].includes(fieldType) && value) {
  //   if (typeof value === 'string' && value.startsWith('http')) {
  //     return (
  //       <Button
  //         variant="outline"
  //         size="sm"
  //         onClick={() => window.open(value, '_blank')}
  //         className="h-8"
  //       >
  //         <Eye className="h-3 w-3 mr-1" />
  //         View
  //       </Button>
  //     );
  //   }
  //   return <span className="text-sm text-muted-foreground">File attached</span>;
  // }

  // Handle file/image fields
if (['file', 'image'].includes(fieldType) && value) {
  // Normalize into array of files
  const files: { name: string; url: string }[] = [];

  if (typeof value === 'string' && value.startsWith('http')) {
    files.push({ name: value.split('/').pop() || 'file', url: value });
  } else if (Array.isArray(value)) {
    value.forEach((f: any) => {
      if (typeof f === 'string' && f.startsWith('http')) {
        files.push({ name: f.split('/').pop() || 'file', url: f });
      } else if (f?.url) {
        files.push({ name: f.name || f.url.split('/').pop() || 'file', url: f.url });
      }
    });
  } else if (value?.url) {
    files.push({ name: value.name || value.url.split('/').pop() || 'file', url: value.url });
  }

  if (files.length === 0) {
    return <span className="italic text-muted-foreground">No file</span>;
  }

  return (
    <div className="flex flex-col gap-1 max-w-[250px]">
      {files.map((f, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-2 border rounded px-2 py-1 bg-muted/40"
        >
          {/* File name */}
          <span className="text-sm truncate flex-1">{f.name}</span>

          {/* Actions */}
          <div className="flex gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(f.url, '_blank')}
              className="h-7 px-2"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = f.url;
                link.download = f.name;
                link.click();
              }}
              className="h-7 px-2"
            >
              Download
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}



  // Handle non-input fields (headers, descriptions, etc.)
  if (['header', 'description', 'section-break', 'horizontal-line'].includes(fieldType)) {
    return (
      <Badge variant="outline" className="italic opacity-70 text-muted-foreground/80 bg-muted/50">N/A</Badge>
    );
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return <span className="text-sm">{value.join(', ')}</span>;
  }

  // Handle submission-access fields
  if (fieldType === 'submission-access' && typeof value === 'object' && value !== null) {
    const { users = [], groups = [] } = value;
    const displayItems = [];

    // Add user names with proper display
    if (Array.isArray(users) && users.length > 0) {
      users.forEach(userId => {
        displayItems.push({
          type: 'user',
          id: userId,
          display: getUserDisplayName(userId)
        });
      });
    }

    // Add group names with proper display
    if (Array.isArray(groups) && groups.length > 0) {
      groups.forEach(groupId => {
        displayItems.push({
          type: 'group',
          id: groupId,
          display: getGroupDisplayName(groupId)
        });
      });
    }

    if (displayItems.length === 0) {
      return <Badge  className="italic opacity-70">No access assigned</Badge>;
    }

    return (
      <div className="flex flex-col gap-1 max-w-[270px]">
        {displayItems.map((item, index) => (
          <Badge 
            key={`${item.type}-${item.id}-${index}`} 
            variant={item.type === 'user' ? 'outline' : 'secondary'}
            className={`text-xs max-w-full truncate ${item.type === 'user' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
            title={item.display}
          >
            {item.display}
          </Badge>
        ))}
      </div>
    );
  }
if (fieldType === 'user-picker') {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <Badge variant="outline" className="italic opacity-70">No users selected</Badge>;
    }

    return (
      <div className="flex flex-col gap-1 max-w-[270px]">
      {value.map((user, index) => {
  const userId = typeof user === "string" ? user : user.id;
  return (
<Badge
  key={`user-${userId}-${index}`}
  variant="outline"
  className="bg-blue-100 text-blue-800 text-xs max-w-full truncate"
  title={typeof getUserDisplayName(userId) === "string" ? getUserDisplayName(userId) as string : ""}
>
  {getUserDisplayName(userId)}
</Badge>

  );
})}

      </div>
    );
  } else if (value) {
    const userId = typeof value === "string" ? value : value.id;
    return (
      <Badge 
        variant="default" 
        className="bg-blue-100 text-blue-800 text-xs max-w-[200px] truncate"
        title={getUserDisplayName(userId)}
      >
        {getUserDisplayName(userId)}
      </Badge>
    );
  } else {
    return <Badge variant="outline" className="italic opacity-70">No user selected</Badge>;
  }
}


  // Handle objects
  if (typeof value === 'object') {
    // Try to extract meaningful information
    if (value.status) return value.status;
    if (value.value) return value.value;
    if (value.name) return value.name;
    return JSON.stringify(value);
  }

  // Default case - display as string
  return <span className="text-sm">{value.toString()}</span>;
}