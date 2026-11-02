export interface Solution {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  description: string | null;
  color: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SolutionFormLink {
  id?: string;
  solution_id: string;
  form_id: string;
}

export interface SolutionColor {
  key: string;
  label: string;
  dot: string;
  header: string;
  column: string;
}

export const SOLUTION_COLORS: readonly SolutionColor[] = [
  { key: 'teal', label: 'Teal', dot: 'bg-teal-500', header: 'bg-teal-600 text-white', column: 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-900' },
  { key: 'blue', label: 'Blue', dot: 'bg-blue-500', header: 'bg-blue-600 text-white', column: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900' },
  { key: 'violet', label: 'Violet', dot: 'bg-violet-500', header: 'bg-violet-600 text-white', column: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900' },
  { key: 'amber', label: 'Amber', dot: 'bg-amber-500', header: 'bg-amber-500 text-white', column: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' },
  { key: 'rose', label: 'Rose', dot: 'bg-rose-500', header: 'bg-rose-600 text-white', column: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900' },
  { key: 'emerald', label: 'Green', dot: 'bg-emerald-500', header: 'bg-emerald-600 text-white', column: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900' },
  { key: 'slate', label: 'Slate', dot: 'bg-slate-500', header: 'bg-slate-600 text-white', column: 'bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800' },
];

export const UNASSIGNED_COLUMN_ID = 'unassigned';

const UNASSIGNED_COLOR: SolutionColor = {
  key: 'none',
  label: 'None',
  dot: 'bg-muted-foreground',
  header: 'bg-muted text-foreground',
  column: 'bg-muted/40 border-border',
};

export function solutionColor(key: string | null | undefined): SolutionColor {
  return SOLUTION_COLORS.find((color) => color.key === key) || SOLUTION_COLORS[0];
}

export function unassignedColor(): SolutionColor {
  return UNASSIGNED_COLOR;
}

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

/** form id -> solution id, ignoring links to solutions that are not loaded. */
export function solutionIdByForm(solutions: Solution[], links: SolutionFormLink[]): Map<string, string> {
  const known = new Set(solutions.map((solution) => solution.id));
  const map = new Map<string, string>();
  for (const link of links) {
    if (known.has(link.solution_id)) map.set(link.form_id, link.solution_id);
  }
  return map;
}

export interface SolutionColumn<F> {
  id: string;
  solution: Solution | null;
  forms: F[];
}

/** One column per solution (by name), then forms that are in no solution. */
export function groupFormsBySolution<F extends { id: string; name: string }>(
  solutions: Solution[],
  links: SolutionFormLink[],
  forms: F[],
): SolutionColumn<F>[] {
  const owner = solutionIdByForm(solutions, links);
  const columns: SolutionColumn<F>[] = [...solutions].sort(byName).map((solution) => ({
    id: solution.id,
    solution,
    forms: [],
  }));
  const byId = new Map(columns.map((column) => [column.id, column]));
  const unassigned: SolutionColumn<F> = { id: UNASSIGNED_COLUMN_ID, solution: null, forms: [] };
  for (const form of forms) {
    const solutionId = owner.get(form.id);
    (solutionId ? byId.get(solutionId)! : unassigned).forms.push(form);
  }
  for (const column of [...columns, unassigned]) column.forms.sort(byName);
  return [...columns, unassigned];
}

/**
 * Solutions carry no permissions of their own: they follow form access.
 * Without manage rights a user only sees columns that hold a form they can see
 * (pass columns built from the forms visible to that user).
 */
export function columnsVisibleToViewer<F>(columns: SolutionColumn<F>[], canManage: boolean): SolutionColumn<F>[] {
  return canManage ? columns : columns.filter((column) => column.forms.length > 0);
}

/** Header checkbox state for "select every form in this group". */
export function groupSelectionState(ids: string[], isSelected: (id: string) => boolean): boolean | 'indeterminate' {
  const selected = ids.filter(isSelected).length;
  if (selected === 0) return false;
  return selected === ids.length ? true : 'indeterminate';
}

export type FormMove =
  | { kind: 'none' }
  | { kind: 'assign'; formId: string; solutionId: string }
  | { kind: 'unassign'; formId: string };

/** What has to change to put a form in `toSolutionId` (null = no solution). */
export function planFormMove(formId: string, currentSolutionId: string | null | undefined, toSolutionId: string | null): FormMove {
  const from = currentSolutionId || null;
  if (from === toSolutionId) return { kind: 'none' };
  if (toSolutionId === null) return { kind: 'unassign', formId };
  return { kind: 'assign', formId, solutionId: toSolutionId };
}

export function applyFormMove(links: SolutionFormLink[], move: FormMove): SolutionFormLink[] {
  if (move.kind === 'none') return links;
  const others = links.filter((link) => link.form_id !== move.formId);
  if (move.kind === 'unassign') return others;
  const existing = links.find((link) => link.form_id === move.formId);
  return [...others, { ...existing, solution_id: move.solutionId, form_id: move.formId }];
}

export function columnIdToSolutionId(columnId: string): string | null {
  return columnId === UNASSIGNED_COLUMN_ID ? null : columnId;
}

/** Returns an error message, or null when the name can be used. */
export function solutionNameError(name: string, solutions: Solution[], editingId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a solution name.';
  if (trimmed.length > 120) return 'Use 120 characters or fewer.';
  const clash = solutions.find(
    (solution) => solution.id !== editingId && solution.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  return clash ? `A solution named "${clash.name}" already exists in this project.` : null;
}
