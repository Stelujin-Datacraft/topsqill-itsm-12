import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Code2, Copy, Database, Filter, TrendingUp, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'aggregate' | 'filter' | 'advanced';
  query: string;
  icon: React.ReactNode;
  variables: string[];
}

const templates: QueryTemplate[] = [
  {
    id: 'all-submissions',
    name: 'Get All Form Submissions',
    description: 'Retrieve all submissions from the current form',
    category: 'basic',
    icon: <Database className="h-4 w-4" />,
    query: 'SELECT * FROM "{form_id}"',
    variables: ['{form_id}']
  },
  {
    id: 'specific-fields',
    name: 'Get Specific Fields',
    description: 'Select only specific fields from submissions',
    category: 'basic',
    icon: <Filter className="h-4 w-4" />,
    query: 'SELECT "{field_id_1}", "{field_id_2}" FROM "{form_id}"',
    variables: ['{form_id}', '{field_id_1}', '{field_id_2}']
  },
  {
    id: 'filter-by-value',
    name: 'Filter by Field Value',
    description: 'Get submissions where a field matches a value',
    category: 'filter',
    icon: <Filter className="h-4 w-4" />,
    query: 'SELECT * FROM "{form_id}" WHERE "{field_id}" = \'value\'',
    variables: ['{form_id}', '{field_id}']
  },
  {
    id: 'search-text',
    name: 'Search Text Field',
    description: 'Search for submissions containing text',
    category: 'filter',
    icon: <Filter className="h-4 w-4" />,
    query: 'SELECT * FROM "{form_id}" WHERE "{field_id}" LIKE \'%search_term%\'',
    variables: ['{form_id}', '{field_id}']
  },
  {
    id: 'count-submissions',
    name: 'Count Submissions',
    description: 'Count total number of submissions',
    category: 'aggregate',
    icon: <TrendingUp className="h-4 w-4" />,
    query: 'SELECT COUNT(*) as total FROM "{form_id}"',
    variables: ['{form_id}']
  },
  {
    id: 'sum-values',
    name: 'Sum Numeric Field',
    description: 'Calculate sum of a numeric field',
    category: 'aggregate',
    icon: <TrendingUp className="h-4 w-4" />,
    query: 'SELECT SUM("{field_id}") as total FROM "{form_id}"',
    variables: ['{form_id}', '{field_id}']
  },
  {
    id: 'group-count',
    name: 'Group and Count',
    description: 'Count submissions grouped by a field value',
    category: 'aggregate',
    icon: <Users className="h-4 w-4" />,
    query: 'SELECT "{field_id}", COUNT(*) as count FROM "{form_id}" GROUP BY "{field_id}"',
    variables: ['{form_id}', '{field_id}']
  },
  {
    id: 'recent-submissions',
    name: 'Recent Submissions',
    description: 'Get the 10 most recent submissions',
    category: 'advanced',
    icon: <Database className="h-4 w-4" />,
    query: 'SELECT * FROM "{form_id}" ORDER BY submitted_at DESC LIMIT 10',
    variables: ['{form_id}']
  },
  {
    id: 'avg-rating',
    name: 'Average Rating',
    description: 'Calculate average of a rating field',
    category: 'aggregate',
    icon: <TrendingUp className="h-4 w-4" />,
    query: 'SELECT AVG("{field_id}") as average FROM "{form_id}"',
    variables: ['{form_id}', '{field_id}']
  },
  {
    id: 'multiple-filters',
    name: 'Multiple Conditions',
    description: 'Filter with multiple conditions (AND)',
    category: 'advanced',
    icon: <Filter className="h-4 w-4" />,
    query: 'SELECT * FROM "{form_id}" WHERE "{field_id_1}" = \'value1\' AND "{field_id_2}" = \'value2\'',
    variables: ['{form_id}', '{field_id_1}', '{field_id_2}']
  },
  {
    id: 'cross-reference-fetch',
    name: 'Fetch Cross-Reference Records',
    description: 'Get full data from linked cross-reference records',
    category: 'advanced',
    icon: <Database className="h-4 w-4" />,
    query: `SELECT 
  id,
  submission_ref_id,
  form_id,
  submission_data
FROM form_submissions
WHERE form_id = '{linked_form_id}'
  AND submission_ref_id IN ('{ref_id_1}', '{ref_id_2}')`,
    variables: ['{linked_form_id}', '{ref_id_1}', '{ref_id_2}']
  },
  {
    id: 'cross-reference-fields',
    name: 'Extract Cross-Reference Field Values',
    description: 'Get specific fields from cross-referenced records',
    category: 'advanced',
    icon: <Filter className="h-4 w-4" />,
    query: `SELECT 
  id,
  submission_ref_id,
  submission_data->>'{field_id_1}' as field_1,
  submission_data->>'{field_id_2}' as field_2
FROM form_submissions
WHERE form_id = '{linked_form_id}'
  AND submission_ref_id IN ('{ref_id_1}', '{ref_id_2}')`,
    variables: ['{linked_form_id}', '{field_id_1}', '{field_id_2}', '{ref_id_1}', '{ref_id_2}']
  }
];

