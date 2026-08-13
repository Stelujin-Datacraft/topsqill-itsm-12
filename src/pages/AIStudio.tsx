import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { useCopilotEngine } from '@/hooks/useCopilotEngine';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CopilotFormPicker } from '@/components/ai/CopilotFormPicker';
import { CopilotFormPreviewPanel, type PreviewSizeMode } from '@/components/ai/CopilotFormPreviewPanel';
import { FORM_CREATE_ACTIONS, promptNeedsExistingForm, promptUpdatesExistingForm } from '@/lib/copilotUtils';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ArrowUp, Loader2, FileText, Workflow, BarChart3, BookOpen,
  Zap, CheckCircle2, AlertTriangle, Sparkle, RotateCcw, Eye, EyeOff,
} from 'lucide-react';

const PREVIEW_SIZES: Record<PreviewSizeMode, number> = {
  compact: 34,
  default: 46,
  expanded: 72,
};

const PREVIEW_SIZE_ORDER: PreviewSizeMode[] = ['compact', 'default', 'expanded'];

function extractCreatedForm(message: {
  action?: { type: string; status: string; result?: { result?: { formId?: string; formName?: string } } };
}): { formId: string; formName?: string } | null {
  if (!message.action || message.action.status !== 'success') return null;
  if (!FORM_CREATE_ACTIONS.has(message.action.type) && message.action.type !== 'update_form') return null;
  const formId = message.action.result?.result?.formId;
  if (!formId) return null;
  return { formId, formName: message.action.result?.result?.formName };
}

