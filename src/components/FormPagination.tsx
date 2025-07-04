
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronLeft, ChevronRight, Save, Edit2, Trash2, Check, X } from 'lucide-react';
import { FormPage } from '@/types/form';

interface FormPaginationProps {
  pages: FormPage[];
  currentPageId: string;
  currentPageIndex: number;
  onPageChange: (pageId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSavePage?: () => void;
  showSave?: boolean;
  onPageRename?: (pageId: string, newName: string) => void;
  onPageDelete?: (pageId: string) => void;
  readOnly?: boolean;
}

export function FormPagination({
  pages,
  currentPageId,
  currentPageIndex,
  onPageChange,
  onPrevious,
  onNext,
  onSavePage,
  showSave = false,
  onPageRename,
  onPageDelete,
  readOnly = false
}: FormPaginationProps) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const canGoPrevious = currentPageIndex > 0;
  const canGoNext = currentPageIndex < pages.length - 1;

  const handleStartEdit = (page: FormPage) => {
    if (readOnly) return;
    setEditingPageId(page.id);
    setEditingName(page.name);
  };

  const handleSaveEdit = async () => {
    if (editingPageId && onPageRename && editingName.trim()) {
      try {
        await onPageRename(editingPageId, editingName.trim());
        setEditingPageId(null);
        setEditingName('');
      } catch (error) {
        console.error('Error renaming page:', error);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingPageId(null);
    setEditingName('');
  };

  const handleDeletePage = async (pageId: string) => {
    if (readOnly || !onPageDelete || pages.length <= 1) return;
    try {
      await onPageDelete(pageId);
    } catch (error) {
      console.error('Error deleting page:', error);
    }
  };

  const handlePageClick = (e: React.MouseEvent, pageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onPageChange(pageId);
  };

  const handleNavigation = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <div className="space-y-6">
      {/* Page Tabs */}
      <div className="flex flex-wrap gap-2 border-b">
        {pages.map((page, index) => (
          <div key={page.id} className="flex items-center group">
            {editingPageId === page.id && !readOnly ? (
              <div className="flex items-center gap-1 px-2 py-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-6 text-sm w-24"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={handleSaveEdit} className="h-6 w-6 p-0">
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-6 w-6 p-0">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={(e) => handlePageClick(e, page.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    currentPageId === page.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  {page.name}
                </button>
                {!readOnly && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(page)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    {pages.length > 1 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Page</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{page.name}"? This action cannot be undone and all fields on this page will be moved to the first page.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePage(page.id)}>
                              Delete Page
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={(e) => handleNavigation(e, onPrevious)}
          disabled={!canGoPrevious}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {showSave && onSavePage && (
            <Button type="button" variant="outline" onClick={onSavePage}>
              <Save className="h-4 w-4 mr-2" />
              Save Page
            </Button>
          )}
          
          <span className="text-sm text-muted-foreground">
            Page {currentPageIndex + 1} of {pages.length}
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={(e) => handleNavigation(e, onNext)}
          disabled={!canGoNext}
          className="flex items-center gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
