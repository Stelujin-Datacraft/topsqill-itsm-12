import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, Search, X } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { FormField } from '@/types/form';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface AIQueryInputProps {
  formFields: FormField[];
  onApplyQuery: (result: {
    filters: Array<{
      fieldId: string;
      operator: string;
      value: string;
    }>;
    sortBy: string | null;
    sortOrder: 'asc' | 'desc';
    interpretation: string;
  }) => void;
  onClearQuery: () => void;
}

export function AIQueryInput({
  formFields,
  onApplyQuery,
  onClearQuery
}: AIQueryInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeInterpretation, setActiveInterpretation] = useState<string | null>(null);
  const { naturalLanguageQuery, isLoading } = useFormAI();

  const handleQuery = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    const result = await naturalLanguageQuery(formFields, query);

    if (result) {
      setActiveInterpretation(result.interpretation);
      onApplyQuery(result);
      toast.success('AI query applied', {
        description: result.interpretation
      });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setActiveInterpretation(null);
    setQuery('');
    onClearQuery();
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            type="button"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            AI Search
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm mb-1">Natural Language Search</h4>
              <p className="text-xs text-muted-foreground">
                Describe what you're looking for in plain English
              </p>
            </div>
            <Input
              placeholder="e.g., Show high priority tickets from last week"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleQuery();
                }
              }}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Example queries:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>"Find all pending requests"</li>
                <li>"Show records created today"</li>
                <li>"Filter by status equals approved"</li>
                <li>"Sort by date descending"</li>
              </ul>
            </div>
            <Button
              onClick={handleQuery}
              disabled={isLoading || !query.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search with AI
                </>
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {activeInterpretation && (
        <Badge variant="secondary" className="flex items-center gap-1 text-xs max-w-xs truncate">
          <Sparkles className="h-3 w-3" />
          <span className="truncate">{activeInterpretation}</span>
          <button
            onClick={handleClear}
            className="ml-1 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
