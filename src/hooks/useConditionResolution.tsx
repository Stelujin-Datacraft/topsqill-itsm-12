import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  applyConditionResolutionToNodes,
  resolveWorkflowConditions,
  type ConditionFieldIssue,
  type ConditionFormFieldMeta,
  type ConditionResolutionIssue,
  type ConditionValueIssue,
} from '@/lib/ai/resolveWorkflowConditions';
import {
  addConditionFieldOption,
  buildConditionFieldsByFormId,
  createConditionFormField,
} from '@/lib/ai/conditionFormMutations';
import {
  applyWorkflowAssetPlan,
  planMissingWorkflowFormAssets,
  rebindWorkflowNodesToFormAssets,
  workflowAssetPlanHasCreates,
  type WorkflowAssetPlan,
} from '@/lib/ai/ensureWorkflowFormAssets';
import { ConditionFieldNotAvailableDialog } from '@/components/workflow/ConditionFieldNotAvailableDialog';
import { ConditionValueNotAvailableDialog } from '@/components/workflow/ConditionValueNotAvailableDialog';
import { ConditionChooseExistingDialog } from '@/components/workflow/ConditionChooseExistingDialog';
import { WorkflowCreateAssetsConfirmDialog } from '@/components/workflow/WorkflowCreateAssetsConfirmDialog';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';

export type ConditionFieldMeta = ConditionFormFieldMeta;

interface ResolutionSession {
  nodes: any[];
  queue: ConditionResolutionIssue[];
  formFieldsByFormId: Record<string, ConditionFormFieldMeta[]>;
  defaultFormId?: string;
  settle: (result: { nodes: any[]; aborted: boolean; skipped: number }) => void;
}

type ChooseMode =
  | { kind: 'field'; issue: ConditionFieldIssue }
  | { kind: 'value'; issue: ConditionValueIssue }
  | null;

interface AutoConfirmSession {
  plan: WorkflowAssetPlan;
  nodes: any[];
  forms: ResolveWorkflowConditionsInteractiveOptions['forms'];
  defaultFormId?: string;
  userPrompt?: string;
  settle: (result: {
    nodes: any[];
    aborted: boolean;
    skipped: number;
    createdFields: string[];
    createdOptions: Array<{ field: string; value: string }>;
  }) => void;
}

export interface ResolveWorkflowConditionsInteractiveOptions {
  nodes: any[];
  forms: Array<{
    id: string;
    name?: string;
    fields?: Array<{
      id: string;
      label: string;
      type: string;
      options?: Array<{ id?: string; value: string; label: string }>;
    }>;
  }>;
  defaultFormId?: string;
  /** Called after a field/value is created so callers can refresh metadata caches */
  onMetadataChanged?: () => void | Promise<void>;
  /**
   * auto (default for AI Builder): plan missing fields/options, confirm, then create & finish.
   * interactive: show Create / Choose Existing / Cancel dialogs per issue.
   */
  mode?: 'auto' | 'interactive';
  /** Optional user prompt — used in auto mode to discover fields to create */
  userPrompt?: string;
}

/**
 * Resolve AI workflow conditions against form metadata.
 * - mode "auto": confirm missing field/option creates, then finish the workflow
 * - mode "interactive": Field/Value Not Available confirmation queue
 */
