import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { BookmarkPlus, Play, Trash2, Clock, ChevronDown } from 'lucide-react';
import { useSavedFilters, SavedFilter } from '@/hooks/useSavedFilters';
import { FilterGroup } from './TableFiltersPanel';

interface SavedFiltersManagerProps {
  formId: string | null;
  onApplyFilter: (filters: FilterGroup[]) => void;
  currentFilters: FilterGroup[];
}

export function SavedFiltersManager({ 
  formId, 
  onApplyFilter, 
  currentFilters 
}: SavedFiltersManagerProps) {
  const { savedFilters, loading, error, deleteFilter } = useSavedFilters(formId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [filterToDelete, setFilterToDelete] = useState<SavedFilter | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleApplyFilter = (filter: SavedFilter) => {
    onApplyFilter(filter.filter_data);
    setIsOpen(false);
  };

  const handleDeleteClick = (filter: SavedFilter) => {
    setFilterToDelete(filter);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (filterToDelete) {
      await deleteFilter(filterToDelete.id);
      setDeleteDialogOpen(false);
      setFilterToDelete(null);
    }
  };

  const getTotalConditions = (filterData: FilterGroup[]) => {
    return filterData.reduce((total, group) => total + group.conditions.length, 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!formId) return null;

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Saved Filters
            {savedFilters.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {savedFilters.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Saved Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Loading saved filters...
                </div>
              ) : error ? (
                <div className="text-center py-4 text-sm text-destructive">
                  Error: {error}
                </div>
              ) : savedFilters.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <BookmarkPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No saved filters</p>
                  <p className="text-xs">Create filters and save them for quick access</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {savedFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate text-sm">
                            {filter.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {filter.filter_data.length} group{filter.filter_data.length !== 1 ? 's' : ''}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {getTotalConditions(filter.filter_data)} condition{getTotalConditions(filter.filter_data) !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(filter.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => handleApplyFilter(filter)}
                          className="flex-1"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteClick(filter)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Filter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the filter "{filterToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete Filter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}