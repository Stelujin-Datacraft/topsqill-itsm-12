import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plug, Plus, Pencil, Trash2, RefreshCw, Zap, Clock } from 'lucide-react';
import {
  CONNECTOR_AUTH_OPTIONS,
  CONNECTOR_PROVIDER_OPTIONS,
  type OutboundConnector,
} from '@/types/outboundConnector';
import { formatDistanceToNow } from 'date-fns';

interface ConnectorListProps {
  connectors: OutboundConnector[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (connector: OutboundConnector) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

function providerLabel(value: string) {
  return CONNECTOR_PROVIDER_OPTIONS.find((p) => p.value === value)?.label || value;
}

function authLabel(value: string) {
  return CONNECTOR_AUTH_OPTIONS.find((a) => a.value === value)?.label || value;
}

export function ConnectorList({
  connectors,
  loading,
  onCreate,
  onEdit,
  onDelete,
  onToggleActive,
}: ConnectorListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Outbound connectors
          </CardTitle>
          <CardDescription>
            Credentials and endpoints so Topsqill can call third-party tools
            (real-time events or batch sync).
          </CardDescription>
        </div>
        <Button type="button" onClick={onCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add connector
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading connectors…
          </div>
        ) : connectors.length === 0 ? (
          <div className="text-center py-10 space-y-4 text-muted-foreground">
            <Plug className="h-12 w-12 mx-auto opacity-50" />
            <div>
              <p className="font-medium text-foreground">No connectors yet</p>
              <p className="text-sm max-w-md mx-auto">
                Add Salesforce, ServiceNow, Jira, Slack, or a generic HTTP API with
                the right client key, secret, URL, or username/password for that tool.
              </p>
            </div>
            <Button type="button" onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add connector
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connectors.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.base_url && (
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {c.base_url}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{providerLabel(c.provider)}</Badge>
                  </TableCell>
                  <TableCell>
                    {c.mode === 'realtime' ? (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Zap className="h-3.5 w-3.5" />
                        Real-time
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Clock className="h-3.5 w-3.5" />
                        Batch
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{authLabel(c.auth_type)}</TableCell>
                  <TableCell>
                    {c.is_active ? (
                      <Badge className="bg-green-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.updated_at
                      ? formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleActive(c.id, !c.is_active)}
                      >
                        {c.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(c)}
                        aria-label="Edit connector"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label="Delete connector">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete connector?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes “{c.name}” and its stored credentials. Workflows
                              or feeds using it will stop working until reconfigured.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(c.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
