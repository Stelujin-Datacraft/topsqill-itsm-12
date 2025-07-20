
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Copy, Plus, Database, Table, Type, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { schemaCache, FormDefinition, FieldDefinition, SystemColumnDefinition } from '@/services/schemaCache';

interface FormsSidebarProps {
  onInsertText: (text: string) => void;
}

interface ActionButtonsProps {
  type: 'form' | 'field' | 'system';
  item: FormDefinition | FieldDefinition | SystemColumnDefinition;
  onInsertText: (text: string) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ type, item, onInsertText }) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${type === 'form' ? 'Form' : type === 'system' ? 'System column' : 'Field'} ID copied`,
    });
  };

  const insertIntoEditor = (text: string) => {
    onInsertText(text);
    toast({
      title: "Inserted into editor",
      description: `${type === 'form' ? 'Form' : type === 'system' ? 'System column' : 'Field'} reference added`,
    });
  };

  if (type === 'form') {
    const form = item as FormDefinition;
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(form.id);
          }}
          title="Copy Form ID"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            insertIntoEditor(`"${form.id}"`);
          }}
          title="Insert Form Reference"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  } else if (type === 'system') {
    const column = item as SystemColumnDefinition;
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(column.id);
          }}
          title="Copy Column Name"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            insertIntoEditor(column.id);
          }}
          title="Insert Column Reference"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  } else {
    const field = item as FieldDefinition;
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(field.id);
          }}
          title="Copy Field ID"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            insertIntoEditor(`FIELD("${field.id}")`);
          }}
          title="Insert Field Reference"
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            insertIntoEditor(`SELECT FIELD("${field.id}") FROM `);
          }}
          title="Select Field"
        >
          <Database className="h-3 w-3" />
        </Button>
      </div>
    );
  }
};

export const FormsSidebar: React.FC<FormsSidebarProps> = ({ onInsertText }) => {
  const [forms, setForms] = useState<Record<string, FormDefinition>>({});
  const [openForms, setOpenForms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadForms = async () => {
      try {
        const cache = await schemaCache.getCache();
        setForms(cache.forms);
      } catch (error) {
        console.error('Error loading forms:', error);
      } finally {
        setLoading(false);
      }
    };

    loadForms();
  }, []);

  const toggleForm = (formId: string) => {
    setOpenForms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(formId)) {
        newSet.delete(formId);
      } else {
        newSet.add(formId);
      }
      return newSet;
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-100 text-blue-800';
      case 'number': return 'bg-green-100 text-green-800';
      case 'datetime': return 'bg-purple-100 text-purple-800';
      case 'boolean': return 'bg-orange-100 text-orange-800';
      case 'select': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full border-r border-border bg-muted/10">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4" />
            <span className="font-medium">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full border-r border-border bg-muted/10">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <span className="font-medium">Forms & Fields</span>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100%-4rem)]">
        <div className="p-2 space-y-1">
          {Object.values(forms).map((form) => (
            <Collapsible
              key={form.id}
              open={openForms.has(form.id)}
              onOpenChange={() => toggleForm(form.id)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 group">
                  <div className="flex items-center gap-2 flex-1">
                    {openForms.has(form.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Table className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{form.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(form.fields).length} fields
                    </Badge>
                  </div>
                  <ActionButtons type="form" item={form} onInsertText={onInsertText} />
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="ml-6 space-y-1">
                {/* System Columns Section */}
                <div className="mt-2">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Settings className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">System Columns</span>
                  </div>
                  {Object.values(form.systemColumns).map((column) => (
                    <div
                      key={column.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 group"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Settings className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs truncate">{column.label}</span>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs px-1 py-0 ${getTypeColor(column.type)} flex-shrink-0`}
                        >
                          {column.type}
                        </Badge>
                      </div>
                      <ActionButtons type="system" item={column} onInsertText={onInsertText} />
                    </div>
                  ))}
                </div>

                <Separator className="my-2" />

                {/* Form Fields Section */}
                <div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Type className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Form Fields</span>
                  </div>
                  {Object.values(form.fields).map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 group"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Type className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs truncate">{field.label}</span>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs px-1 py-0 ${getTypeColor(field.type)} flex-shrink-0`}
                        >
                          {field.type}
                        </Badge>
                        {field.required && (
                          <Badge variant="destructive" className="text-xs px-1 py-0">
                            Required
                          </Badge>
                        )}
                      </div>
                      <ActionButtons type="field" item={field} onInsertText={onInsertText} />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
          
          {Object.keys(forms).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No forms found</p>
              <p className="text-xs">Create a form to see it here</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
