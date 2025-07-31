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

  return <div className="flex flex-col gap-6 h-full">
      {/* Compact Page and Layout Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Page Navigation */}
              {pages.length > 0 && (
                <FormPagination 
                  pages={pages} 
                  currentPageId={currentPageId} 
                  currentPageIndex={pages.findIndex(p => p.id === currentPageId)} 
                  onPageChange={setCurrentPageId} 
                  onPrevious={() => {
                    const currentIndex = pages.findIndex(p => p.id === currentPageId);
                    if (currentIndex > 0) {
                      setCurrentPageId(pages[currentIndex - 1].id);
                    }
                  }} 
                  onNext={() => {
                    const currentIndex = pages.findIndex(p => p.id === currentPageId);
                    if (currentIndex < pages.length - 1) {
                      setCurrentPageId(pages[currentIndex + 1].id);
                    }
                  }} 
                  onPageRename={onPageRename} 
                  onPageDelete={onPageDelete} 
                  showSave={false} 
                />
              )}
            </div>
            
            {/* Compact Settings Button */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowLayoutControls(!showLayoutControls)} 
              className="h-8 w-8 p-0"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Collapsible Layout Controls */}
          {showLayoutControls && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="column-layout" className="block mb-2 text-sm">Column Layout</Label>
                  <Select value={columnLayout.toString()} onValueChange={value => setColumnLayout(Number(value) as 1 | 2 | 3)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Column</SelectItem>
                      <SelectItem value="2">2 Columns</SelectItem>
                      <SelectItem value="3">3 Columns</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="block mb-2 text-sm">Add Page</Label>
                  <Button onClick={onAddPage} variant="outline" size="sm" className="w-full h-8">
                    <FileStack className="h-3 w-3 mr-2" />
                    Add Page
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Field Layout Section */}
      <Card className="flex-1">
        <CardHeader>
          <h3 className="text-lg font-medium">Form Fields</h3>
          <p className="text-sm text-muted-foreground">
            {currentPageFields.length === 0 ? "No fields on this page yet. Add fields from the right panel." : `${currentPageFields.length} field${currentPageFields.length === 1 ? '' : 's'} on this page`}
          </p>
        </CardHeader>
        <CardContent className="flex-1">
          <FieldLayoutRenderer fields={currentPageFields} columnLayout={columnLayout} selectedFieldId={selectedFieldId} highlightedFieldId={highlightedFieldId} onFieldClick={onFieldClick} onFieldDelete={onFieldDelete} onDragEnd={onDragEnd} />
        </CardContent>
      </Card>
    </div>;
}