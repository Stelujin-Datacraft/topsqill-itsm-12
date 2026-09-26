import React, { useCallback, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ApiKeyManagement } from '@/components/api/ApiKeyManagement';
import { AIApiKeySuggester, type ApiKeyCreatePrefill } from '@/components/ai/AIApiKeySuggester';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const ApiIntegration: React.FC = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<ApiKeyCreatePrefill | null>(null);

  const handleAiApply = useCallback((draft: ApiKeyCreatePrefill) => {
    setCreatePrefill(draft);
    setShowCreateDialog(true);
  }, []);

  return (
    <DashboardLayout
      title="API Integration"
      description="Manage API keys and external integrations"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AIApiKeySuggester
            onApply={handleAiApply}
            variant="secondary"
            buttonLabel="AI Suggest"
          />
          <Button type="button" onClick={() => setShowCreateDialog(true)}>
            <Plus className="icon-md mr-2" />
            Create API Key
          </Button>
        </div>
      }
    >
      <ApiKeyManagement
        showCreateDialog={showCreateDialog}
        onCreateDialogChange={setShowCreateDialog}
        createPrefill={createPrefill}
        onCreatePrefillConsumed={() => setCreatePrefill(null)}
        onAiSuggestApply={handleAiApply}
      />
    </DashboardLayout>
  );
};

export default ApiIntegration;
