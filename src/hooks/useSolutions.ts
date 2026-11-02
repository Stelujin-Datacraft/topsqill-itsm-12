import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/services/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  applyFormMove,
  planFormMove,
  solutionIdByForm,
  type Solution,
  type SolutionFormLink,
} from '@/lib/solutions/solutionBoard';

export interface SolutionInput {
  name: string;
  description?: string;
  color: string;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    if (/solutions_project_name_key|duplicate key/i.test(error.message)) {
      return 'A solution with this name already exists in this project.';
    }
    if (/row-level security|permission denied|No rows were/i.test(error.message)) {
      return 'You do not have permission to change solutions in this project.';
    }
    if (/relation .*solution.* does not exist|Could not find the table/i.test(error.message)) {
      return 'Solutions are not set up in this database yet. Apply the solutions migration.';
    }
    return error.message;
  }
  return fallback;
}

export function useSolutions() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const organizationId = currentProject?.organization_id;
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [links, setLinks] = useState<SolutionFormLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadToken = useRef(0);

  const reload = useCallback(async () => {
    const token = ++loadToken.current;
    if (!projectId) {
      setSolutions([]);
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: solutionsError } = await backend
        .from('solutions')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });
      if (solutionsError) throw solutionsError;
      const rows = (data || []) as Solution[];
      let linkRows: SolutionFormLink[] = [];
      if (rows.length > 0) {
        const { data: linkData, error: linksError } = await backend
          .from('solution_forms')
          .select('id, solution_id, form_id')
          .in('solution_id', rows.map((row) => row.id));
        if (linksError) throw linksError;
        linkRows = (linkData || []) as SolutionFormLink[];
      }
      if (token !== loadToken.current) return;
      setSolutions(rows);
      setLinks(linkRows);
    } catch (err) {
      if (token !== loadToken.current) return;
      setError(errorMessage(err, 'Could not load solutions.'));
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const formSolutionIds = useMemo(() => solutionIdByForm(solutions, links), [solutions, links]);

  const createSolution = useCallback(async (input: SolutionInput): Promise<Solution> => {
    if (!projectId || !organizationId) throw new Error('Select a project first.');
    const { data, error: insertError } = await backend
      .from('solutions')
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        color: input.color,
      })
      .select()
      .single();
    if (insertError || !data) throw new Error(errorMessage(insertError, 'Could not create the solution.'));
    setSolutions((prev) => [...prev, data as Solution]);
    return data as Solution;
  }, [projectId, organizationId]);

  const updateSolution = useCallback(async (id: string, input: SolutionInput) => {
    const { data, error: updateError } = await backend
      .from('solutions')
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        color: input.color,
      })
      .eq('id', id)
      .select()
      .single();
    if (updateError || !data) throw new Error(errorMessage(updateError, 'Could not save the solution.'));
    setSolutions((prev) => prev.map((solution) => (solution.id === id ? (data as Solution) : solution)));
  }, []);

  const deleteSolution = useCallback(async (id: string) => {
    const { error: deleteError } = await backend.from('solutions').delete().eq('id', id);
    if (deleteError) throw new Error(errorMessage(deleteError, 'Could not delete the solution.'));
    setSolutions((prev) => prev.filter((solution) => solution.id !== id));
    setLinks((prev) => prev.filter((link) => link.solution_id !== id));
  }, []);

  /** Puts a form in a solution (moving it out of any other), or in none when `toSolutionId` is null. */
  const moveForm = useCallback(async (formId: string, toSolutionId: string | null) => {
    const move = planFormMove(formId, formSolutionIds.get(formId), toSolutionId);
    if (move.kind === 'none') return;
    const previous = links;
    setLinks((current) => applyFormMove(current, move));
    try {
      if (move.kind === 'unassign') {
        const { error: deleteError } = await backend
          .from('solution_forms')
          .delete()
          .eq('form_id', formId)
          .allowEmpty();
        if (deleteError) throw deleteError;
      } else {
        const { data, error: upsertError } = await backend
          .from('solution_forms')
          .upsert({ solution_id: move.solutionId, form_id: formId }, { onConflict: 'form_id' })
          .select('id, solution_id, form_id');
        if (upsertError) throw upsertError;
        const saved = (Array.isArray(data) ? data[0] : data) as SolutionFormLink | undefined;
        if (saved) {
          setLinks((current) => [...current.filter((link) => link.form_id !== formId), saved]);
        }
      }
    } catch (err) {
      setLinks(previous);
      throw new Error(errorMessage(err, 'Could not move the form.'));
    }
  }, [formSolutionIds, links]);

  const moveForms = useCallback(async (formIds: string[], toSolutionId: string | null) => {
    try {
      for (const formId of formIds) {
        await moveForm(formId, toSolutionId);
      }
    } finally {
      await reload();
    }
  }, [moveForm, reload]);

  return {
    solutions,
    links,
    formSolutionIds,
    loading,
    error,
    reload,
    createSolution,
    updateSolution,
    deleteSolution,
    moveForm,
    moveForms,
  };
}
