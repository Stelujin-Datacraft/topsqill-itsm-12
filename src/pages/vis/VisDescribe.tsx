import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';
import { VisPageHeader, VisPageShell } from '@/components/vis/VisPageShell';

const EXAMPLE =
  'Get all open vulnerabilities from ServiceNow every 15 minutes, map them to our internal Vulnerability form, and create or update the records.';

const INCOMPLETE_EXAMPLE = 'Sync vulnerabilities to our internal form.';

export default function VisDescribe() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(EXAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function analyze(withAnswers?: Record<string, string>) {
    setError(null);
    setLoading(true);
    try {
      let id = integrationId;
      if (!id) {
        const created = await visApi.createIntegration({
          name: 'New Integration',
          promptText: prompt,
        });
        id = created.id;
        setIntegrationId(id);
      }
      const analyzed: any = await visApi.analyze(id!, prompt, withAnswers);
      if (analyzed?.needsClarification && analyzed.questions?.length) {
        setQuestions(analyzed.questions);
        return;
      }
      const targetId = analyzed?.id || analyzed?.integration?.id || id;
      navigate(`/vis/integrations/${targetId}`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <VisPageShell>
      <div className="max-w-3xl space-y-5">
        <VisPageHeader
          title="Describe your integration"
          description="Explain source, target, schedule, and operations in natural language. AI proposes a structured design — it asks only when critical details are missing."
          backTo="/vis"
          backLabel="Dashboard"
          eyebrow="Screen 1 · Prompt-first"
        />

        <Card className="border-border/70 shadow-none">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-base">Requirement</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setQuestions([]);
                setAnswers({});
              }}
              rows={8}
              className="text-base leading-relaxed resize-y min-h-[180px]"
              placeholder="Get vulnerabilities from ServiceNow every 15 minutes…"
              disabled={loading}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => analyze()} disabled={loading || !prompt.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Analyze Requirement
              </Button>
              <Button type="button" variant="outline" onClick={() => setPrompt(EXAMPLE)} disabled={loading}>
                Use example
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPrompt(INCOMPLETE_EXAMPLE)}
                disabled={loading}
              >
                Try incomplete prompt
              </Button>
            </div>
          </CardContent>
        </Card>

        {questions.length > 0 && (
          <Card className="border-primary/30 shadow-none">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-base">AI needs a few details</CardTitle>
              <p className="text-sm text-muted-foreground">
                I need {questions.length} detail{questions.length === 1 ? '' : 's'} before I can design
                the integration.
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-6">
              {questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium">{q.prompt}</p>
                  <div className="flex flex-wrap gap-2">
                    {(q.options || []).map((opt: any) => (
                      <Button
                        key={opt.value}
                        type="button"
                        size="sm"
                        variant={answers[q.id] === opt.value ? 'default' : 'outline'}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  {answers[q.id] && (
                    <Badge variant="secondary" className="font-normal">
                      Selected: {answers[q.id]}
                    </Badge>
                  )}
                </div>
              ))}
              <Button
                onClick={() => analyze(answers)}
                disabled={loading || questions.some((q) => !answers[q.id])}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Continue with answers
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </VisPageShell>
  );
}
