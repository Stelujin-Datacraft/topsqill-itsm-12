
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Type, 
  Mail, 
  Hash, 
  Calendar, 
  FileText, 
  CheckSquare, 
  Circle, 
  List, 
  Upload,
  X,
  ChevronLeft
} from 'lucide-react';
import { FormField, FormPage } from '@/types/form';

interface FormNavigationPanelProps {
  pages: FormPage[];
  fields: FormField[];
  currentPageId: string;
  selectedField: FormField | null;
  onPageChange: (pageId: string) => void;
  onFieldSelect: (field: FormField) => void;
  onFieldHighlight: (fieldId: string) => void;
  onToggleNavigation?: () => void;
  isCollapsed?: boolean;
}

const fieldTypeIcons = {
  text: Type,
  email: Mail,
  number: Hash,
  date: Calendar,
  textarea: FileText,
  checkbox: CheckSquare,
  radio: Circle,
  select: List,
  file: Upload,
  phone: Type,
  time: Calendar,
  switch: CheckSquare,
};

export function FormNavigationPanel({
  pages,
  fields,
  currentPageId,
  selectedField,
  onPageChange,
  onFieldSelect,
  onFieldHighlight,
  onToggleNavigation,
  isCollapsed = false,
}: FormNavigationPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  // Initialize expanded pages to include current page
  useEffect(() => {
    if (currentPageId && !expandedPages.has(currentPageId)) {
      setExpandedPages(prev => new Set([...prev, currentPageId]));
    }
  }, [currentPageId, expandedPages]);

  // Filter fields based on search term
  const filteredFields = fields.filter(field =>
    field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group fields by page
  const getPageFields = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return [];
    
    return filteredFields.filter(field => 
      page.fields.includes(field.id) || field.pageId === pageId
    );
  };

  const togglePageExpansion = (pageId: string) => {
    setExpandedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const handleFieldClick = (field: FormField) => {
    // Just highlight and navigate to the field, don't open configuration
    onFieldHighlight(field.id);
    
    // Switch to the field's page if different from current
    const fieldPage = pages.find(page => 
      page.fields.includes(field.id) || field.pageId === page.id
    );
    if (fieldPage && fieldPage.id !== currentPageId) {
      onPageChange(fieldPage.id);
    }
    
    // Scroll to field after page change
    setTimeout(() => {
      const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`);
      if (fieldElement) {
        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const getFieldIcon = (type: FormField['type']) => {
    const IconComponent = fieldTypeIcons[type] || Type;
    return IconComponent;
  };

  // Collapsed state - thin panel with expand button
  if (isCollapsed) {
    return (
      <div style={{width:'25px'}} className="w-6 h-fit flex flex-col">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleNavigation}
          className="w-full h-12 p-0 flex items-center justify-center"
          title="Expand Navigation"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="h-fit print:hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Form Navigation</CardTitle>
          <div className="flex gap-1">
            {onToggleNavigation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleNavigation}
                className="h-6 w-6 p-0"
                title="Collapse Navigation"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <ScrollArea className="h-[calc(100vh-16rem)]">
          <div className="space-y-2">
            {pages.map((page) => {
              const pageFields = getPageFields(page.id);
              const isExpanded = expandedPages.has(page.id);
              const hasMatchingFields = pageFields.length > 0;
              
              // Hide page if no matching fields and there's a search term
              if (searchTerm && !hasMatchingFields) {
                return null;
              }
              
              return (
                <div key={page.id} className="space-y-1">
                  {/* Page Header */}
                  <div
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                      currentPageId === page.id ? 'bg-muted font-medium' : ''
                    }`}
                    onClick={() => togglePageExpansion(page.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium truncate">{page.name}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {pageFields.length}
                    </Badge>
                  </div>
                  
                  {/* Fields List */}
                  {isExpanded && (
                    <div className="ml-4 space-y-1">
                      {pageFields.map((field) => {
                        const FieldIcon = getFieldIcon(field.type);
                        const isSelected = selectedField?.id === field.id;
                        
                        return (
                          <div
                            key={field.id}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                              isSelected ? 'bg-primary/10 border border-primary/20' : ''
                            }`}
                            onClick={() => handleFieldClick(field)}
                          >
                            <FieldIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate flex-1">{field.label}</span>
                            {field.required && (
                              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                      
                      {pageFields.length === 0 && (
                        <div className="text-xs text-muted-foreground p-2">
                          No fields on this page
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {pages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-sm">No pages created yet</div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
