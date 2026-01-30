import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface QueryExample {
  title: string;
  description: string;
  query: string;
}

const QUERY_EXAMPLES: QueryExample[] = [
  {
    title: 'Select All Fields (*)',
    description: 'Get all field values from a form',
    query: `SELECT *
FROM "550e8400-e29b-41d4-a716-446655440000"`
  },
  {
    title: 'Select Specific Fields',
    description: 'Choose fields using their UUIDs',
    query: `SELECT FIELD("a1b2c3d4-..."), FIELD("e5f6g7h8-...")
FROM "550e8400-e29b-41d4-a716-446655440000"`
  },
  {
    title: 'COUNT with GROUP BY',
    description: 'Count submissions grouped by field value',
    query: `SELECT FIELD("status-field-uuid"), COUNT(*) as total
FROM "550e8400-e29b-41d4-a716-446655440000"
GROUP BY FIELD("status-field-uuid")`
  },
  {
    title: 'Aggregations (SUM, AVG, MIN, MAX)',
    description: 'Calculate totals, averages, min/max',
    query: `SELECT FIELD("category-uuid"),
       SUM(FIELD("amount-uuid")) as total,
       AVG(FIELD("amount-uuid")) as avg
FROM "550e8400-e29b-41d4-a716-446655440000"
GROUP BY FIELD("category-uuid")`
  },
  {
    title: 'ORDER BY (Sort)',
    description: 'Sort results ASC or DESC',
    query: `SELECT FIELD("name-uuid"), FIELD("score-uuid")
FROM "550e8400-e29b-41d4-a716-446655440000"
ORDER BY FIELD("score-uuid") DESC`
  },
  {
    title: 'WHERE (Filter)',
    description: 'Filter with =, !=, >, <, LIKE',
    query: `SELECT FIELD("name-uuid"), FIELD("status-uuid")
FROM "550e8400-e29b-41d4-a716-446655440000"
WHERE FIELD("status-uuid") = 'Active'`
  },
  {
    title: 'LIMIT & OFFSET',
    description: 'Paginate or limit results',
    query: `SELECT * FROM "550e8400-e29b-41d4-a716-446655440000"
ORDER BY submitted_at DESC
LIMIT 10 OFFSET 0`
  },
  {
    title: 'JOIN Two Forms',
    description: 'Combine data from multiple forms',
    query: `SELECT a.FIELD("name-uuid"), b.FIELD("total-uuid")
FROM "form-uuid-1" AS a
INNER JOIN "form-uuid-2" AS b
ON a.FIELD("ref-uuid") = b.FIELD("ref-uuid")`
  }
];

interface QueryExamplesPopoverProps {
  onInsertQuery?: (query: string) => void;
}

export function QueryExamplesPopover({ onInsertQuery }: QueryExamplesPopoverProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (query: string, index: number) => {
    navigator.clipboard.writeText(query);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleInsert = (query: string) => {
    if (onInsertQuery) {
      onInsertQuery(query);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
          <BookOpen className="h-3.5 w-3.5" />
          Examples
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Query Examples</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click to copy or insert into your query
          </p>
        </div>
        <ScrollArea className="h-[350px]">
          <div className="p-2 space-y-2">
            {QUERY_EXAMPLES.map((example, index) => (
              <div
                key={index}
                className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h5 className="font-medium text-sm">{example.title}</h5>
                    <p className="text-xs text-muted-foreground">{example.description}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleCopy(example.query, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    {onInsertQuery && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleInsert(example.query)}
                      >
                        Use
                      </Button>
                    )}
                  </div>
                </div>
                <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                  {example.query}
                </pre>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
