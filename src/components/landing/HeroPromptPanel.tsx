import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Workflow, BarChart3, BookOpen, ArrowUp, Lock } from 'lucide-react';

type AssetType = 'form' | 'workflow' | 'report' | 'doc';

const ASSETS: { id: AssetType; label: string; icon: React.ElementType; route: string; color: string; placeholder: string }[] = [
  { id: 'form', label: 'Form', icon: FileText, route: '/form-builder', color: 'text-module-forms', placeholder: 'Create an employee onboarding form with manager approval…' },
  { id: 'workflow', label: 'Workflow', icon: Workflow, route: '/workflows', color: 'text-module-workflows', placeholder: 'Route high severity incidents to L2 and email the owner…' },
  { id: 'report', label: 'Report', icon: BarChart3, route: '/reports', color: 'text-module-reports', placeholder: 'Show open vulnerabilities by business unit as a bar chart…' },
  { id: 'doc', label: 'Knowledge Doc', icon: BookOpen, route: '/knowledge-base', color: 'text-module-knowledge', placeholder: 'Draft an access control policy with review cycle…' },
];

export default function HeroPromptPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState<AssetType>('form');
  const [prompt, setPrompt] = useState('');

  const active = ASSETS.find((a) => a.id === type)!;

  const handleSubmit = () => {
    const params = new URLSearchParams({ ai: prompt.trim(), type });
    const target = `${active.route}?${params.toString()}`;
    if (user) {
      navigate(target);
    } else {
      try {
        sessionStorage.setItem('pendingHeroPrompt', JSON.stringify({ prompt: prompt.trim(), type }));
      } catch {
        /* storage unavailable */
      }
      navigate(`/auth?redirect=${encodeURIComponent(target)}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mb-12 text-start">
      <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-token-md p-3 sm:p-4">
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
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-base"
        />
        <div className="flex items-end justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {ASSETS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setType(a.id)}
                className={`flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === a.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 text-muted-foreground hover:bg-muted/50'
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
          ? 'Describe what you need — TopSqill builds it and takes you straight to it.'
          : 'Describe what you need — sign in and TopSqill takes you straight to it.'}
      </p>
    </div>
  );
}
