import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Workflow, BarChart3, BookOpen, ArrowUp } from 'lucide-react';
import type { CopilotCreateType } from '@/lib/copilotUtils';

const ASSETS: { id: CopilotCreateType; label: string; icon: React.ElementType; color: string; placeholder: string; intent: string }[] = [
  { id: 'form', label: 'Form', icon: FileText, color: 'text-module-forms', placeholder: 'Create an employee onboarding form with manager approval…', intent: 'Create a form' },
  { id: 'workflow', label: 'Workflow', icon: Workflow, color: 'text-module-workflows', placeholder: 'Route high severity incidents to L2 and email the owner…', intent: 'Create a workflow' },
  { id: 'report', label: 'Report', icon: BarChart3, color: 'text-module-reports', placeholder: 'Show open vulnerabilities by business unit as a bar chart…', intent: 'Create a report' },
  { id: 'doc', label: 'Knowledge Base', icon: BookOpen, color: 'text-module-knowledge', placeholder: 'Draft an access control policy with review cycle…', intent: 'Create a knowledge doc' },
];

/**
 * Landing hero builder.
 * - Signed-in users: submit → AI Builder (/build) with the prompt + create type.
 * - Guests: Sign In / Sign Up in the nav, then create on the AI chat page.
 */
export default function HeroPromptPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState<CopilotCreateType>('form');
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
                onClick={() => setType(a.id)}
                className={`flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === a.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/70'
                }`}
              >
                <a.icon className={`h-3.5 w-3.5 ${a.color}`} />
                {a.label}
              </button>
            ))}
          </div>
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            aria-label="Build it"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-3">
        {user
          ? 'Pick Form, Workflow, Report, or Knowledge Base — then describe what you need.'
          : 'Describe what you need, or use Sign In / Sign Up to open the AI Builder.'}
      </p>
    </div>
  );
}
