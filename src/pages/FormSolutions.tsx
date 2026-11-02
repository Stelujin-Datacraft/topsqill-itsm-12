import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Boxes,
  Columns,
  FileText,
  Grid,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  FolderInput,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import NoProjectSelected from '@/components/NoProjectSelected';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SolutionDialog } from '@/components/solutions/SolutionDialog';
import { AddFormsDialog } from '@/components/solutions/AddFormsDialog';
import { DeleteSolutionDialog } from '@/components/solutions/DeleteSolutionDialog';
import { SolutionsKanban } from '@/components/solutions/SolutionsKanban';
import { useProject } from '@/contexts/ProjectContext';
import { useFormsData } from '@/hooks/useFormsData';
import { useSolutions } from '@/hooks/useSolutions';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { cn } from '@/lib/utils';
import {
  groupFormsBySolution,
  solutionColor,
  UNASSIGNED_COLUMN_ID,
  type Solution,
} from '@/lib/solutions/solutionBoard';

type ViewMode = 'grid' | 'list' | 'kanban';
const VIEW_STORAGE_KEY = 'solutions-view-mode';
const PREVIEW_FORMS = 4;

function initialViewMode(): ViewMode {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem(VIEW_STORAGE_KEY) : null;
  return saved === 'list' || saved === 'kanban' ? saved : 'grid';
}

