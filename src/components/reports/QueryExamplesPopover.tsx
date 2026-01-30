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
    title: 'Simple SELECT',
    description: 'Get all records from a form',
    query: `SELECT * FROM "form-uuid"`
  },
  {
    title: 'Select Specific Fields',
    description: 'Choose specific fields to display',
    query: `SELECT FIELD("name-field"), FIELD("email-field")
FROM "form-uuid"`
  },
  {
    title: 'COUNT with GROUP BY',
    description: 'Count records grouped by a field',
    query: `SELECT FIELD("status"), COUNT(*) as total
FROM "form-uuid"
GROUP BY FIELD("status")`
  },
  {
    title: 'Aggregation Functions',
    description: 'SUM, AVG, MIN, MAX operations',
    query: `SELECT FIELD("category"),
       SUM(FIELD("amount")) as total,
       AVG(FIELD("amount")) as average
FROM "form-uuid"
GROUP BY FIELD("category")`
  },
  {
    title: 'ORDER BY',
    description: 'Sort results ascending or descending',
    query: `SELECT FIELD("name"), FIELD("score")
FROM "form-uuid"
ORDER BY FIELD("score") DESC`
  },
  {
    title: 'WHERE Clause',
    description: 'Filter records with conditions',
    query: `SELECT FIELD("name"), FIELD("status")
FROM "form-uuid"
WHERE FIELD("status") = 'active'`
  },
  {
    title: 'LIMIT Results',
    description: 'Limit the number of results',
    query: `SELECT FIELD("name"), FIELD("created_at")
FROM "form-uuid"
ORDER BY FIELD("created_at") DESC
LIMIT 10`
  },
  {
    title: 'JOIN Forms',
    description: 'Combine data from two forms',
    query: `SELECT a.FIELD("name"), b.FIELD("order_total")
FROM "form-uuid-1" AS a
INNER JOIN "form-uuid-2" AS b
ON a.FIELD("customer_id") = b.FIELD("customer_id")`
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
