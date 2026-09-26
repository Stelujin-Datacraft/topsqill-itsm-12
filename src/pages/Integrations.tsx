import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Plug, Key, ArrowRightLeft } from 'lucide-react';
import { ApiKeyManagement } from '@/components/api/ApiKeyManagement';
import { AIApiKeySuggester, type ApiKeyCreatePrefill } from '@/components/ai/AIApiKeySuggester';
import { ConnectorList } from '@/components/integrations/ConnectorList';
import { ConnectorDialog } from '@/components/integrations/ConnectorDialog';
import { DataFeedsHubPanel } from '@/components/integrations/DataFeedsHubPanel';
import { useOutboundConnectors } from '@/hooks/useOutboundConnectors';
import type { OutboundConnector, OutboundConnectorFormData } from '@/types/outboundConnector';

type IntegrationsTab = 'connectors' | 'api-keys' | 'data-feeds';

const TAB_VALUES: IntegrationsTab[] = ['connectors', 'api-keys', 'data-feeds'];

function parseTab(raw: string | null): IntegrationsTab {
  if (raw && TAB_VALUES.includes(raw as IntegrationsTab)) {
    return raw as IntegrationsTab;
  }
  return 'connectors';
}

const Integrations: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams]);

  const {
    connectors,
    loading: connectorsLoading,
    createConnector,
    updateConnector,
    deleteConnector,
    toggleActive,
  } = useOutboundConnectors();

  const [connectorDialogOpen, setConnectorDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<OutboundConnector | null>(null);

  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<ApiKeyCreatePrefill | null>(null);

  const setTab = useCallback(
    (tab: string) => {
      const next = parseTab(tab);
      setSearchParams(next === 'connectors' ? {} : { tab: next }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    // Normalize unknown ?tab= values
    const raw = searchParams.get('tab');
    if (raw && !TAB_VALUES.includes(raw as IntegrationsTab)) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleAiApply = useCallback((draft: ApiKeyCreatePrefill) => {
    setCreatePrefill(draft);
    setShowCreateKeyDialog(true);
  }, []);

  const handleCreateConnector = () => {
    setEditingConnector(null);
    setConnectorDialogOpen(true);
  };

  const handleEditConnector = (connector: OutboundConnector) => {
    setEditingConnector(connector);
    setConnectorDialogOpen(true);
  };

  const handleSaveConnector = async (data: OutboundConnectorFormData): Promise<boolean> => {
    if (editingConnector) {
      return updateConnector(editingConnector.id, data);
    }
    const created = await createConnector(data);
    return !!created;
  };

  const headerActions = (() => {
    if (activeTab === 'connectors') {
      return (
        <Button type="button" onClick={handleCreateConnector}>
          <Plus className="icon-md mr-2" />
          Add connector
        </Button>
      );
    }
    if (activeTab === 'api-keys') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <AIApiKeySuggester onApply={handleAiApply} variant="secondary" />
          <Button type="button" onClick={() => setShowCreateKeyDialog(true)}>
            <Plus className="icon-md mr-2" />
            Create API Key
          </Button>
        </div>
      );
    }
    if (activeTab === 'data-feeds') {
      return (
        <Button type="button" variant="outline" onClick={() => navigate('/data-feeds')}>
          Open Data Feeds
        </Button>
      );
    }
    return undefined;
  })();

  return (
    <DashboardLayout
      title="Integrations"
      description="Outbound connectors, inbound API keys, and data feeds"
      actions={headerActions}
    >
      <Tabs value={activeTab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="connectors" className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Connectors
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="data-feeds" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Data Feeds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="space-y-4">
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
          <ApiKeyManagement
            showCreateDialog={showCreateKeyDialog}
            onCreateDialogChange={setShowCreateKeyDialog}
            createPrefill={createPrefill}
            onCreatePrefillConsumed={() => setCreatePrefill(null)}
          />
        </TabsContent>

        <TabsContent value="data-feeds">
          <DataFeedsHubPanel />
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
