import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Workflow, BarChart3, BookOpen, ArrowUp, Lock } from 'lucide-react';

type AssetType = 'form' | 'workflow' | 'report' | 'doc';

const ASSETS: { id: AssetType; label: string; icon: React.ElementType; color: string; placeholder: string; intent: string; disabled?: boolean }[] = [
  { id: 'form', label: 'Form', icon: FileText, color: 'text-module-forms', placeholder: 'Create an employee onboarding form with manager approval…', intent: 'Create a form' },
  { id: 'workflow', label: 'Workflow', icon: Workflow, color: 'text-module-workflows', placeholder: 'Route high severity incidents to L2 and email the owner…', intent: 'Create a workflow', disabled: true },
  { id: 'report', label: 'Report', icon: BarChart3, color: 'text-module-reports', placeholder: 'Show open vulnerabilities by business unit as a bar chart…', intent: 'Create a report', disabled: true },
  { id: 'doc', label: 'Knowledge Doc', icon: BookOpen, color: 'text-module-knowledge', placeholder: 'Draft an access control policy with review cycle…', intent: 'Create a knowledge doc', disabled: true },
];

export default function HeroPromptPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState<AssetType>('form');
  const [prompt, setPrompt] = useState('');

  const active = ASSETS.find((a) => a.id === type)!;

  const handleSubmit = () => {
    const text = prompt.trim();
    if (!text) return;
    const fullPrompt = `${active.intent}: ${text}`;

    try {
      sessionStorage.setItem('pendingHeroPrompt', JSON.stringify({ prompt: fullPrompt, type }));
    } catch {
      /* storage unavailable */
    }

    if (user) {
      // Full-page AI Builder picks up the prompt and creates the asset
      navigate('/build');
      return;
    }

    navigate(`/auth?returnTo=${encodeURIComponent('/build')}`);
  };

  return (
    <div className="max-w-3xl mx-auto mb-12 text-start">
      <div className="hero-prompt-panel rounded-2xl border border-border bg-background p-3 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_28px_rgba(15,23,42,0.08)] ring-1 ring-black/5 dark:bg-card dark:ring-white/10">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={active.placeholder}
          rows={3}
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-base placeholder:text-muted-foreground/80"
        />
        <div className="flex items-end justify-between gap-3 border-t border-border/70 pt-3 mt-1">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {ASSETS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { if (!a.disabled) setType(a.id); }}
                disabled={a.disabled}
                aria-disabled={a.disabled}
                title={a.disabled ? 'Coming soon — available inside the app' : undefined}
                className={`flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  a.disabled
                    ? 'border-border/50 text-muted-foreground/60 cursor-not-allowed opacity-60'
                    : type === a.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/70'
                }`}
              >
                <a.icon className={`h-3.5 w-3.5 ${a.color}`} />
                {a.label}
              </button>
            ))}
          </div>
          {user ? (
            <Button size="icon" onClick={handleSubmit} disabled={!prompt.trim()} aria-label="Build it">
              <ArrowUp className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!prompt.trim()} className="shrink-0 gap-2">
              <Lock className="h-3.5 w-3.5" />
              Sign in to build
            </Button>
          )}
        </div>
        {!user && prompt.trim() && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>You'll need an account to build this. We'll keep your prompt and continue right after sign in.</span>
            <button
              type="button"
              onClick={() => navigate('/auth?mode=signup')}
              className="font-medium text-primary underline underline-offset-2"
            >
              Create a free account
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-3">
        {user
          ? 'Describe what you need — the AI Copilot builds it for you right away.'
          : 'Describe what you need — sign in and the AI Copilot builds it right away.'}
      </p>
    </div>
  );
}
