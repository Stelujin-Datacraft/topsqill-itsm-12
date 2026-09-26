import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ApiKeyManagement } from '@/components/api/ApiKeyManagement';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const ApiIntegration: React.FC = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <DashboardLayout
      title="API Integration"
      description="Manage API keys and external integrations"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Handled inside ApiKeyManagement via showAiSuggest signal
              window.dispatchEvent(new CustomEvent('topsqill:open-api-key-ai-suggest'));
            }}
            className="hidden"
            aria-hidden
          />
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="icon-md mr-2" />
            Create API Key
          </Button>
        </div>
      }
    >
      <ApiKeyManagement
        showCreateDialog={showCreateDialog}
        onCreateDialogChange={setShowCreateDialog}
      />
    </DashboardLayout>
  );
};

export default ApiIntegration;
