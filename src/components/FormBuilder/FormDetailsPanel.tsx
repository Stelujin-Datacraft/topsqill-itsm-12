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
import { FileStack, ChevronUp, ChevronDown, Settings2, Grid3X3, Calendar, User, Hash, Share2, Settings, Globe, Eye } from 'lucide-react';
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
  return <div className="space-y-8">
      {/* Form Basic Information */}
      <Card>
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold text-foreground">Form Information</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="form-name" className="text-sm font-medium text-foreground">Form Title</Label>
            <Input id="form-name" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Enter form title..." className="mt-2" />
          </div>
          
          <div>
            <Label htmlFor="form-description" className="text-sm font-medium text-foreground">Form Description</Label>
            <Textarea id="form-description" value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Enter form description..." className="mt-2 min-h-[80px] resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Form Metadata */}
      {currentForm && <Card>
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-foreground">Form Details</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Form ID</span>
                </div>
                <code className="text-xs bg-muted px-2 py-1 rounded text-foreground">{currentForm.id}</code>
              </div>
              
              {currentForm.createdAt && <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Created Date</span>
                  </div>
                  <span className="text-sm text-foreground">{new Date(currentForm.createdAt).toLocaleDateString()}</span>
                </div>}
              
              {currentForm.updatedAt && <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Last Modified</span>
                  </div>
                  <span className="text-sm text-foreground">{new Date(currentForm.updatedAt).toLocaleDateString()}</span>
                </div>}
              
              {currentForm.createdBy && <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Created By</span>
                  </div>
                  <span className="text-sm text-foreground">{currentForm.createdBy}</span>
                </div>}
            </div>
          </CardContent>
        </Card>}

      {/* Lifecycle Management */}
      <Card>
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold text-foreground">Lifecycle Management</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Status</span>
            </div>
            <Badge variant={currentForm?.status === 'active' ? 'default' : 'secondary'}>
              {currentForm?.status || 'Draft'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 gap-3 pt-2">
            <Button variant="default" size="sm" className="justify-start">
              <Globe className="h-4 w-4 mr-2" />
              Publish Form
            </Button>
            
            <Button variant="outline" size="sm" className="justify-start">
              <Eye className="h-4 w-4 mr-2" />
              Preview Form
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Statistics */}
      <Card>
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold text-foreground">Form Statistics</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-foreground">0</div>
              <div className="text-sm text-muted-foreground">Total Responses</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-foreground">0</div>
              <div className="text-sm text-muted-foreground">Today's Responses</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sharing & Collaboration */}
      <Card>
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold text-foreground">Sharing & Collaboration</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Share2 className="h-4 w-4 mr-2" />
            Share Form Link
          </Button>
          
          <Button variant="outline" size="sm" className="w-full justify-start">
            <User className="h-4 w-4 mr-2" />
            Manage Collaborators
          </Button>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold text-foreground">Advanced Settings</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Form Settings
          </Button>
          
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Globe className="h-4 w-4 mr-2" />
            Custom Domain
          </Button>
          
          <Button variant="outline" size="sm" className="w-full justify-start">
            <FileStack className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </CardContent>
      </Card>
    </div>;
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
        
        {/* Settings Dropdown */}
        <div className="relative flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setShowLayoutControls(!showLayoutControls)} className="h-8 w-8 p-0">
            <Settings2 className="h-4 w-4" />
          </Button>
          
          {showLayoutControls && <div className="absolute top-full right-0 mt-2 bg-white border border-border rounded-lg shadow-lg p-4 z-50 min-w-[250px]">
              <div className="space-y-4">
                <div>
                  <Label className="block mb-2 text-sm font-medium">Column Layout</Label>
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
            </div>}
        </div>
      </div>
      
      {/* Page Info */}
      
    </div>;
}