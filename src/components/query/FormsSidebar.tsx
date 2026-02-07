import React, { useState, useEffect, memo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Copy, Plus, Database, Table, Type, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { schemaCache, FormDefinition, FieldDefinition, SystemColumnDefinition } from '@/services/schemaCache';
import { SavedQueriesSection } from './SavedQueriesSection';
import { useSavedQueries } from '@/hooks/useSavedQueries';
import { SavedQuery } from '@/types/queries';

interface FormsSidebarProps {
  onInsertText: (text: string) => void;
  onSelectQuery: (query: string) => void;
}

interface ActionButtonsProps {
  type: 'form' | 'field' | 'system';
  itemId: string;
  itemLabel: string;
  onCopy: (text: string, label: string) => void;
  onInsert: (text: string, label: string) => void;
}

// CRITICAL FIX: Memoize ActionButtons to prevent re-renders
// Props are now primitive values (strings) to enable proper shallow comparison
const ActionButtons = memo(function ActionButtons({
  type,
  itemId,
  itemLabel,
  onCopy,
  onInsert
}: ActionButtonsProps) {
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(itemId, itemLabel);
  }, [itemId, itemLabel, onCopy]);
  
  const handleInsertId = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === 'form') {
      onInsert(`"${itemId}"`, itemLabel);
    } else if (type === 'system') {
      onInsert(itemId, itemLabel);
    } else {
      onInsert(`FIELD("${itemId}")`, itemLabel);
    }
  }, [type, itemId, itemLabel, onInsert]);
  
  const handleInsertSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInsert(`SELECT FIELD("${itemId}") FROM `, itemLabel);
  }, [itemId, itemLabel, onInsert]);
  
  if (type === 'form') {
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleCopy}
          title="Copy Form ID"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleInsertId}
          title="Insert Form Reference"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  } else if (type === 'system') {
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleCopy}
          title="Copy Column Name"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleInsertId}
          title="Insert Column Reference"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  } else {
    return (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleCopy}
          title="Copy Field ID"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleInsertId}
          title="Insert Field Reference"
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleInsertSelect}
          title="Select Field"
        >
          <Database className="h-3 w-3" />
        </Button>
      </div>
    );
  }
});

