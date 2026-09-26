import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Plus, Plug, Key, AlertCircle } from 'lucide-react';
import { ApiKeyManagement } from '@/components/api/ApiKeyManagement';
import { AIApiKeySuggester, type ApiKeyCreatePrefill } from '@/components/ai/AIApiKeySuggester';
import { ConnectorList } from '@/components/integrations/ConnectorList';
import { ConnectorDialog } from '@/components/integrations/ConnectorDialog';
import { useOutboundConnectors } from '@/hooks/useOutboundConnectors';
import type { OutboundConnector, OutboundConnectorFormData } from '@/types/outboundConnector';

type IntegrationsTab = 'connectors' | 'api-keys';

function parseTab(raw: string | null): IntegrationsTab {
  return raw === 'api-keys' ? 'api-keys' : 'connectors';
}

const Integrations: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = useMemo(() => parseTab(tabParam), [tabParam]);

  const {
    connectors,
    loading: connectorsLoading,
    loadError,
    createConnector,
    updateConnector,
    deleteConnector,
    toggleActive,
    fetchConnectors,
  } = useOutboundConnectors();

  const [connectorDialogOpen, setConnectorDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<OutboundConnector | null>(null);
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<ApiKeyCreatePrefill | null>(null);

  const setTab = useCallback(
    (tab: string) => {
      const next = parseTab(tab);
      const current = parseTab(searchParams.get('tab'));
      if (next === current) return;
      if (next === 'connectors') {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ tab: next }, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const handleAiApply = useCallback((draft: ApiKeyCreatePrefill) => {
    setCreatePrefill(draft);
    setShowCreateKeyDialog(true);
  }, []);

  const handleCreateConnector = useCallback(() => {
    setEditingConnector(null);
    setConnectorDialogOpen(true);
  }, []);

  const handleEditConnector = useCallback((connector: OutboundConnector) => {
    setEditingConnector(connector);
    setConnectorDialogOpen(true);
  }, []);

  const handleSaveConnector = useCallback(
    async (data: OutboundConnectorFormData): Promise<boolean> => {
      if (editingConnector) {
        return updateConnector(editingConnector.id, data);
      }
      const created = await createConnector(data);
      return !!created;
    },
    [editingConnector, updateConnector, createConnector],
  );

  const handleCreatePrefillConsumed = useCallback(() => {
    setCreatePrefill(null);
  }, []);

  const headerActions = useMemo(() => {
    if (activeTab === 'connectors') {
      return (
        <Button type="button" onClick={handleCreateConnector}>
          <Plus className="icon-md mr-2" />
          Add connector
        </Button>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <AIApiKeySuggester onApply={handleAiApply} variant="secondary" />
        <Button type="button" onClick={() => setShowCreateKeyDialog(true)}>
          <Plus className="icon-md mr-2" />
          Create API Key
        </Button>
      </div>
    );
  }, [activeTab, handleCreateConnector, handleAiApply]);

  return (
    <DashboardLayout
      title="Integrations"
      description="Outbound connectors and inbound API keys"
      actions={headerActions}
    >
      <Tabs value={activeTab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="connectors" className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Connectors
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="space-y-4">
          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load connectors</AlertTitle>
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{loadError}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void fetchConnectors()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <ConnectorList
            connectors={connectors}
            loading={connectorsLoading}
            onCreate={handleCreateConnector}
            onEdit={handleEditConnector}
            onDelete={deleteConnector}
            onToggleActive={toggleActive}
          />
        </TabsContent>

        <TabsContent value="api-keys">
          {activeTab === 'api-keys' && (
            <ApiKeyManagement
              showCreateDialog={showCreateKeyDialog}
              onCreateDialogChange={setShowCreateKeyDialog}
              createPrefill={createPrefill}
              onCreatePrefillConsumed={handleCreatePrefillConsumed}
            />
          )}
        </TabsContent>
      </Tabs>

      <ConnectorDialog
        open={connectorDialogOpen}
        onOpenChange={setConnectorDialogOpen}
        connector={editingConnector}
        onSave={handleSaveConnector}
      />
    </DashboardLayout>
  );
};

export default Integrations;