/** "View Form" / See Form should open the forms list, not a single form backend/builder page. */
function isViewFormsLink(href: string): boolean {
  if (href === '/forms' || href.startsWith('/forms?')) return true;
  if (href.startsWith('/form-builder/')) return true;
  if (/^\/form\/[^/?#]+\/?$/.test(href)) return true;
  if (/^\/form\/[^/?#]+\/settings\/?$/.test(href)) return true;
  return false;
}

const SUGGESTIONS = [
  { icon: FileText, color: 'text-module-forms', label: 'Form', prompt: 'Create a form: employee onboarding request with employee name, email, department, start date and manager approval' },
  { icon: Workflow, color: 'text-module-workflows', label: 'Workflow', prompt: 'Create a workflow: when an incident is submitted with severity Critical, assign to L2 and email the application owner' },
  { icon: BarChart3, color: 'text-module-reports', label: 'Report', prompt: 'Create a report: open vulnerabilities grouped by business unit as a bar chart' },
  { icon: BookOpen, color: 'text-module-knowledge', label: 'Knowledge Doc', prompt: 'Create a knowledge doc: access control policy with purpose, scope, responsibilities and annual review cycle' },
];

export default function AIStudio() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { workspaceUnlocked, unlockWorkspace } = useOnboardingGate();
  const {
    messages, isLoading, activeProject, projects, setCurrentProject, availableForms,
    activeFormId, activeFormName, setActiveFormId,
    sendPrompt, clearChat, hasConversation, copilotEnabled, setCopilotEnabled, resolveFormChoice,
  } = useCopilotEngine();
  const [input, setInput] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [previewFormId, setPreviewFormId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [previewSizeMode, setPreviewSizeMode] = useState<PreviewSizeMode>('default');
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewPanelRef = useRef<ImperativePanelHandle>(null);
  const sendRef = useRef(sendPrompt);
  sendRef.current = sendPrompt;
  const autoRan = useRef(false);
  const promptedFormIds = useRef<Set<string>>(new Set());
  const lastPreviewRefreshMsgId = useRef<string | null>(null);

  const viewFormsList = () => {
    unlockWorkspace();
    navigate('/forms');
  };

  const applyPreviewSize = useCallback((mode: PreviewSizeMode) => {
    setPreviewSizeMode(mode);
    previewPanelRef.current?.resize(PREVIEW_SIZES[mode]);
  }, []);

  const expandPreview = useCallback(() => {
    const idx = PREVIEW_SIZE_ORDER.indexOf(previewSizeMode);
    const next = PREVIEW_SIZE_ORDER[Math.min(idx + 1, PREVIEW_SIZE_ORDER.length - 1)];
    applyPreviewSize(next);
    setMobileSheetExpanded(true);
  }, [applyPreviewSize, previewSizeMode]);

  const contractPreview = useCallback(() => {
    const idx = PREVIEW_SIZE_ORDER.indexOf(previewSizeMode);
    const next = PREVIEW_SIZE_ORDER[Math.max(idx - 1, 0)];
    applyPreviewSize(next);
    setMobileSheetExpanded(false);
  }, [applyPreviewSize, previewSizeMode]);

  const openPreview = (formId: string, formName?: string) => {
    setPreviewFormId(formId);
    setPreviewOpen(true);
    setPreviewSizeMode('default');
    setMobileSheetExpanded(false);
    setPreviewRefreshKey((k) => k + 1);
    setActiveFormId(formId, formName);
    if (!selectedFormId) setSelectedFormId(formId);
    // Apply default size after panel mounts
    requestAnimationFrame(() => {
      previewPanelRef.current?.resize(PREVIEW_SIZES.default);
    });
  };

  // Keep composer target form aligned with the chat's active form.
  useEffect(() => {
    if (activeFormId && !selectedFormId) {
      setSelectedFormId(activeFormId);
    }
  }, [activeFormId, selectedFormId]);

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewSizeMode('default');
    setMobileSheetExpanded(false);
  };

  const syncSizeModeFromPanel = useCallback((size: number) => {
    if (Math.abs(size - PREVIEW_SIZES.expanded) <= 6) {
      setPreviewSizeMode('expanded');
    } else if (Math.abs(size - PREVIEW_SIZES.compact) <= 6) {
      setPreviewSizeMode('compact');
    } else {
      setPreviewSizeMode('default');
    }
  }, []);

  // After a live AI create, offer preview + View Form. Skip restored chat history.
  useEffect(() => {
    if (isLoading) return;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      const created = extractCreatedForm(message);
      if (!created || promptedFormIds.current.has(created.formId)) continue;
      const ageMs = Date.now() - new Date(message.timestamp).getTime();
      if (ageMs > 60_000) {
        promptedFormIds.current.add(created.formId);
        continue;
      }
      promptedFormIds.current.add(created.formId);
      // Open live preview beside chat so the user can keep prompting.
      setPreviewFormId(created.formId);
      setPreviewOpen(true);
      setPreviewRefreshKey((k) => k + 1);
      break;
    }
  }, [messages, isLoading]);

  // Refresh preview when the same form is mutated again by a later successful action.
  useEffect(() => {
    if (!previewFormId || !previewOpen || isLoading) return;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.action?.status !== 'success') continue;
      if (message.id === lastPreviewRefreshMsgId.current) break;
      const ageMs = Date.now() - new Date(message.timestamp).getTime();
      if (ageMs > 30_000) break;
      const resultFormId = message.action.result?.result?.formId as string | undefined;
      if (resultFormId && resultFormId === previewFormId) {
        lastPreviewRefreshMsgId.current = message.id;
        setPreviewRefreshKey((k) => k + 1);
      }
      break;
    }
  }, [messages, isLoading, previewFormId, previewOpen]);

  // Pick up a prompt handed over from the landing page hero panel
  useEffect(() => {
    if (autoRan.current) return;
    let stored: string | null = null;
    try {
      const raw = sessionStorage.getItem('pendingHeroPrompt');
      if (raw) {
        sessionStorage.removeItem('pendingHeroPrompt');
        stored = (JSON.parse(raw) as { prompt?: string })?.prompt ?? null;
      }
    } catch {
      /* storage unavailable */
    }
    if (stored?.trim()) {
      autoRan.current = true;
      setTimeout(() => sendRef.current(stored as string), 400);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [isLoading]);

  const submit = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || isLoading) return;
    const isUpdate = promptUpdatesExistingForm(value);
    const dependsOnForm = promptNeedsExistingForm(value);
    const targetFormId = selectedFormId || activeFormId || previewFormId || '';
    // For updates, allow send when chat already has an active form even if picker empty.
    if (dependsOnForm && availableForms.length > 0 && !targetFormId) return;
    if (isUpdate && !targetFormId && availableForms.length === 0) return;
    setInput('');
    void sendPrompt(value, targetFormId ? { formId: targetFormId } : undefined);
  };

  const LinkRenderer = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href?.startsWith('/')) {
      return (
        <button
          onClick={() => {
            if (isViewFormsLink(href)) {
              viewFormsList();
              return;
            }
            if (!workspaceUnlocked && !href.startsWith('/build')) {
              unlockWorkspace();
            }
            navigate(href);
          }}
          className="text-primary underline underline-offset-2 font-medium"
        >
          {children}
        </button>
      );
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>;
  };

  const needsForm = promptNeedsExistingForm(input);
  const isUpdatePrompt = promptUpdatesExistingForm(input);
  const effectiveTargetFormId = selectedFormId || activeFormId || previewFormId || '';
  const formMissing = needsForm && availableForms.length === 0 && !(isUpdatePrompt && activeFormId);
  const formRequired = needsForm && availableForms.length > 0 && !effectiveTargetFormId;
  const activeFormLabel = availableForms.find((f) => f.id === (selectedFormId || activeFormId))?.name
    || activeFormName
    || null;
  const showDesktopPreview = previewOpen && !!previewFormId && !isMobile;

  const composer = (
    <div className="rounded-2xl border border-border/70 bg-card shadow-token-md p-3">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <Select
          value={activeProject?.id ?? ''}
          onValueChange={(id) => {
            const next = projects.find((p) => p.id === id) || null;
            setCurrentProject(next);
            setSelectedFormId('');
          }}
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(needsForm || isUpdatePrompt || !!activeFormId) && availableForms.length > 0 && (
          <CopilotFormPicker
            forms={availableForms}
            onSelect={(formId) => {
              setSelectedFormId(formId);
              const form = availableForms.find((f) => f.id === formId);
              setActiveFormId(formId, form?.name);
            }}
            selectedId={effectiveTargetFormId || undefined}
            placeholder={isUpdatePrompt || activeFormId ? 'Form to update' : 'Select source form (required)'}
            className={cn('w-[220px]', formRequired && 'border-destructive text-destructive')}
          />
        )}
        {activeFormLabel && (
          <Badge variant="secondary" className="text-[10px] max-w-[180px] truncate" title={activeFormLabel}>
            Editing: {activeFormLabel}
          </Badge>
        )}
        {formMissing && (
          <span className="text-xs text-destructive">
            No forms in this project yet — create a form first.
          </span>
        )}
        {formRequired && (
          <span className="text-xs text-destructive">
            Select the form to update.
          </span>
        )}
      </div>
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={hasConversation ? 2 : 3}
        placeholder="Describe the form, workflow, report or doc you want to build…"
        className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-base"
        disabled={isLoading}
      />
      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setCopilotEnabled(!copilotEnabled)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors',
              copilotEnabled ? 'border-primary bg-primary/10 text-foreground' : 'border-border/70 hover:bg-muted/50'
            )}
            title={copilotEnabled ? 'Actions will be executed' : 'Chat only — no changes will be made'}
          >
            <Zap className={cn('h-3.5 w-3.5', copilotEnabled && 'text-primary')} />
            {copilotEnabled ? 'Build mode' : 'Chat only'}
          </button>
          {activeProject?.name && <span className="hidden sm:inline truncate max-w-[220px]">in {activeProject.name}</span>}
        </div>
        <Button
          size="icon"
          onClick={() => submit()}
          disabled={isLoading || !input.trim() || formRequired || formMissing}
          aria-label="Send"
          title={formRequired ? 'Select the source form first' : formMissing ? 'Create a form in this project first' : undefined}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  const chatColumn = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {!hasConversation ? (
        <div className="flex-1 overflow-y-auto">
          <div className={cn('mx-auto w-full px-4 py-10 sm:px-6 sm:py-16', showDesktopPreview ? 'max-w-3xl' : 'max-w-5xl')}>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">
              What do you want to build today?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              Describe it in plain language — the AI Copilot creates it inside your workspace.
            </p>
            <div className="mt-8">{composer}</div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => submit(s.prompt)}
                  className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <s.icon className={cn('h-4 w-4 mt-0.5 shrink-0', s.color)} />
                  <span className="text-sm text-muted-foreground line-clamp-2">{s.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 space-y-6', showDesktopPreview ? 'max-w-3xl' : 'max-w-5xl')}>
              {messages.filter((m) => m.id !== 'welcome').map((message) => (
                <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {message.role === 'user' ? (
                    <div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
                      {message.content}
                    </div>
                  ) : (
                    <div className="w-full space-y-2">
                      {message.action && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                          {message.action.status === 'executing' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {message.action.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                          {message.action.status === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          <span className="font-medium capitalize">{message.action.type.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            code: ({ children }) => <code className="bg-muted px-1 rounded text-xs">{children}</code>,
                            a: LinkRenderer,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {(() => {
                        const created = extractCreatedForm(message);
                        if (!created) return null;
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openPreview(created.formId)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview form
                          </Button>
                        );
                      })()}
                      {message.formPicker && !message.resolved ? (
                        <CopilotFormPicker
                          forms={availableForms}
                          onSelect={(formId) => resolveFormChoice(message.id, formId)}
                          placeholder="Search and select a form…"
                        />
                      ) : message.choices && !message.resolved ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {message.choices.map((choice) => (
                            <button
                              key={choice.value}
                              type="button"
                              onClick={() => resolveFormChoice(message.id, choice.value)}
                              className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs transition-colors hover:bg-muted/60"
                            >
                              {choice.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building…
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="border-t bg-background/80 backdrop-blur">
            <div className={cn('mx-auto w-full px-4 py-3 sm:px-6', showDesktopPreview ? 'max-w-3xl' : 'max-w-5xl')}>
              {composer}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkle className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-base font-semibold truncate">AI Builder</h1>
          <Badge variant="secondary" className="hidden sm:inline-flex text-xs">Copilot</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {previewFormId && (
            <Button
              variant={previewOpen ? 'secondary' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (previewOpen) closePreview();
                else openPreview(previewFormId);
              }}
            >
              {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {previewOpen ? 'Hide preview' : 'Preview'}
            </Button>
          )}
          {hasConversation && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              New chat
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {showDesktopPreview ? (
          <ResizablePanelGroup direction="horizontal" className="hidden h-full w-full md:flex">
            <ResizablePanel defaultSize={100 - PREVIEW_SIZES.default} minSize={22} maxSize={78}>
              {chatColumn}
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-border/80 hover:bg-primary/40 transition-colors" />
            <ResizablePanel
              ref={previewPanelRef}
              defaultSize={PREVIEW_SIZES.default}
              minSize={28}
              maxSize={78}
              onResize={syncSizeModeFromPanel}
              className="border-l border-border/70"
            >
              <CopilotFormPreviewPanel
                key={`${previewFormId}-${previewRefreshKey}`}
                formId={previewFormId!}
                onClose={closePreview}
                onViewForms={viewFormsList}
                onRefresh={() => setPreviewRefreshKey((k) => k + 1)}
                sizeMode={previewSizeMode}
                onExpand={expandPreview}
                onContract={contractPreview}
                showResizeControls
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          chatColumn
        )}
      </div>

      {/* Mobile: preview as a sheet so chat remains usable underneath */}
      <Sheet open={previewOpen && isMobile && !!previewFormId} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <SheetContent
          side="bottom"
          className={cn('p-0 transition-[height]', mobileSheetExpanded ? 'h-[94vh]' : 'h-[70vh]')}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Form preview</SheetTitle>
          </SheetHeader>
          {previewFormId && (
            <CopilotFormPreviewPanel
              key={`${previewFormId}-${previewRefreshKey}-mobile`}
              formId={previewFormId}
              onClose={closePreview}
              onViewForms={viewFormsList}
              onRefresh={() => setPreviewRefreshKey((k) => k + 1)}
              sizeMode={mobileSheetExpanded ? 'expanded' : 'compact'}
              onExpand={expandPreview}
              onContract={contractPreview}
              showResizeControls
            />
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
