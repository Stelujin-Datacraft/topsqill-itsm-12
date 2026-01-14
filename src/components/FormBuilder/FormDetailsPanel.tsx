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
import { FileStack, Settings2, Grid3X3, Calendar, Hash } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"


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
// Form Details Section Component  
function FormDetailsSection({
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  currentForm
}: {
  formName: string;
  setFormName: (name: string) => void;
  formDescription: string;
  setFormDescription: (description: string) => void;
  currentForm: Form | null;
}) {
  return (
    <div className="space-y-6">
      {/* Form Basic Information */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold text-foreground">Form Information</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="form-name" className="text-sm font-medium text-foreground">Form Title</Label>
            <Input id="form-name" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Enter form title..." className="mt-1.5" />
          </div>
          
          <div>
            <Label htmlFor="form-description" className="text-sm font-medium text-foreground">Description</Label>
            <Textarea id="form-description" value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Enter form description..." className="mt-1.5 min-h-[60px] resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Form Metadata */}
      {currentForm && (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold text-foreground">Form Details</h2>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="flex items-center justify-between py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Form ID</span>
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded text-foreground max-w-[150px] truncate">{currentForm.id}</code>
            </div>
            
            {currentForm.createdAt && (
              <div className="flex items-center justify-between py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Created</span>
                </div>
                <span className="text-sm text-foreground">{new Date(currentForm.createdAt).toLocaleDateString()}</span>
              </div>
            )}
            
            {currentForm.updatedAt && (
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Modified</span>
                </div>
                <span className="text-sm text-foreground">{new Date(currentForm.updatedAt).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold text-foreground">Status</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Status</span>
            <Badge variant={currentForm?.status === 'active' ? 'default' : 'secondary'}>
              {currentForm?.status || 'Draft'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
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
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  // If showing form details, render the details section
  if (showFormDetails) {
    return <div className="h-full p-6 bg-white overflow-y-auto">
        <FormDetailsSection formName={formName} setFormName={setFormName} formDescription={formDescription} setFormDescription={setFormDescription} currentForm={currentForm} />
      </div>;
  }

  // Otherwise render the page navigation
  return <div className="w-full bg-white border-b border-border">
      {/* Page Navigation with Settings */}
      <div className="flex items-center justify-between gap-2 px-4 py-[16px] my-0">
        {/* Full-width page navigation */}
        <div className="flex-1 min-w-0">
          <FormPagination pages={pages} currentPageId={currentPageId} currentPageIndex={pages.findIndex(p => p.id === currentPageId)} onPageChange={setCurrentPageId} onPrevious={() => {
          const currentIndex = pages.findIndex(p => p.id === currentPageId);
          if (currentIndex > 0) {
            setCurrentPageId(pages[currentIndex - 1].id);
          }
        }} onNext={() => {
          const currentIndex = pages.findIndex(p => p.id === currentPageId);
          if (currentIndex < pages.length - 1) {
            setCurrentPageId(pages[currentIndex + 1].id);
          }
        }} onPageRename={onPageRename} onPageDelete={onPageDelete} readOnly={false} />
        </div>
        
        {/* Column Layout Dropdown - Always Visible */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            <Select
              value={columnLayout.toString()}
              onValueChange={value => setColumnLayout(Number(value) as 1 | 2 | 3)}
            >
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Column</SelectItem>
                <SelectItem value="2">2 Columns</SelectItem>
                <SelectItem value="3">3 Columns</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Add Page Button in Popover */}
          <Popover open={showLayoutControls} onOpenChange={setShowLayoutControls}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>

            <PopoverContent align="end" className="min-w-[200px] p-4">
              <div className="space-y-2">
                <Label className="block text-sm font-medium">Add New Page</Label>
                <Button onClick={onAddPage} variant="outline" size="sm" className="w-full h-9">
                  <FileStack className="h-4 w-4 mr-2" />
                  Add Page
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Page Info */}
      
    </div>;
}