export const FormsSidebar = memo(function FormsSidebar({
  onInsertText,
  onSelectQuery
}: FormsSidebarProps) {
  const [forms, setForms] = useState<Record<string, FormDefinition>>({});
  const [openForms, setOpenForms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isFormsExpanded, setIsFormsExpanded] = useState(true);
  const [isSystemTablesExpanded, setIsSystemTablesExpanded] = useState(false);
  const { savedQueries, isLoading, deleteQuery } = useSavedQueries();
  const { userProfile } = useAuth();

  // Define system tables with organization filtering requirements
  const systemTables = [
    { name: 'user_profiles', icon: '👤', description: 'User information and profiles', orgFilter: 'organization_id' },
    { name: 'organizations', icon: '🏢', description: 'Organization details', orgFilter: 'id' },
    { name: 'projects', icon: '📁', description: 'Projects in organization', orgFilter: 'organization_id' },
    { name: 'forms', icon: '📋', description: 'Forms metadata', orgFilter: 'organization_id' },
    { name: 'form_fields', icon: '📝', description: 'Form field definitions', orgFilter: null },
    { name: 'form_submissions', icon: '📤', description: 'Form submission data', orgFilter: null },
    { name: 'workflows', icon: '🔄', description: 'Workflow definitions', orgFilter: 'organization_id' },
    { name: 'reports', icon: '📊', description: 'Report configurations', orgFilter: 'organization_id' },
    { name: 'form_rules', icon: '⚙️', description: 'Form rule configurations', orgFilter: null },
  ];

  // Generate WHERE clause for system table based on organization context
  const getSystemTableQuery = useCallback((tableName: string, orgFilterColumn: string | null) => {
    if (!orgFilterColumn || !userProfile?.organization_id) {
      return `SELECT * FROM ${tableName} LIMIT 10`;
    }
    
    return `SELECT * FROM ${tableName} WHERE ${orgFilterColumn} = '${userProfile.organization_id}' LIMIT 10`;
  }, [userProfile?.organization_id]);

  const handleSelectQuery = useCallback((query: SavedQuery) => {
    onSelectQuery(query.query);
  }, [onSelectQuery]);

  // CRITICAL FIX: Memoize copy/insert handlers at parent level
  // This prevents ActionButtons from recreating functions on each render
  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // Use a simple console log instead of toast to avoid hook overhead
    console.log(`Copied ${label} to clipboard`);
  }, []);

  const handleInsert = useCallback((text: string, label: string) => {
    onInsertText(text);
    console.log(`Inserted ${label} into editor`);
  }, [onInsertText]);

  useEffect(() => {
    const loadForms = async () => {
      try {
        // Force refresh cache to get latest forms (including status changes)
        await schemaCache.refreshCache();
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

  const toggleForm = useCallback((formId: string) => {
    setOpenForms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(formId)) {
        newSet.delete(formId);
      } else {
        newSet.add(formId);
      }
      return newSet;
    });
  }, []);

  const getTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'text':
        return 'bg-blue-100 text-blue-800';
      case 'number':
        return 'bg-green-100 text-green-800';
      case 'datetime':
        return 'bg-purple-100 text-purple-800';
      case 'boolean':
        return 'bg-orange-100 text-orange-800';
      case 'select':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  // Memoize system table click handler
  const handleSystemTableClick = useCallback((tableName: string, orgFilter: string | null) => {
    const query = getSystemTableQuery(tableName, orgFilter);
    onInsertText(query);
  }, [getSystemTableQuery, onInsertText]);

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
        <h2 className="font-semibold text-sm flex items-center">
          <Database className="h-4 w-4 mr-2" />
          Query Explorer
        </h2>
      </div>
      
      <ScrollArea className="h-full">
        <div className="p-2 space-y-2">
          {/* Saved Queries Section */}
          <SavedQueriesSection
            savedQueries={savedQueries}
            isLoading={isLoading}
            onSelectQuery={handleSelectQuery}
            onDeleteQuery={deleteQuery}
          />

          {/* System Tables Section */}
          <Collapsible open={isSystemTablesExpanded} onOpenChange={setIsSystemTablesExpanded}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 border border-border">
                {isSystemTablesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Database className="h-4 w-4" />
                <span className="font-medium text-sm">System Tables</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1">
              {systemTables.map(table => (
                <SystemTableItem 
                  key={table.name}
                  table={table}
                  onInsert={handleSystemTableClick}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Forms & Fields Section */}
          <Collapsible open={isFormsExpanded} onOpenChange={setIsFormsExpanded}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 border border-border">
                {isFormsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Table className="h-4 w-4" />
                <span className="font-medium text-sm">Forms & Fields</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1">
              {Object.values(forms).map(form => (
                <FormItem
                  key={form.id}
                  form={form}
                  isOpen={openForms.has(form.id)}
                  onToggle={toggleForm}
                  onCopy={handleCopy}
                  onInsert={handleInsert}
                  getTypeColor={getTypeColor}
                />
              ))}
              
              {Object.keys(forms).length === 0 && (
                <div className="text-center py-8 text-muted-foreground ml-4">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No forms found</p>
                  <p className="text-xs">Create a form to see it here</p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
});

// CRITICAL FIX: Memoized sub-components to prevent re-renders
interface SystemTableItemProps {
  table: { name: string; icon: string; description: string; orgFilter: string | null };
  onInsert: (tableName: string, orgFilter: string | null) => void;
}

const SystemTableItem = memo(function SystemTableItem({ table, onInsert }: SystemTableItemProps) {
  const handleClick = useCallback(() => {
    onInsert(table.name, table.orgFilter);
  }, [table.name, table.orgFilter, onInsert]);

  return (
    <div className="ml-4 p-2 rounded-md hover:bg-muted/50 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-base">{table.icon}</span>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{table.name}</span>
            <span className="text-xs text-muted-foreground truncate">{table.description}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          onClick={handleClick}
          title="Insert SELECT query with organization filter"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
});

interface FormItemProps {
  form: FormDefinition;
  isOpen: boolean;
  onToggle: (formId: string) => void;
  onCopy: (text: string, label: string) => void;
  onInsert: (text: string, label: string) => void;
  getTypeColor: (type: string) => string;
}

const FormItem = memo(function FormItem({ 
  form, 
  isOpen, 
  onToggle, 
  onCopy, 
  onInsert,
  getTypeColor 
}: FormItemProps) {
  const handleToggle = useCallback(() => {
    onToggle(form.id);
  }, [form.id, onToggle]);

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      {/* CRITICAL FIX: Use div with onClick instead of CollapsibleTrigger to avoid button nesting */}
      <div className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 group ml-4">
        <div 
          className="flex items-center gap-2 flex-1 cursor-pointer"
          onClick={handleToggle}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Table className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{form.name}</span>
        </div>
        <ActionButtons 
          type="form" 
          itemId={form.id} 
          itemLabel={form.name}
          onCopy={onCopy} 
          onInsert={onInsert} 
        />
      </div>
      
      <CollapsibleContent className="ml-10 space-y-1">
        {/* System Columns Section */}
        <div className="mt-2">
          <div className="flex items-center gap-2 px-2 py-1">
            <Settings className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">System Columns</span>
          </div>
          {Object.values(form.systemColumns).map(column => (
            <div key={column.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 group">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Settings className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs truncate">{column.label}</span>
                <Badge variant="secondary" className={`text-xs px-1 py-0 ${getTypeColor(column.type)} flex-shrink-0`}>
                  {column.type}
                </Badge>
              </div>
              <ActionButtons 
                type="system" 
                itemId={column.id} 
                itemLabel={column.label}
                onCopy={onCopy} 
                onInsert={onInsert} 
              />
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
          {Object.values(form.fields).map(field => (
            <div key={field.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 group">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Type className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs truncate">{field.label}</span>
                <Badge variant="secondary" className={`text-xs px-1 py-0 ${getTypeColor(field.type)} flex-shrink-0`}>
                  {field.type}
                </Badge>
                {field.required && (
                  <Badge variant="destructive" className="text-xs px-1 py-0">
                    Required
                  </Badge>
                )}
              </div>
              <ActionButtons 
                type="field" 
                itemId={field.id} 
                itemLabel={field.label}
                onCopy={onCopy} 
                onInsert={onInsert} 
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});