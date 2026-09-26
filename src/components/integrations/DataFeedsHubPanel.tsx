import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, ExternalLink } from 'lucide-react';

/** Hub panel that points users to full Data Feeds (batch sync engine). */
export function DataFeedsHubPanel() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Data Feeds
        </CardTitle>
        <CardDescription>
          Scheduled or manual sync between forms and external sources (HTTP, files,
          databases, webhooks). Use this for batch pipelines; use Connectors to store
          reusable third-party credentials.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Pull or push records on a schedule</li>
          <li>Map fields from HTTP APIs, CSV/Excel, FTP, cloud storage, and more</li>
          <li>Monitor run history and failures</li>
        </ul>
        <Button type="button" onClick={() => navigate('/data-feeds')}>
          Open Data Feeds
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