interface QueryTemplatesProps {
  onSelectTemplate: (query: string) => void;
  currentFormId?: string;
}

export function QueryTemplates({ onSelectTemplate, currentFormId }: QueryTemplatesProps) {
  const { toast } = useToast();

  const handleUseTemplate = (template: QueryTemplate) => {
    let query = template.query;
    
    // Replace form_id if available
    if (currentFormId) {
      query = query.replace(/\{form_id\}/g, currentFormId);
    }
    
    onSelectTemplate(query);
    toast({
      title: "Template Applied",
      description: `"${template.name}" has been added to your query editor. Replace placeholder IDs with actual field IDs.`,
    });
  };

  const handleCopyQuery = (query: string, templateName: string) => {
    navigator.clipboard.writeText(query);
    toast({
      title: "Copied to Clipboard",
      description: `${templateName} query copied!`,
    });
  };

  const getCategoryBadge = (category: string) => {
    const badges = {
      basic: { label: 'Basic', variant: 'default' as const },
      filter: { label: 'Filter', variant: 'secondary' as const },
      aggregate: { label: 'Aggregate', variant: 'outline' as const },
      advanced: { label: 'Advanced', variant: 'destructive' as const }
    };
    return badges[category as keyof typeof badges];
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, QueryTemplate[]>);

  const categoryTitles = {
    basic: 'Basic Queries',
    filter: 'Filtering Data',
    aggregate: 'Aggregations & Analytics',
    advanced: 'Advanced Queries'
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          Query Templates
        </h3>
        <p className="text-sm text-muted-foreground">
          Select a template to get started. Replace {'{form_id}'} and {'{field_id}'} placeholders with actual IDs using the helper above.
        </p>
      </div>

      {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            {categoryTitles[category as keyof typeof categoryTitles]}
            <Badge variant="outline" className="text-xs">
              {categoryTemplates.length} templates
            </Badge>
          </h4>
          <div className="grid gap-3">
            {categoryTemplates.map((template) => (
              <Card key={template.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {template.icon}
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                    </div>
                    <Badge {...getCategoryBadge(template.category)} className="text-xs">
                      {getCategoryBadge(template.category).label}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/50 rounded-md p-3 font-mono text-xs overflow-x-auto">
                    <code>{template.query}</code>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleUseTemplate(template)}
                      className="flex-1"
                    >
                      Use Template
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyQuery(template.query, template.name)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Variables:</span>
                      {template.variables.map((variable) => (
                        <Badge key={variable} variant="secondary" className="text-xs font-mono">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-sm">Query Syntax Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Basic Syntax:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="bg-muted px-1 rounded">SELECT "{'{field_id}'}" FROM "{'{form_id}'}""</code> - Get specific field values</li>
              <li><code className="bg-muted px-1 rounded">WHERE "{'{field_id}'}" = 'value'</code> - Filter by exact match</li>
              <li><code className="bg-muted px-1 rounded">WHERE "{'{field_id}'}" LIKE '%text%'</code> - Search text (case-insensitive)</li>
              <li><code className="bg-muted px-1 rounded">ORDER BY "{'{field_id}'}" DESC</code> - Sort results</li>
              <li><code className="bg-muted px-1 rounded">LIMIT 10</code> - Limit number of results</li>
            </ul>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Aggregations:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="bg-muted px-1 rounded">COUNT(*)</code> - Count submissions</li>
              <li><code className="bg-muted px-1 rounded">SUM("{'{field_id}'}")</code> - Sum numeric values</li>
              <li><code className="bg-muted px-1 rounded">AVG("{'{field_id}'}")</code> - Average of values</li>
              <li><code className="bg-muted px-1 rounded">GROUP BY "{'{field_id}'}""</code> - Group results</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
