
import React, { useState, useEffect, useRef } from 'react';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const canGoPrevious = currentPageIndex > 0;
  const canGoNext = currentPageIndex < pages.length - 1;

  // Auto-scroll to keep active page centered
  useEffect(() => {
    if (scrollContainerRef.current && currentPageId) {
      const activePageElement = scrollContainerRef.current.querySelector(`[data-page-id="${currentPageId}"]`);
      if (activePageElement) {
        const container = scrollContainerRef.current;
        const containerWidth = container.clientWidth;
        const elementRect = activePageElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate relative position within the container
        const elementLeft = elementRect.left - containerRect.left + container.scrollLeft;
        const elementWidth = elementRect.width;
        
        // Calculate the scroll position to center the element
        const targetScrollLeft = elementLeft + (elementWidth / 2) - (containerWidth / 2);
        
        // Smooth scroll to the calculated position
        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'smooth'
        });
      }
    }
  }, [currentPageId]);

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
    <div className="w-full">
      {/* Full-width scrollable page tabs */}
      <div className="flex items-center gap-2 w-full">
        {/* Left navigation arrow */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => handleNavigation(e, onPrevious)}
          disabled={!canGoPrevious}
          className="h-8 w-8 p-0 flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Scrollable page container */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-1 min-w-max pb-2">
            {pages.map((page, index) => (
              <div key={page.id} data-page-id={page.id} className="flex items-center group">
                {editingPageId === page.id && !readOnly ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-7 text-sm w-24"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={handleSaveEdit} className="h-7 w-7 p-0">
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant={currentPageId === page.id ? "default" : "ghost"}
                      size="sm"
                      onClick={(e) => handlePageClick(e, page.id)}
                      className="h-8 px-3 text-sm whitespace-nowrap"
                    >
                      {page.name}
                    </Button>
                    {!readOnly && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-1">
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
        </div>

        {/* Right navigation arrow */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => handleNavigation(e, onNext)}
          disabled={!canGoNext}
          className="h-8 w-8 p-0 flex-shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Page indicator */}
      <div className="flex items-center justify-center mt-2">
        <span className="text-xs text-muted-foreground">
          Page {currentPageIndex + 1} of {pages.length}
        </span>
        {showSave && onSavePage && (
          <Button type="button" variant="outline" size="sm" onClick={onSavePage} className="ml-4">
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
