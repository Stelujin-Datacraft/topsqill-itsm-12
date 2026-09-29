import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { visApi } from '@/lib/vis/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, ArrowLeft } from 'lucide-react';

const EXAMPLE =
  'Get all open vulnerabilities from ServiceNow every 15 minutes, map them to our internal Vulnerability form, and create or update the records.';

export default function VisDescribe() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(EXAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    setLoading(true);
    try {
      const created = await visApi.createIntegration({
        name: 'New Integration',
        promptText: prompt,
      });
      const analyzed = await visApi.analyze(created.id, prompt);
      navigate(`/vis/integrations/${analyzed.id}`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/vis">
          <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
        </Link>
      </Button>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Prompt-first
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Describe your integration</h1>
        <p className="text-muted-foreground mt-2">
          Explain source, target, schedule, and operations in natural language. AI proposes a
          structured design — nothing is activated automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requirement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="text-base leading-relaxed resize-y min-h-[180px]"
            placeholder="Get vulnerabilities from ServiceNow every 15 minutes…"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={analyze} disabled={loading || !prompt.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Analyze Requirement
            </Button>
            <Button type="button" variant="outline" onClick={() => setPrompt(EXAMPLE)}>
              Use example
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
