import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormPagination } from '@/components/FormPagination';
import { FieldLayoutRenderer } from './FieldLayoutRenderer';
import { Form, FormPage, FormField } from '@/types/form';
import { FileStack, ChevronUp, ChevronDown, Settings2, Grid3X3 } from 'lucide-react';
interface FormDetailsPanelProps {
  formName: string;
  setFormName: (name: string) => void;
  formDescription: string;
  setFormDescription: (description: string) => void;
  columnLayout: 1 | 2 | 3;
  setColumnLayout: (layout: 1 | 2 | 3) => void;
  pages: FormPage[];
  currentPageId: string;
  setCurrentPageId: (pageId: string) => void;
  currentForm: Form | null;
  currentPageFieldsCount: number;
  onAddPage: () => void;
  onPageRename: (pageId: string, newName: string) => void;
  onPageDelete: (pageId: string) => void;
  // Field layout props
  currentPageFields: FormField[];
  selectedFieldId?: string;
  highlightedFieldId: string | null;
  onFieldClick: (field: FormField) => void;
  onFieldDelete: (fieldId: string) => void;
  onDragEnd: (result: any) => void;
  // Show/hide form details
  showFormDetails: boolean;
  setShowFormDetails: (show: boolean) => void;
}
export function FormDetailsPanel({
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  columnLayout,
  setColumnLayout,
  pages,
  currentPageId,
  setCurrentPageId,
  currentForm,
  currentPageFieldsCount,
  onAddPage,
  onPageRename,
  onPageDelete,
  currentPageFields,
  selectedFieldId,
  highlightedFieldId,
  onFieldClick,
  onFieldDelete,
  onDragEnd,
  showFormDetails,
  setShowFormDetails
}: FormDetailsPanelProps) {
  console.log('FormDetailsPanel - Current page:', currentPageId);
  console.log('FormDetailsPanel - Pages:', pages);
  console.log('FormDetailsPanel - Current page fields count:', currentPageFieldsCount);
  console.log('FormDetailsPanel - Current page fields:', currentPageFields);
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  return (
    <div className="p-4 bg-white border-b border-border">
      {/* Full-width scrollable page navigation */}
      <div className="flex items-center justify-between gap-4">
        {/* Left side - Page tabs with scrolling */}
        <div className="flex-1 min-w-0">
          {pages.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Left scroll button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const currentIndex = pages.findIndex(p => p.id === currentPageId);
                  if (currentIndex > 0) {
                    setCurrentPageId(pages[currentIndex - 1].id);
                  }
                }}
                disabled={pages.findIndex(p => p.id === currentPageId) === 0}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <ChevronUp className="h-4 w-4 rotate-[-90deg]" />
              </Button>
              
              {/* Scrollable page tabs */}
              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <div className="flex gap-1 min-w-max">
                  {pages.map((page) => (
                    <Button
                      key={page.id}
                      variant={currentPageId === page.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPageId(page.id)}
                      className="whitespace-nowrap text-sm h-8 px-3"
                    >
                      {page.name}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Right scroll button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const currentIndex = pages.findIndex(p => p.id === currentPageId);
                  if (currentIndex < pages.length - 1) {
                    setCurrentPageId(pages[currentIndex + 1].id);
                  }
                }}
                disabled={pages.findIndex(p => p.id === currentPageId) === pages.length - 1}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
              </Button>
            </div>
          )}
        </div>
        
        {/* Right side - Compact settings dropdown */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowLayoutControls(!showLayoutControls)} 
            className="h-8 w-8 p-0"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          
          {/* Dropdown controls */}
          {showLayoutControls && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-border rounded-lg shadow-lg p-4 z-50 min-w-[300px]">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="column-layout" className="block mb-2 text-sm font-medium">
                    Column Layout
                  </Label>
                  <Select value={columnLayout.toString()} onValueChange={value => setColumnLayout(Number(value) as 1 | 2 | 3)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Column</SelectItem>
                      <SelectItem value="2">2 Columns</SelectItem>
                      <SelectItem value="3">3 Columns</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block mb-2 text-sm font-medium">Add New Page</Label>
                  <Button onClick={onAddPage} variant="outline" size="sm" className="w-full h-9">
                    <FileStack className="h-4 w-4 mr-2" />
                    Add Page
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Page indicator */}
      <div className="flex items-center justify-center mt-2">
        <span className="text-xs text-muted-foreground">
          Page {pages.findIndex(p => p.id === currentPageId) + 1} of {pages.length}
          {currentPageFields.length > 0 && ` • ${currentPageFields.length} field${currentPageFields.length === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  );
}