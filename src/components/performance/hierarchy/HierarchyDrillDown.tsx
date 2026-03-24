import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Layers, FolderTree, AlertCircle, RefreshCw } from 'lucide-react';
import { useHierarchyDetection, HierarchyLevel, HierarchyRecord } from '@/hooks/useHierarchyData';
import { useHierarchyFormGenerator } from '@/hooks/useHierarchyFormGenerator';
import { HierarchyBreadcrumb, BreadcrumbItem } from './HierarchyBreadcrumb';
import { HierarchyLevelView } from './HierarchyLevelView';
import { useQueryClient } from '@tanstack/react-query';

interface DrillDownState {
  currentLevel: number; // 0 = portfolio, 1 = projects, 2 = wbs, etc.
  breadcrumb: BreadcrumbItem[];
  parentSubmissionId?: string;
}

export function HierarchyDrillDown() {
  const queryClient = useQueryClient();
  const { data: levels, isLoading: detectingHierarchy, refetch: refetchHierarchy } = useHierarchyDetection();
  const { generateHierarchyForms, generating } = useHierarchyFormGenerator();

  const [drillState, setDrillState] = useState<DrillDownState>({
    currentLevel: 1, // Start at projects level
    breadcrumb: [{ level: 1, label: 'Projects' }],
    parentSubmissionId: undefined,
  });

  // Map from level number to HierarchyLevel
  const levelMap = useMemo(() => {
    if (!levels) return new Map<number, HierarchyLevel>();
    return new Map(levels.map(l => [l.level, l]));
  }, [levels]);

  const currentHierarchyLevel = levelMap.get(drillState.currentLevel) || null;
  const hasChildren = drillState.currentLevel < 5;

  const handleDrillDown = useCallback((record: HierarchyRecord) => {
    const nextLevel = drillState.currentLevel + 1;
    const nextLevelDef = levelMap.get(nextLevel);
    if (!nextLevelDef) return;

    // Get display label for breadcrumb
    const nameFieldId = levelMap.get(drillState.currentLevel)?.nameFieldId;
    const recordLabel = nameFieldId ? String(record.data[nameFieldId] || record.submissionRefId) : record.submissionRefId;

    setDrillState(prev => ({
      currentLevel: nextLevel,
      breadcrumb: [
        ...prev.breadcrumb,
        { level: nextLevel, label: nextLevelDef.name, recordId: record.id, recordLabel },
      ],
      parentSubmissionId: record.id,
    }));
  }, [drillState.currentLevel, levelMap]);

  const handleBreadcrumbNavigate = useCallback((targetLevel: number) => {
    if (targetLevel === 0) {
      // Back to portfolio (projects level)
      setDrillState({
        currentLevel: 1,
        breadcrumb: [{ level: 1, label: 'Projects' }],
        parentSubmissionId: undefined,
      });
      return;
    }

    setDrillState(prev => {
      const breadcrumbIndex = prev.breadcrumb.findIndex(b => b.level === targetLevel);
      if (breadcrumbIndex === -1) return prev;

      const newBreadcrumb = prev.breadcrumb.slice(0, breadcrumbIndex + 1);
      const parentItem = breadcrumbIndex > 0 ? prev.breadcrumb[breadcrumbIndex - 1] : undefined;

      return {
        currentLevel: targetLevel,
        breadcrumb: newBreadcrumb,
        parentSubmissionId: parentItem?.recordId,
      };
    });
  }, []);

  const handleGenerateForms = async () => {
    const result = await generateHierarchyForms();
    if (result) {
      queryClient.invalidateQueries({ queryKey: ['hierarchy-detection'] });
      refetchHierarchy();
    }
  };

  // Loading state
  if (detectingHierarchy) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Detecting hierarchy forms...</span>
      </div>
    );
  }

  // No hierarchy forms detected - show setup
  if (!levels || levels.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <FolderTree className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Set Up Project Hierarchy</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            Create the 5-level hierarchy structure (Projects → WBS → Activities → Tasks → Resources) 
            with linked forms and cross-references.
          </p>
          <div className="flex items-center gap-3 mb-6">
            {['Projects', 'WBS', 'Activities', 'Tasks', 'Resources'].map((name, i) => (
              <React.Fragment key={name}>
                {i > 0 && <span className="text-muted-foreground/40">→</span>}
                <Badge variant="outline" className="text-xs">{name}</Badge>
              </React.Fragment>
            ))}
          </div>
          <Button onClick={handleGenerateForms} disabled={generating} size="lg" className="gap-2">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Forms...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Hierarchy Forms
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            This will create 5 forms in your current project with all fields and cross-references.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <HierarchyBreadcrumb
          items={drillState.breadcrumb}
          onNavigate={handleBreadcrumbNavigate}
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['hierarchy-records'] })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Level View */}
      {currentHierarchyLevel && (
        <HierarchyLevelView
          level={currentHierarchyLevel}
          parentSubmissionId={drillState.parentSubmissionId}
          onDrillDown={handleDrillDown}
          hasChildren={hasChildren}
        />
      )}
    </div>
  );
}