const Solutions = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { forms, loading: formsLoading } = useFormsData();
  const { getVisibleResources, hasPermission, isOrgAdmin, isProjectAdmin } = useUnifiedAccessControl();
  const {
    solutions,
    links,
    formSolutionIds,
    loading,
    error,
    createSolution,
    updateSolution,
    deleteSolution,
    moveForm,
    moveForms,
  } = useSolutions();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Solution | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<Solution | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Solution | null>(null);

  const canManage = isOrgAdmin || isProjectAdmin || hasPermission('forms', 'update');
  const visibleForms = useMemo(() => getVisibleResources('forms', forms), [getVisibleResources, forms]);
  const columns = useMemo(
    () => groupFormsBySolution(solutions, links, visibleForms),
    [solutions, links, visibleForms],
  );
  const unassignedCount = columns.find((column) => column.id === UNASSIGNED_COLUMN_ID)?.forms.length ?? 0;
  const term = query.trim().toLowerCase();
  const solutionColumns = columns.filter(
    (column) =>
      column.solution &&
      (!term ||
        column.solution.name.toLowerCase().includes(term) ||
        (column.solution.description || '').toLowerCase().includes(term) ||
        column.forms.some((form) => form.name.toLowerCase().includes(term))),
  );
  const kanbanColumns = term
    ? columns.map((column) => ({ ...column, forms: column.forms.filter((form) => form.name.toLowerCase().includes(term)) }))
    : columns;

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (solution: Solution) => {
    setEditing(solution);
    setDialogOpen(true);
  };

  const handleMove = (formId: string, toSolutionId: string | null) => {
    moveForm(formId, toSolutionId).catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
  };

  if (!currentProject) {
    return (
      <DashboardLayout title={t('solutions.title', 'Solutions')}>
        <NoProjectSelected />
      </DashboardLayout>
    );
  }

  const actions = canManage ? (
    <Button onClick={openCreate}>
      <Plus className="icon-md me-2" />
      {t('solutions.new', 'New solution')}
    </Button>
  ) : null;

  const solutionMenu = (solution: Solution) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={t('solutions.actions', 'Solution actions')}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate(`/form-solutions/${solution.id}`)}>
          <Boxes className="me-2 h-4 w-4" />
          {t('solutions.openSolution', 'Open solution')}
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuItem onClick={() => setAddTarget(solution)}>
              <FolderInput className="me-2 h-4 w-4" />
              {t('solutions.addForms', 'Add forms')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEdit(solution)}>
              <Pencil className="me-2 h-4 w-4" />
              {t('solutions.edit', 'Edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(solution)}>
              <Trash2 className="me-2 h-4 w-4" />
              {t('solutions.delete', 'Delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const formChips = (formsInSolution: { id: string; name: string }[]) => (
    <div className="flex flex-wrap gap-1.5">
      {formsInSolution.slice(0, PREVIEW_FORMS).map((form) => (
        <Badge key={form.id} variant="secondary" className="max-w-[12rem] truncate font-normal">
          {form.name}
        </Badge>
      ))}
      {formsInSolution.length > PREVIEW_FORMS && (
        <Badge variant="outline" className="font-normal">
          {t('solutions.more', '+{{count}} more', { count: formsInSolution.length - PREVIEW_FORMS })}
        </Badge>
      )}
    </div>
  );

  const formCount = (count: number) => t('solutions.formCount', '{{count}} form(s)', { count });

  const renderGrid = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {solutionColumns.map(({ solution, forms: inSolution }) => (
        <Card
          key={solution!.id}
          className="enterprise-card group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
          onClick={() => navigate(`/form-solutions/${solution!.id}`)}
        >
          <div className={cn('h-1.5', solutionColor(solution!.color).dot)} />
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{solution!.name}</h3>
                <p className="text-sm text-muted-foreground">{formCount(inSolution.length)}</p>
              </div>
              <div onClick={(event) => event.stopPropagation()}>{solutionMenu(solution!)}</div>
            </div>
            {solution!.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground">{solution!.description}</p>
            )}
            {inSolution.length > 0 ? (
              formChips(inSolution)
            ) : (
              <p className="text-sm italic text-muted-foreground">{t('solutions.empty', 'No forms yet')}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="space-y-3">
      {solutionColumns.map(({ solution, forms: inSolution }) => (
        <Card
          key={solution!.id}
          className="enterprise-card cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => navigate(`/form-solutions/${solution!.id}`)}
        >
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className={cn('mt-1.5 h-3 w-3 shrink-0 rounded-full', solutionColor(solution!.color).dot)} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="truncate text-base font-semibold">{solution!.name}</h3>
                  <span className="text-sm text-muted-foreground">{formCount(inSolution.length)}</span>
                </div>
                {solution!.description && (
                  <p className="line-clamp-1 text-sm text-muted-foreground">{solution!.description}</p>
                )}
                {inSolution.length > 0 && formChips(inSolution)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setAddTarget(solution!)}>
                  <FolderInput className="me-1.5 h-4 w-4" />
                  {t('solutions.addForms', 'Add forms')}
                </Button>
              )}
              {solutionMenu(solution!)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderBody = () => {
    if (loading || formsLoading) return <LoadingScreen message={t('solutions.loading', 'Loading solutions…')} />;
    if (error) {
      return (
        <div className="py-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">{t('solutions.loadFailed', 'Solutions could not be loaded')}</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      );
    }
    if (solutions.length === 0) {
      return (
        <div className="space-y-4 py-12 text-center">
          <Boxes className="mx-auto h-12 w-12 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">{t('solutions.noneTitle', 'No solutions yet')}</h3>
            <p className="mx-auto max-w-md text-muted-foreground">
              {t('solutions.noneDescription', 'Create a solution to group related forms, then add forms to it or drag them between solutions.')}
            </p>
          </div>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              {t('solutions.new', 'New solution')}
            </Button>
          )}
        </div>
      );
    }
    if (viewMode === 'kanban') {
      return (
        <SolutionsKanban
          columns={kanbanColumns}
          canManage={canManage}
          onMove={handleMove}
          onOpenSolution={(id) => navigate(`/form-solutions/${id}`)}
          onOpenForm={(id) => navigate(`/form-submissions?formId=${id}`)}
        />
      );
    }
    if (solutionColumns.length === 0) {
      return <p className="py-12 text-center text-muted-foreground">{t('solutions.noMatches', 'No solutions match your search.')}</p>;
    }
    return viewMode === 'grid' ? renderGrid() : renderList();
  };

  return (
    <DashboardLayout
      title={t('solutions.title', 'Solutions')}
      description={t('solutions.description', 'Group related forms into solutions and move forms between them.')}
      actions={actions}
    >
      <div className="smart-panel space-y-5 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => changeView('grid')}>
              <Grid className="me-1 h-4 w-4" />
              {t('forms.gridView', 'Grid')}
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => changeView('list')}>
              <List className="me-1 h-4 w-4" />
              {t('forms.listView', 'List')}
            </Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => changeView('kanban')}>
              <Columns className="me-1 h-4 w-4" />
              {t('solutions.kanbanView', 'Kanban')}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {!loading && !error && solutions.length > 0 && (
              <span className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {t('solutions.unassignedCount', '{{count}} form(s) not in a solution', { count: unassignedCount })}
              </span>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('solutions.search', 'Search solutions or forms')}
                className="pl-9"
              />
            </div>
          </div>
        </div>
        {viewMode === 'kanban' && canManage && solutions.length > 0 && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            {t('solutions.kanbanHint', 'Drag a form to another column to move it to that solution.')}
          </p>
        )}
        {renderBody()}
      </div>

      <SolutionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        solution={editing}
        solutions={solutions}
        onSave={async (input) => {
          if (editing) {
            await updateSolution(editing.id, input);
            toast.success(t('solutions.saved', 'Solution saved'));
          } else {
            const created = await createSolution(input);
            toast.success(t('solutions.created', 'Solution "{{name}}" created', { name: created.name }));
          }
        }}
      />
      {addTarget && (
        <AddFormsDialog
          open={!!addTarget}
          onOpenChange={(open) => !open && setAddTarget(null)}
          target={addTarget}
          forms={visibleForms}
          solutions={solutions}
          formSolutionIds={formSolutionIds}
          onAdd={(formIds) => moveForms(formIds, addTarget.id)}
        />
      )}
      <DeleteSolutionDialog
        solution={deleteTarget}
        formCount={deleteTarget ? links.filter((link) => link.solution_id === deleteTarget.id).length : 0}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteSolution(deleteTarget.id);
          toast.success(t('solutions.deleted', 'Solution deleted'));
        }}
      />
    </DashboardLayout>
  );
};

export default Solutions;
