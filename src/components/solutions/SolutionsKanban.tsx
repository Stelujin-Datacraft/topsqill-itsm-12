import { useTranslation } from 'react-i18next';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { FileText, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  columnIdToSolutionId,
  solutionColor,
  unassignedColor,
  type SolutionColumn,
} from '@/lib/solutions/solutionBoard';

interface KanbanForm {
  id: string;
  name: string;
  status?: string;
}

interface SolutionsKanbanProps<F extends KanbanForm> {
  columns: SolutionColumn<F>[];
  canManage: boolean;
  onMove: (formId: string, toSolutionId: string | null) => void;
  onOpenSolution: (solutionId: string) => void;
  onOpenForm: (formId: string) => void;
}

/** Each solution is a column; drag a form card to move it to another solution. */
export function SolutionsKanban<F extends KanbanForm>({
  columns,
  canManage,
  onMove,
  onOpenSolution,
  onOpenForm,
}: SolutionsKanbanProps<F>) {
  const { t } = useTranslation();

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    onMove(draggableId, columnIdToSolutionId(destination.droppableId));
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const color = column.solution ? solutionColor(column.solution.color) : unassignedColor();
          return (
            <div
              key={column.id}
              className={cn('flex w-72 shrink-0 flex-col rounded-lg border-2', color.column)}
            >
              <button
                type="button"
                disabled={!column.solution}
                onClick={() => column.solution && onOpenSolution(column.solution.id)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-t-md px-3 py-2.5 text-left font-semibold',
                  color.header,
                  column.solution && 'hover:opacity-90',
                )}
                title={column.solution ? t('solutions.openSolution', 'Open solution') : undefined}
              >
                <span className="truncate">
                  {column.solution ? column.solution.name : t('solutions.unassigned', 'Not in a solution')}
                </span>
                <span className="shrink-0 rounded-full bg-black/15 px-2 text-xs">{column.forms.length}</span>
              </button>
              <Droppable droppableId={column.id} isDropDisabled={!canManage}>
                {(dropProvided, dropSnapshot) => (
                  <div
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                    className={cn(
                      'min-h-[320px] flex-1 space-y-2 p-2 transition-colors',
                      dropSnapshot.isDraggingOver && 'bg-primary/10',
                    )}
                  >
                    {column.forms.length === 0 && !dropSnapshot.isDraggingOver && (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                        {canManage
                          ? t('solutions.dropHere', 'Drag forms here')
                          : t('solutions.noForms', 'No forms')}
                      </p>
                    )}
                    {column.forms.map((form, index) => (
                      <Draggable key={form.id} draggableId={form.id} index={index} isDragDisabled={!canManage}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              'group flex items-center gap-2 rounded-md border bg-card p-2.5 shadow-sm',
                              dragSnapshot.isDragging && 'ring-2 ring-primary shadow-lg',
                            )}
                          >
                            {canManage && (
                              <span
                                {...dragProvided.dragHandleProps}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={t('solutions.dragToMove', 'Drag to move')}
                              >
                                <GripVertical className="h-4 w-4" />
                              </span>
                            )}
                            <FileText className="h-4 w-4 shrink-0 text-module-forms" />
                            <button
                              type="button"
                              onClick={() => onOpenForm(form.id)}
                              className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                              title={form.name}
                            >
                              {form.name}
                            </button>
                            {form.status && (
                              <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                                {form.status.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {dropProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
