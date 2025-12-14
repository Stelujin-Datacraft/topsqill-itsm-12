import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Trash2, Plus, Filter } from 'lucide-react';
import { FormField } from '@/types/form';

interface FilterConfigProps {
  formFields: FormField[];
  filters: Array<{
    field: string;
    operator: string;
    value: string;
    label?: string;
  }>;
  onFiltersChange: (filters: Array<{ field: string; operator: string; value: string; label?: string }>) => void;
}

const FILTER_OPERATORS = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_equal', label: 'Greater or equal' },
    { value: 'less_equal', label: 'Less or equal' },
    { value: 'between', label: 'Between' },
    { value: 'not_equals', label: 'Not equals' }
  ],
  date: [
    { value: 'equals', label: 'On date' },
    { value: 'after', label: 'After' },
    { value: 'before', label: 'Before' },
    { value: 'between', label: 'Between dates' },
    { value: 'last_days', label: 'Last N days' },
    { value: 'next_days', label: 'Next N days' }
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'in', label: 'In list' },
    { value: 'not_in', label: 'Not in list' }
  ],
  boolean: [
    { value: 'equals', label: 'Is' },
    { value: 'not_equals', label: 'Is not' }
  ]
};

export function FilterConfig({ formFields, filters, onFiltersChange }: FilterConfigProps) {
  const addFilter = () => {
    onFiltersChange([
      ...filters,
      { field: '', operator: 'equals', value: '' }
    ]);
  };

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<typeof filters[0]>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onFiltersChange(newFilters);
  };

  const getFieldType = (fieldId: string): keyof typeof FILTER_OPERATORS => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field) return 'text';
    
    // Support both .type and .field_type for compatibility
    const fieldType = (field as any)?.field_type || field?.type || '';
    
    switch (fieldType) {
      case 'number':
      case 'currency':
      case 'rating':
      case 'slider':
        return 'number';
      case 'date':
      case 'datetime':
      case 'time':
        return 'date';
      case 'select':
      case 'radio':
      case 'multi-select':
      case 'dropdown':
      case 'status':
        return 'select';
      case 'checkbox':
      case 'toggle-switch':
      case 'toggle':
      case 'yes-no':
        return 'boolean';
      default:
        return 'text';
    }
  };

  const getOperatorsForField = (fieldId: string) => {
    const fieldType = getFieldType(fieldId);
    return FILTER_OPERATORS[fieldType] || FILTER_OPERATORS.text;
  };

  const renderValueInput = (filter: typeof filters[0], index: number) => {
    const field = formFields.find(f => f.id === filter.field);
    // Support both .type and .field_type
    const rawFieldType = (field as any)?.field_type || field?.type || '';
    const fieldTypeCategory = getFieldType(filter.field);

    if (filter.operator === 'is_empty' || filter.operator === 'is_not_empty') {
      return null;
    }

    // Get field options - support field.options, custom_config.options, and customConfig.options
    const getFieldOptions = () => {
      if (field?.options && Array.isArray(field.options) && field.options.length > 0) {
        return field.options;
      }
      const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
      if (customConfig?.options && Array.isArray(customConfig.options)) {
        return customConfig.options;
      }
      return [];
    };

    const fieldOptions = getFieldOptions();

    // Handle rating field type - show star options
    if (rawFieldType === 'rating' || rawFieldType === 'star-rating') {
      const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
      const maxRating = customConfig?.maxRating || (field as any)?.validation?.max || 5;
      const ratingOptions = Array.from({ length: maxRating }, (_, i) => i + 1);
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select rating" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {ratingOptions.map((rating) => (
                <SelectItem key={rating} value={String(rating)}>
                  {'★'.repeat(rating)} ({rating})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle slider/range field type - show min/max range input
    if (rawFieldType === 'slider' || rawFieldType === 'range') {
      const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
      const min = (field as any)?.validation?.min || customConfig?.min || 0;
      const max = (field as any)?.validation?.max || customConfig?.max || 100;
      const step = (field as any)?.validation?.step || customConfig?.step || 1;
      
      // Generate options based on min/max/step
      const sliderOptions: number[] = [];
      for (let val = min; val <= max; val += step) {
        sliderOptions.push(val);
        if (sliderOptions.length > 50) break; // Limit options
      }
      
      return (
        <div className="space-y-2">
          <Label>Value ({min} - {max})</Label>
          {sliderOptions.length <= 20 ? (
            <Select
              value={filter.value}
              onValueChange={(value) => updateFilter(index, { value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {sliderOptions.map((val) => (
                  <SelectItem key={val} value={String(val)}>
                    {val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="number"
              min={min}
              max={max}
              step={step}
              value={filter.value}
              onChange={(e) => updateFilter(index, { value: e.target.value })}
              placeholder={`${min} - ${max}`}
            />
          )}
        </div>
      );
    }

    // Handle yes-no field type
    if (rawFieldType === 'yes-no') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle toggle/switch field type
    if (rawFieldType === 'toggle' || rawFieldType === 'toggle-switch') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="true">On</SelectItem>
              <SelectItem value="false">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle checkbox field type (standalone, not checkbox group with options)
    if (rawFieldType === 'checkbox' && fieldOptions.length === 0) {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="true">Checked</SelectItem>
              <SelectItem value="false">Unchecked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle time field type
    if (rawFieldType === 'time') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="time"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Select time"
          />
        </div>
      );
    }

    // Handle datetime field type
    if (rawFieldType === 'datetime' || rawFieldType === 'date-time') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="datetime-local"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Select date and time"
          />
        </div>
      );
    }

    // Handle tags field type - text input for tag values
    if (rawFieldType === 'tags') {
      return (
        <div className="space-y-2">
          <Label>Value (tag to filter)</Label>
          <Input
            type="text"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Enter tag value"
          />
        </div>
      );
    }

    // Handle country field type
    if (rawFieldType === 'country') {
      const countries = [
        { code: 'AF', name: 'Afghanistan' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
        { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' }, { code: 'AR', name: 'Argentina' },
        { code: 'AM', name: 'Armenia' }, { code: 'AU', name: 'Australia' }, { code: 'AT', name: 'Austria' },
        { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' }, { code: 'BH', name: 'Bahrain' },
        { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' }, { code: 'BY', name: 'Belarus' },
        { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' }, { code: 'BJ', name: 'Benin' },
        { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' }, { code: 'BA', name: 'Bosnia and Herzegovina' },
        { code: 'BW', name: 'Botswana' }, { code: 'BR', name: 'Brazil' }, { code: 'BN', name: 'Brunei' },
        { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' }, { code: 'BI', name: 'Burundi' },
        { code: 'KH', name: 'Cambodia' }, { code: 'CM', name: 'Cameroon' }, { code: 'CA', name: 'Canada' },
        { code: 'CV', name: 'Cape Verde' }, { code: 'CF', name: 'Central African Republic' }, { code: 'TD', name: 'Chad' },
        { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' }, { code: 'CO', name: 'Colombia' },
        { code: 'KM', name: 'Comoros' }, { code: 'CG', name: 'Congo' }, { code: 'CR', name: 'Costa Rica' },
        { code: 'HR', name: 'Croatia' }, { code: 'CU', name: 'Cuba' }, { code: 'CY', name: 'Cyprus' },
        { code: 'CZ', name: 'Czech Republic' }, { code: 'DK', name: 'Denmark' }, { code: 'DJ', name: 'Djibouti' },
        { code: 'DM', name: 'Dominica' }, { code: 'DO', name: 'Dominican Republic' }, { code: 'EC', name: 'Ecuador' },
        { code: 'EG', name: 'Egypt' }, { code: 'SV', name: 'El Salvador' }, { code: 'GQ', name: 'Equatorial Guinea' },
        { code: 'ER', name: 'Eritrea' }, { code: 'EE', name: 'Estonia' }, { code: 'ET', name: 'Ethiopia' },
        { code: 'FJ', name: 'Fiji' }, { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' },
        { code: 'GA', name: 'Gabon' }, { code: 'GM', name: 'Gambia' }, { code: 'GE', name: 'Georgia' },
        { code: 'DE', name: 'Germany' }, { code: 'GH', name: 'Ghana' }, { code: 'GR', name: 'Greece' },
        { code: 'GD', name: 'Grenada' }, { code: 'GT', name: 'Guatemala' }, { code: 'GN', name: 'Guinea' },
        { code: 'GW', name: 'Guinea-Bissau' }, { code: 'GY', name: 'Guyana' }, { code: 'HT', name: 'Haiti' },
        { code: 'HN', name: 'Honduras' }, { code: 'HU', name: 'Hungary' }, { code: 'IS', name: 'Iceland' },
        { code: 'IN', name: 'India' }, { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran' },
        { code: 'IQ', name: 'Iraq' }, { code: 'IE', name: 'Ireland' }, { code: 'IL', name: 'Israel' },
        { code: 'IT', name: 'Italy' }, { code: 'JM', name: 'Jamaica' }, { code: 'JP', name: 'Japan' },
        { code: 'JO', name: 'Jordan' }, { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' },
        { code: 'KI', name: 'Kiribati' }, { code: 'KP', name: 'North Korea' }, { code: 'KR', name: 'South Korea' },
        { code: 'KW', name: 'Kuwait' }, { code: 'KG', name: 'Kyrgyzstan' }, { code: 'LA', name: 'Laos' },
        { code: 'LV', name: 'Latvia' }, { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' },
        { code: 'LR', name: 'Liberia' }, { code: 'LY', name: 'Libya' }, { code: 'LI', name: 'Liechtenstein' },
        { code: 'LT', name: 'Lithuania' }, { code: 'LU', name: 'Luxembourg' }, { code: 'MK', name: 'North Macedonia' },
        { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' }, { code: 'MY', name: 'Malaysia' },
        { code: 'MV', name: 'Maldives' }, { code: 'ML', name: 'Mali' }, { code: 'MT', name: 'Malta' },
        { code: 'MH', name: 'Marshall Islands' }, { code: 'MR', name: 'Mauritania' }, { code: 'MU', name: 'Mauritius' },
        { code: 'MX', name: 'Mexico' }, { code: 'FM', name: 'Micronesia' }, { code: 'MD', name: 'Moldova' },
        { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' }, { code: 'ME', name: 'Montenegro' },
        { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' }, { code: 'MM', name: 'Myanmar' },
        { code: 'NA', name: 'Namibia' }, { code: 'NR', name: 'Nauru' }, { code: 'NP', name: 'Nepal' },
        { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' }, { code: 'NI', name: 'Nicaragua' },
        { code: 'NE', name: 'Niger' }, { code: 'NG', name: 'Nigeria' }, { code: 'NO', name: 'Norway' },
        { code: 'OM', name: 'Oman' }, { code: 'PK', name: 'Pakistan' }, { code: 'PW', name: 'Palau' },
        { code: 'PS', name: 'Palestine' }, { code: 'PA', name: 'Panama' }, { code: 'PG', name: 'Papua New Guinea' },
        { code: 'PY', name: 'Paraguay' }, { code: 'PE', name: 'Peru' }, { code: 'PH', name: 'Philippines' },
        { code: 'PL', name: 'Poland' }, { code: 'PT', name: 'Portugal' }, { code: 'QA', name: 'Qatar' },
        { code: 'RO', name: 'Romania' }, { code: 'RU', name: 'Russia' }, { code: 'RW', name: 'Rwanda' },
        { code: 'KN', name: 'Saint Kitts and Nevis' }, { code: 'LC', name: 'Saint Lucia' },
        { code: 'VC', name: 'Saint Vincent and the Grenadines' }, { code: 'WS', name: 'Samoa' },
        { code: 'SM', name: 'San Marino' }, { code: 'ST', name: 'Sao Tome and Principe' },
        { code: 'SA', name: 'Saudi Arabia' }, { code: 'SN', name: 'Senegal' }, { code: 'RS', name: 'Serbia' },
        { code: 'SC', name: 'Seychelles' }, { code: 'SL', name: 'Sierra Leone' }, { code: 'SG', name: 'Singapore' },
        { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' }, { code: 'SB', name: 'Solomon Islands' },
        { code: 'SO', name: 'Somalia' }, { code: 'ZA', name: 'South Africa' }, { code: 'SS', name: 'South Sudan' },
        { code: 'ES', name: 'Spain' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'SD', name: 'Sudan' },
        { code: 'SR', name: 'Suriname' }, { code: 'SZ', name: 'Eswatini' }, { code: 'SE', name: 'Sweden' },
        { code: 'CH', name: 'Switzerland' }, { code: 'SY', name: 'Syria' }, { code: 'TW', name: 'Taiwan' },
        { code: 'TJ', name: 'Tajikistan' }, { code: 'TZ', name: 'Tanzania' }, { code: 'TH', name: 'Thailand' },
        { code: 'TL', name: 'Timor-Leste' }, { code: 'TG', name: 'Togo' }, { code: 'TO', name: 'Tonga' },
        { code: 'TT', name: 'Trinidad and Tobago' }, { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Turkey' },
        { code: 'TM', name: 'Turkmenistan' }, { code: 'TV', name: 'Tuvalu' }, { code: 'UG', name: 'Uganda' },
        { code: 'UA', name: 'Ukraine' }, { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' }, { code: 'UY', name: 'Uruguay' }, { code: 'UZ', name: 'Uzbekistan' },
        { code: 'VU', name: 'Vanuatu' }, { code: 'VA', name: 'Vatican City' }, { code: 'VE', name: 'Venezuela' },
        { code: 'VN', name: 'Vietnam' }, { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' },
        { code: 'ZW', name: 'Zimbabwe' }
      ];
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
              {countries.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle currency field type
    if (rawFieldType === 'currency') {
      const currencies = [
        { code: 'USD', name: 'US Dollar', symbol: '$' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
        { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
        { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
        { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
        { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
        { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
        { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
        { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
        { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
        { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
        { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
        { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
        { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
        { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
        { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
        { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
        { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
        { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
        { code: 'THB', name: 'Thai Baht', symbol: '฿' },
        { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
        { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
        { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
        { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
        { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
        { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
        { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
        { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
        { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
        { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
        { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
        { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
        { code: 'COP', name: 'Colombian Peso', symbol: '$' },
        { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
        { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
        { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
        { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' },
        { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' }
      ];
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
              {currencies.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.name} ({currency.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle phone field type - show country codes
    if (rawFieldType === 'phone' || rawFieldType === 'phone-number') {
      const phoneCodes = [
        { code: '+1', country: 'US/Canada' },
        { code: '+44', country: 'UK' },
        { code: '+91', country: 'India' },
        { code: '+86', country: 'China' },
        { code: '+81', country: 'Japan' },
        { code: '+49', country: 'Germany' },
        { code: '+33', country: 'France' },
        { code: '+39', country: 'Italy' },
        { code: '+34', country: 'Spain' },
        { code: '+7', country: 'Russia' },
        { code: '+55', country: 'Brazil' },
        { code: '+52', country: 'Mexico' },
        { code: '+61', country: 'Australia' },
        { code: '+82', country: 'South Korea' },
        { code: '+31', country: 'Netherlands' },
        { code: '+46', country: 'Sweden' },
        { code: '+41', country: 'Switzerland' },
        { code: '+48', country: 'Poland' },
        { code: '+32', country: 'Belgium' },
        { code: '+43', country: 'Austria' },
        { code: '+47', country: 'Norway' },
        { code: '+45', country: 'Denmark' },
        { code: '+358', country: 'Finland' },
        { code: '+353', country: 'Ireland' },
        { code: '+351', country: 'Portugal' },
        { code: '+30', country: 'Greece' },
        { code: '+90', country: 'Turkey' },
        { code: '+20', country: 'Egypt' },
        { code: '+27', country: 'South Africa' },
        { code: '+234', country: 'Nigeria' },
        { code: '+254', country: 'Kenya' },
        { code: '+62', country: 'Indonesia' },
        { code: '+60', country: 'Malaysia' },
        { code: '+65', country: 'Singapore' },
        { code: '+66', country: 'Thailand' },
        { code: '+84', country: 'Vietnam' },
        { code: '+63', country: 'Philippines' },
        { code: '+92', country: 'Pakistan' },
        { code: '+880', country: 'Bangladesh' },
        { code: '+94', country: 'Sri Lanka' },
        { code: '+971', country: 'UAE' },
        { code: '+966', country: 'Saudi Arabia' },
        { code: '+974', country: 'Qatar' },
        { code: '+965', country: 'Kuwait' },
        { code: '+973', country: 'Bahrain' },
        { code: '+968', country: 'Oman' },
        { code: '+972', country: 'Israel' },
        { code: '+962', country: 'Jordan' },
        { code: '+961', country: 'Lebanon' },
        { code: '+64', country: 'New Zealand' }
      ];
      return (
        <div className="space-y-2">
          <Label>Value (Country Code)</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country code" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
              {phoneCodes.map((phone) => (
                <SelectItem key={phone.code} value={phone.code}>
                  {phone.code} ({phone.country})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle submission-access field type - show configured users/groups
    if (rawFieldType === 'submission-access') {
      const customConfig = (field as any)?.custom_config || (field as any)?.customConfig;
      const allowedUsers = customConfig?.allowedUsers || [];
      const allowedGroups = customConfig?.allowedGroups || [];
      
      const accessOptions = [
        ...allowedUsers.map((user: any) => ({
          value: user.id || user.email || user,
          label: user.name || user.email || user.id || user,
          type: 'user'
        })),
        ...allowedGroups.map((group: any) => ({
          value: group.id || group.name || group,
          label: group.name || group.id || group,
          type: 'group'
        }))
      ];

      if (accessOptions.length > 0) {
        return (
          <div className="space-y-2">
            <Label>Value</Label>
            <Select
              value={filter.value}
              onValueChange={(value) => updateFilter(index, { value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user/group" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {accessOptions.map((option, optIndex) => (
                  <SelectItem key={optIndex} value={String(option.value)}>
                    {option.type === 'group' ? '👥 ' : '👤 '}{option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }
      
      // Fallback if no configured users/groups
      return (
        <div className="space-y-2">
          <Label>Value (user/group ID or email)</Label>
          <Input
            type="text"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Enter user/group ID or email"
          />
        </div>
      );
    }

    // Handle multi-select, dropdown, radio, select, checkbox (with options), status fields
    if ((rawFieldType === 'multi-select' || rawFieldType === 'dropdown' || 
         rawFieldType === 'radio' || rawFieldType === 'select' || 
         rawFieldType === 'status' || (rawFieldType === 'checkbox' && fieldOptions.length > 0)) && 
        fieldOptions.length > 0) {
      if (filter.operator === 'in' || filter.operator === 'not_in') {
        return (
          <div className="space-y-2">
            <Label>Values (comma-separated)</Label>
            <Input
              value={filter.value}
              onChange={(e) => updateFilter(index, { value: e.target.value })}
              placeholder="value1, value2, value3"
            />
          </div>
        );
      } else {
        return (
          <div className="space-y-2">
            <Label>Value</Label>
            <Select
              value={filter.value}
              onValueChange={(value) => updateFilter(index, { value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {fieldOptions
                  .filter((option: any) => {
                    const val = option.value || option;
                    return val && String(val).trim() !== '';
                  })
                  .map((option: any, optIndex: number) => {
                    const val = option.value || option;
                    const label = option.label || option.value || option;
                    return (
                      <SelectItem key={option.id || optIndex} value={String(val)}>
                        {label}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>
        );
      }
    }

    // Handle boolean field type (generic fallback)
    if (fieldTypeCategory === 'boolean') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Handle date field type
    if (rawFieldType === 'date') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="date"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Select date"
          />
        </div>
      );
    }

    // Handle number/currency field types
    if (rawFieldType === 'number' || rawFieldType === 'currency') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Input
            type="number"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Enter number"
          />
        </div>
      );
    }

    // Default text input
    return (
      <div className="space-y-2">
        <Label>Value</Label>
        <Input
          type="text"
          value={filter.value}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          placeholder="Enter filter value"
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {filters.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No filters configured. Add filters to refine your data.
          </div>
        ) : (
          <div className="space-y-4">
            {filters.map((filter, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Filter {index + 1}</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFilter(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Field</Label>
                      <Select
                        value={filter.field}
                        onValueChange={(value) => updateFilter(index, { 
                          field: value, 
                          operator: 'equals', 
                          value: '' 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {formFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Operator</Label>
                      <Select
                        value={filter.operator}
                        onValueChange={(value) => updateFilter(index, { 
                          operator: value, 
                          value: '' 
                        })}
                        disabled={!filter.field}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorsForField(filter.field).map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      {renderValueInput(filter, index)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Button
          onClick={addFilter}
          variant="outline"
          className="w-full"
          disabled={formFields.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </CardContent>
    </Card>
  );
}