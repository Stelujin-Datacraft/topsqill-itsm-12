import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Calendar, DollarSign, Clock, Link as LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect,useState } from 'react';
import  axios  from 'axios';

interface FormDataCellProps {
  value: any;
  fieldType: string;
  field: any;
}

export function FormDataCell({ value, fieldType, field }: FormDataCellProps) {

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
  // Normalize value into an array of files
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
  } else if (value.url) {
    files.push({ name: value.name || value.url.split('/').pop() || 'file', url: value.url });
  }

  if (files.length === 0) {
    return <span className="text-sm text-muted-foreground">File attached</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {files.map((f, index) => (
        <div key={index} className="flex gap-2 items-center">
          {/* View Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(f.url, '_blank')}
            className="h-8"
          >
            <Eye className="h-3 w-3 mr-1" /> View
          </Button>

          {/* Download Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const link = document.createElement('a');
              link.href = f.url;
              link.download = f.name;
              link.click();
            }}
            className="h-8"
          >
            Download
          </Button>
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