import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Cable } from 'lucide-react';
import { VisPageHeader, VisPageShell } from '@/components/vis/VisPageShell';

const EXAMPLE =
  'Sync CrowdStrike Falcon devices from our Mockoon REST API every 15 minutes into our internal Vulnerability form. Create or update by device_id as external_id.';

const INCOMPLETE_EXAMPLE = 'Sync CrowdStrike devices to our internal form.';

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
          description="This prompt box is intentional — New Integration is AI-assisted design, not a blank connection form. To register Mockoon or API credentials first, open Connections."
          backTo="/vis"
          backLabel="Dashboard"
          eyebrow="Screen 1 · Prompt-first"
          actions={
            <Button variant="outline" asChild>
              <Link to="/vis/connections">
                <Cable className="h-4 w-4 mr-1.5" />
                New Connection
              </Link>
            </Button>
          }
        />

        <div className="rounded-md border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          Looking for a connection form? Use{' '}
          <Link to="/vis/connections" className="text-foreground underline underline-offset-2">
            /vis/connections → New Connection
          </Link>
          . Come back here after the source/target endpoints exist.
        </div>

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
