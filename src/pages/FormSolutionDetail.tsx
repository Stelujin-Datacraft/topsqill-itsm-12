import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Columns,
  Database,
  Edit,
  FileText,
  FolderInput,
  Grid,
  List,
  MinusCircle,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddFormsDialog } from '@/components/solutions/AddFormsDialog';
import { DeleteSolutionDialog } from '@/components/solutions/DeleteSolutionDialog';
import { SolutionDialog } from '@/components/solutions/SolutionDialog';
import { useProject } from '@/contexts/ProjectContext';
import { useFormsData } from '@/hooks/useFormsData';
import { useSolutions } from '@/hooks/useSolutions';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { cn } from '@/lib/utils';
import { solutionColor } from '@/lib/solutions/solutionBoard';
import type { Form } from '@/types/form';

type ViewMode = 'grid' | 'list' | 'kanban';

const STATUS_COLUMNS: Array<{ key: Form['status']; className: string }> = [
  { key: 'draft', className: 'bg-amber-500' },
  { key: 'active', className: 'bg-emerald-500' },
  { key: 'pending_review', className: 'bg-orange-500' },
  { key: 'in_progress', className: 'bg-purple-500' },
  { key: 'approved', className: 'bg-green-600' },
  { key: 'completed', className: 'bg-blue-500' },
  { key: 'rejected', className: 'bg-red-500' },
  { key: 'archived', className: 'bg-gray-500' },
];

const SolutionDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { forms, loading: formsLoading } = useFormsData();
  const { getVisibleResources, hasPermission, isOrgAdmin, isProjectAdmin } = useUnifiedAccessControl();
  const {
    solutions,
    formSolutionIds,
    loading,
    error,
    updateSolution,
    deleteSolution,
    moveForm,
    moveForms,
  } = useSolutions();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canManage = isOrgAdmin || isProjectAdmin || hasPermission('forms', 'update');
  const loadedSolution = solutions.find((item) => item.id === id) || null;
  const visibleForms = useMemo(() => getVisibleResources('forms', forms), [getVisibleResources, forms]);
  const solutionForms = useMemo(
    () =>
      visibleForms
        .filter((form) => formSolutionIds.get(form.id) === id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [visibleForms, formSolutionIds, id],
  );
  const solution = loadedSolution && (canManage || solutionForms.length > 0) ? loadedSolution : null;
  const otherSolutions = solutions.filter((item) => item.id !== id).sort((a, b) => a.name.localeCompare(b.name));

  const statusLabel = (status: string) => t(`forms.status.${status}`, status.replace('_', ' '));
  const formatDate = (value?: string) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? format(date, 'MMM d, yyyy') : '';
  };

  const move = (formId: string, toSolutionId: string | null, successMessage: string) => {
    moveForm(formId, toSolutionId)
      .then(() => toast.success(successMessage))
      .catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
  };

  if (!currentProject) {
    return (
      <DashboardLayout title={t('solutions.title', 'Solutions')}>
        <NoProjectSelected />
      </DashboardLayout>
    );
  }

  if (loading || formsLoading) {
    return (
      <DashboardLayout title={t('solutions.title', 'Solutions')}>
        <LoadingScreen message={t('solutions.loading', 'Loading solutions…')} />
      </DashboardLayout>
    );
  }

  if (error || !solution) {
    return (
      <DashboardLayout title={t('solutions.title', 'Solutions')}>
        <div className="space-y-4 py-12 text-center">
          <h3 className="text-lg font-semibold">
            {error ? t('solutions.loadFailed', 'Solutions could not be loaded') : t('solutions.notFound', 'Solution not found')}
          </h3>
          <p className="text-muted-foreground">
            {error || t('solutions.notFoundDescription', 'It may have been deleted, or it belongs to another project.')}
          </p>
          <Button variant="outline" onClick={() => navigate('/form-solutions')}>
            <ArrowLeft className="me-2 h-4 w-4" />
            {t('solutions.back', 'Back to solutions')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const formMenu = (form: Form) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={t('solutions.formActions', 'Form actions')}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate(`/form-submissions?formId=${form.id}`)}>
          <Database className="me-2 h-4 w-4" />
          {t('forms.viewRecords', 'View records')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/form/${form.id}`)}>
          <Plus className="me-2 h-4 w-4" />
          {t('forms.addRecord', 'Add record')}
        </DropdownMenuItem>
        {hasPermission('forms', 'update', form.id) && (
          <DropdownMenuItem onClick={() => navigate(`/form-builder/${form.id}`)}>
            <Edit className="me-2 h-4 w-4" />
            {t('forms.editForm', 'Edit form')}
          </DropdownMenuItem>
        )}
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={otherSolutions.length === 0}>
                <ArrowRightLeft className="me-2 h-4 w-4" />
                {t('solutions.moveTo', 'Move to solution')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                <DropdownMenuLabel>{t('solutions.moveTo', 'Move to solution')}</DropdownMenuLabel>
                {otherSolutions.map((other) => (
                  <DropdownMenuItem
                    key={other.id}
                    onClick={() =>
                      move(form.id, other.id, t('solutions.moved', '"{{form}}" moved to {{name}}', { form: form.name, name: other.name }))
                    }
                  >
                    <span className={cn('me-2 h-2.5 w-2.5 rounded-full', solutionColor(other.color).dot)} />
                    <span className="truncate">{other.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              onClick={() =>
                move(form.id, null, t('solutions.removed', '"{{form}}" removed from {{name}}', { form: form.name, name: solution.name }))
              }
            >
              <MinusCircle className="me-2 h-4 w-4" />
              {t('solutions.removeFromSolution', 'Remove from solution')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const statusBadge = (form: Form) => (
    <Badge variant="outline" className="capitalize">
      {statusLabel(form.status)}
    </Badge>
  );

  const renderGrid = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {solutionForms.map((form) => (
        <Card key={form.id} className="enterprise-card transition-shadow hover:shadow-md">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => navigate(`/form-submissions?formId=${form.id}`)}
              >
                <h3 className="truncate text-base font-semibold hover:underline">{form.name}</h3>
              </button>
              {formMenu(form)}
            </div>
            {form.description && <p className="line-clamp-2 text-sm text-muted-foreground">{form.description}</p>}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(form.createdAt)}
              </span>
              {statusBadge(form)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="space-y-3">
      {solutionForms.map((form) => (
        <Card key={form.id} className="enterprise-card transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <FileText className="h-7 w-7 shrink-0 text-module-forms" />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => navigate(`/form-submissions?formId=${form.id}`)}
            >
              <h3 className="truncate font-semibold hover:underline">{form.name}</h3>
              {form.description && <p className="line-clamp-1 text-sm text-muted-foreground">{form.description}</p>}
            </button>
            <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
              <Calendar className="h-3 w-3" />
              {formatDate(form.createdAt)}
            </span>
            {statusBadge(form)}
            {formMenu(form)}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderKanban = () => {
    const columns = STATUS_COLUMNS.map((column) => ({
      ...column,
      forms: solutionForms.filter((form) => form.status === column.key),
    })).filter((column) => column.forms.length > 0 || column.key === 'draft' || column.key === 'active');
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div key={column.key} className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
            <div className={cn('flex items-center justify-between rounded-t-lg px-3 py-2.5 font-semibold text-white', column.className)}>
              <span>{statusLabel(column.key)}</span>
              <span className="rounded-full bg-black/15 px-2 text-xs">{column.forms.length}</span>
            </div>
            <div className="min-h-[240px] space-y-2 p-2">
              {column.forms.map((form) => (
                <div key={form.id} className="flex items-center gap-2 rounded-md border bg-card p-2.5 shadow-sm">
                  <FileText className="h-4 w-4 shrink-0 text-module-forms" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                    onClick={() => navigate(`/form-submissions?formId=${form.id}`)}
                    title={form.name}
                  >
                    {form.name}
                  </button>
                  {formMenu(form)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const color = solutionColor(solution.color);
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate('/form-solutions')}>
        <ArrowLeft className="me-2 h-4 w-4" />
        {t('solutions.back', 'Back to solutions')}
      </Button>
      {canManage && (
        <>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <FolderInput className="me-2 h-4 w-4" />
            {t('solutions.addForms', 'Add forms')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="me-2 h-4 w-4" />
            {t('solutions.edit', 'Edit')}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="me-2 h-4 w-4" />
            {t('solutions.delete', 'Delete')}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <DashboardLayout title={solution.name} description={solution.description || undefined} actions={actions}>
      <div className="smart-panel space-y-5 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn('h-3 w-3 rounded-full', color.dot)} />
            {t('solutions.formCount', '{{count}} form(s)', { count: solutionForms.length })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')}>
              <Grid className="me-1 h-4 w-4" />
              {t('forms.gridView', 'Grid')}
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>
              <List className="me-1 h-4 w-4" />
              {t('forms.listView', 'List')}
            </Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('kanban')}>
              <Columns className="me-1 h-4 w-4" />
              {t('solutions.kanbanView', 'Kanban')}
            </Button>
          </div>
        </div>
        {solutionForms.length === 0 ? (
          <div className="space-y-4 py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('solutions.emptyDetail', 'This solution has no forms yet.')}</p>
            {canManage && (
              <Button onClick={() => setAddOpen(true)}>
                <FolderInput className="me-2 h-4 w-4" />
                {t('solutions.addForms', 'Add forms')}
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          renderGrid()
        ) : viewMode === 'list' ? (
          renderList()
        ) : (
          renderKanban()
        )}
      </div>

      <SolutionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        solution={solution}
        solutions={solutions}
        onSave={async (input) => {
          await updateSolution(solution.id, input);
          toast.success(t('solutions.saved', 'Solution saved'));
        }}
      />
      <AddFormsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        target={solution}
        forms={visibleForms}
        solutions={solutions}
        formSolutionIds={formSolutionIds}
        onAdd={(formIds) => moveForms(formIds, solution.id)}
      />
      <DeleteSolutionDialog
        solution={deleteOpen ? solution : null}
        formCount={solutionForms.length}
        onOpenChange={setDeleteOpen}
        onConfirm={async () => {
          await deleteSolution(solution.id);
          toast.success(t('solutions.deleted', 'Solution deleted'));
          navigate('/form-solutions');
        }}
      />
    </DashboardLayout>
  );
};

export default SolutionDetail;