export function useConditionResolution() {
  const [session, setSession] = useState<ResolutionSession | null>(null);
  const [chooseMode, setChooseMode] = useState<ChooseMode>(null);
  const [autoConfirm, setAutoConfirm] = useState<AutoConfirmSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const onMetadataChangedRef = useRef<ResolveWorkflowConditionsInteractiveOptions['onMetadataChanged']>();

  const currentIssue = session?.queue[0] || null;

  const finishSession = useCallback((
    nodes: any[],
    settle: ResolutionSession['settle'],
    skipped: number,
    aborted: boolean,
  ) => {
    setSession(null);
    setChooseMode(null);
    setIsCreating(false);
    settle({ nodes, aborted, skipped });
  }, []);

  const advanceQueue = useCallback((
    nodes: any[],
    remaining: ConditionResolutionIssue[],
    formFieldsByFormId: Record<string, ConditionFormFieldMeta[]>,
    defaultFormId: string | undefined,
    settle: ResolutionSession['settle'],
    skipped: number,
  ) => {
    if (remaining.length === 0) {
      finishSession(nodes, settle, skipped, false);
      return;
    }
    const { nodes: reResolved, issues } = resolveWorkflowConditions(
      nodes,
      formFieldsByFormId,
      defaultFormId,
    );
    if (issues.length === 0) {
      finishSession(reResolved, settle, skipped, false);
      return;
    }
    setSession({
      nodes: reResolved,
      queue: issues,
      formFieldsByFormId,
      defaultFormId,
      settle,
    });
  }, [finishSession]);

  const finishAutoWithoutCreates = useCallback(async (
    options: ResolveWorkflowConditionsInteractiveOptions,
  ) => {
    const rebound = rebindWorkflowNodesToFormAssets({
      nodes: options.nodes,
      forms: options.forms,
      defaultFormId: options.defaultFormId,
      userPrompt: options.userPrompt,
    });
    const formFieldsByFormId = buildConditionFieldsByFormId(rebound.forms);
    const { nodes, issues } = resolveWorkflowConditions(
      rebound.nodes,
      formFieldsByFormId,
      options.defaultFormId,
    );
    return {
      nodes,
      aborted: false,
      skipped: issues.length,
      createdFields: [] as string[],
      createdOptions: [] as Array<{ field: string; value: string }>,
    };
  }, []);

  const resolveWorkflowConditionsAuto = useCallback(async (
    options: ResolveWorkflowConditionsInteractiveOptions,
  ): Promise<{
    nodes: any[];
    aborted: boolean;
    skipped: number;
    createdFields: string[];
    createdOptions: Array<{ field: string; value: string }>;
  }> => {
    onMetadataChangedRef.current = options.onMetadataChanged;

    const plan = planMissingWorkflowFormAssets({
      nodes: options.nodes,
      forms: options.forms,
      defaultFormId: options.defaultFormId,
      userPrompt: options.userPrompt,
    });

    if (!workflowAssetPlanHasCreates(plan)) {
      return finishAutoWithoutCreates(options);
    }

    return new Promise((settle) => {
      setAutoConfirm({
        plan: plan!,
        nodes: options.nodes,
        forms: options.forms,
        defaultFormId: options.defaultFormId,
        userPrompt: options.userPrompt,
        settle,
      });
    });
  }, [finishAutoWithoutCreates]);

  const handleAutoConfirmCancel = useCallback(() => {
    if (!autoConfirm) return;
    const { settle, nodes } = autoConfirm;
    setAutoConfirm(null);
    setIsCreating(false);
    toast.message('Cancelled. No form fields or options were created.');
    settle({
      nodes,
      aborted: true,
      skipped: 0,
      createdFields: [],
      createdOptions: [],
    });
  }, [autoConfirm]);

  /** Skip creates but still finish the workflow using existing form fields/options. */
  const handleAutoConfirmSkipContinue = useCallback(() => {
    if (!autoConfirm) return;
    const session = autoConfirm;
    setAutoConfirm(null);
    setIsCreating(false);

    const rebound = rebindWorkflowNodesToFormAssets({
      nodes: session.nodes,
      forms: session.forms,
      defaultFormId: session.defaultFormId,
      userPrompt: session.userPrompt,
    });
    const formFieldsByFormId = buildConditionFieldsByFormId(rebound.forms);
    const { nodes, issues } = resolveWorkflowConditions(
      rebound.nodes,
      formFieldsByFormId,
      session.defaultFormId,
    );

    const skippedParts = [
      session.plan.fieldsToCreate.length
        ? `${session.plan.fieldsToCreate.length} field${session.plan.fieldsToCreate.length > 1 ? 's' : ''}`
        : '',
      session.plan.optionsToCreate.length
        ? `${session.plan.optionsToCreate.length} option${session.plan.optionsToCreate.length > 1 ? 's' : ''}`
        : '',
    ].filter(Boolean);

    toast.message(
      skippedParts.length
        ? `Continued without creating ${skippedParts.join(' and ')}. Using existing form fields where possible.`
        : 'Continued without creating form updates.',
    );

    session.settle({
      nodes,
      aborted: false,
      skipped: issues.length,
      createdFields: [],
      createdOptions: [],
    });
  }, [autoConfirm]);

  const handleAutoConfirmCreate = useCallback(async () => {
    if (!autoConfirm) return;
    setIsCreating(true);
    try {
      const ensured = await applyWorkflowAssetPlan({
        nodes: autoConfirm.nodes,
        forms: autoConfirm.forms,
        plan: autoConfirm.plan,
        userPrompt: autoConfirm.userPrompt,
      });

      try {
        await onMetadataChangedRef.current?.();
      } catch {
        /* non-fatal */
      }

      const { createdFields, createdOptions } = ensured.summary;
      if (createdFields.length || createdOptions.length) {
        const fieldMsg = createdFields.length
          ? `Created field${createdFields.length > 1 ? 's' : ''}: ${createdFields.join(', ')}`
          : '';
        const optMsg = createdOptions.length
          ? `Added option${createdOptions.length > 1 ? 's' : ''}: ${createdOptions.map((o) => `${o.field}=${o.value}`).join(', ')}`
          : '';
        toast.success([fieldMsg, optMsg].filter(Boolean).join('. '));
      }

      const formFieldsByFormId = buildConditionFieldsByFormId(ensured.forms);
      const { nodes, issues } = resolveWorkflowConditions(
        ensured.nodes,
        formFieldsByFormId,
        autoConfirm.defaultFormId,
      );

      const settle = autoConfirm.settle;
      setAutoConfirm(null);
      setIsCreating(false);
      settle({
        nodes,
        aborted: false,
        skipped: issues.length,
        createdFields,
        createdOptions,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create form assets';
      toast.error('Could not create form updates', { description: msg });
      setIsCreating(false);
    }
  }, [autoConfirm]);

  const resolveWorkflowConditionsInteractive = useCallback(async (
    options: ResolveWorkflowConditionsInteractiveOptions,
  ): Promise<{ nodes: any[]; aborted: boolean; skipped: number }> => {
    const mode = options.mode || 'auto';
    if (mode === 'auto') {
      const result = await resolveWorkflowConditionsAuto(options);
      return { nodes: result.nodes, aborted: result.aborted, skipped: result.skipped };
    }

    onMetadataChangedRef.current = options.onMetadataChanged;
    const formFieldsByFormId = buildConditionFieldsByFormId(options.forms);
    const { nodes, issues } = resolveWorkflowConditions(
      options.nodes,
      formFieldsByFormId,
      options.defaultFormId,
    );

    if (issues.length === 0) {
      return { nodes, aborted: false, skipped: 0 };
    }

    return new Promise((settle) => {
      setSession({
        nodes,
        queue: issues,
        formFieldsByFormId,
        defaultFormId: options.defaultFormId,
        settle,
      });
    });
  }, [resolveWorkflowConditionsAuto]);

  const handleCancelIssue = useCallback(() => {
    if (!session || !currentIssue) return;
    const skipped = 1;
    toast.message('Skipped creating missing condition field/value. You can reframe the prompt or configure the condition manually.');
    const remaining = session.queue.slice(1);
    if (remaining.length === 0) {
      finishSession(session.nodes, session.settle, skipped, false);
      return;
    }
    setSession({ ...session, queue: remaining });
  }, [session, currentIssue, finishSession]);

  const handleChooseExistingOpen = useCallback(() => {
    if (!currentIssue) return;
    if (currentIssue.kind === 'missing_field') {
      setChooseMode({ kind: 'field', issue: currentIssue });
    } else {
      setChooseMode({ kind: 'value', issue: currentIssue });
    }
  }, [currentIssue]);

  const handleChooseExistingConfirm = useCallback((selected: string) => {
    if (!session || !chooseMode) return;
    let nodes = session.nodes;
    if (chooseMode.kind === 'field') {
      const field = chooseMode.issue.availableFields.find((f) => f.id === selected);
      if (!field) return;
      nodes = applyConditionResolutionToNodes(session.nodes, chooseMode.issue, {
        fieldId: field.id,
        fieldLabel: field.label,
        fieldType: field.type,
        value: chooseMode.issue.value,
      });
    } else {
      const option = chooseMode.issue.availableOptions.find(
        (o) => o.value === selected || o.id === selected,
      );
      nodes = applyConditionResolutionToNodes(session.nodes, chooseMode.issue, {
        fieldId: chooseMode.issue.fieldId,
        fieldLabel: chooseMode.issue.fieldLabel,
        fieldType: chooseMode.issue.fieldType,
        value: option?.value ?? selected,
      });
    }
    setChooseMode(null);
    const remaining = session.queue.slice(1);
    advanceQueue(
      nodes,
      remaining,
      session.formFieldsByFormId,
      session.defaultFormId,
      session.settle,
      0,
    );
  }, [session, chooseMode, advanceQueue]);

  const handleCreateField = useCallback(async () => {
    if (!session || !currentIssue || currentIssue.kind !== 'missing_field') return;
    setIsCreating(true);
    try {
      const created = await createConditionFormField({
        formId: currentIssue.formId,
        label: currentIssue.requestedLabel,
        type: currentIssue.requestedType,
        initialValue: isOptionBasedFieldType(currentIssue.requestedType)
          ? currentIssue.value
          : undefined,
      });

      const nextFields = {
        ...session.formFieldsByFormId,
        [currentIssue.formId]: [
          ...(session.formFieldsByFormId[currentIssue.formId] || []).filter((f) => f.id !== created.id),
          {
            id: created.id,
            label: created.label,
            type: created.type,
            options: created.options,
          },
        ],
      };

      const nodes = applyConditionResolutionToNodes(session.nodes, currentIssue, {
        fieldId: created.id,
        fieldLabel: created.label,
        fieldType: created.type,
        value: isOptionBasedFieldType(created.type) && created.options[0]
          ? created.options[0].value
          : currentIssue.value,
      });

      try {
        await onMetadataChangedRef.current?.();
      } catch {
        /* non-fatal */
      }

      toast.success(`Created field "${created.label}"`);
      advanceQueue(
        nodes,
        session.queue.slice(1),
        nextFields,
        session.defaultFormId,
        session.settle,
        0,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create field';
      toast.error('Could not create field', { description: msg });
      setIsCreating(false);
    }
  }, [session, currentIssue, advanceQueue]);

  const handleCreateValue = useCallback(async () => {
    if (!session || !currentIssue || currentIssue.kind !== 'missing_value') return;
    setIsCreating(true);
    try {
      const created = await addConditionFieldOption({
        fieldId: currentIssue.fieldId,
        valueLabel: currentIssue.requestedValue,
      });

      const formFields = (session.formFieldsByFormId[currentIssue.formId] || []).map((f) => {
        if (f.id !== currentIssue.fieldId) return f;
        return { ...f, options: created.options };
      });
      const nextFields = {
        ...session.formFieldsByFormId,
        [currentIssue.formId]: formFields,
      };

      const nodes = applyConditionResolutionToNodes(session.nodes, currentIssue, {
        fieldId: currentIssue.fieldId,
        fieldLabel: currentIssue.fieldLabel,
        fieldType: currentIssue.fieldType,
        value: created.value,
      });

      try {
        await onMetadataChangedRef.current?.();
      } catch {
        /* non-fatal */
      }

      toast.success(`Created value "${created.label}"`);
      advanceQueue(
        nodes,
        session.queue.slice(1),
        nextFields,
        session.defaultFormId,
        session.settle,
        0,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create value';
      toast.error('Could not create value', { description: msg });
      setIsCreating(false);
    }
  }, [session, currentIssue, advanceQueue]);

  const conditionResolutionDialogs = (
    <>
      {autoConfirm && (
        <WorkflowCreateAssetsConfirmDialog
          open
          plan={autoConfirm.plan}
          onConfirm={() => { void handleAutoConfirmCreate(); }}
          onSkipContinue={handleAutoConfirmSkipContinue}
          onCancel={handleAutoConfirmCancel}
          isCreating={isCreating}
        />
      )}
      {currentIssue?.kind === 'missing_field' && !chooseMode && (
        <ConditionFieldNotAvailableDialog
          open
          fieldLabel={currentIssue.requestedLabel}
          onCreateField={() => { void handleCreateField(); }}
          onChooseExisting={handleChooseExistingOpen}
          onCancel={handleCancelIssue}
          isCreating={isCreating}
        />
      )}
      {currentIssue?.kind === 'missing_value' && !chooseMode && (
        <ConditionValueNotAvailableDialog
          open
          fieldLabel={currentIssue.fieldLabel}
          valueLabel={currentIssue.requestedValue}
          onCreateValue={() => { void handleCreateValue(); }}
          onChooseExisting={handleChooseExistingOpen}
          onCancel={handleCancelIssue}
          isCreating={isCreating}
        />
      )}
      {chooseMode?.kind === 'field' && (
        <ConditionChooseExistingDialog
          open
          mode="field"
          title="Choose Existing Field"
          description={`Select an existing form field to use instead of "${chooseMode.issue.requestedLabel}".`}
          fields={chooseMode.issue.availableFields}
          onConfirm={handleChooseExistingConfirm}
          onCancel={() => setChooseMode(null)}
        />
      )}
      {chooseMode?.kind === 'value' && (
        <ConditionChooseExistingDialog
          open
          mode="value"
          title="Choose Existing Value"
          description={`Select an existing option for "${chooseMode.issue.fieldLabel}" instead of "${chooseMode.issue.requestedValue}".`}
          options={chooseMode.issue.availableOptions.map((o) => ({
            label: o.label || o.value,
            value: o.value,
          }))}
          onConfirm={handleChooseExistingConfirm}
          onCancel={() => setChooseMode(null)}
        />
      )}
    </>
  );

  return {
    resolveWorkflowConditionsInteractive,
    resolveWorkflowConditionsAuto,
    conditionResolutionDialogs,
    isResolvingConditions: Boolean(session) || Boolean(autoConfirm),
  };
}
