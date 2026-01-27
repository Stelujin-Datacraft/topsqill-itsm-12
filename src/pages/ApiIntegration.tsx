import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ApiKeyManagement } from '@/components/api/ApiKeyManagement';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const ApiIntegration: React.FC = () => {
  const [openCreateDialog, setOpenCreateDialog] = useState<(() => void) | null>(null);

  return (
    <DashboardLayout 
      title="API Integration" 
      description="Manage API keys and external integrations"
      actions={
        <Button onClick={() => openCreateDialog?.()}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      }
    >
      <ApiKeyManagement 
        renderHeaderButton={(openDialog) => {
          // Capture the openDialog function for the header button
          if (!openCreateDialog) {
            setTimeout(() => setOpenCreateDialog(() => openDialog), 0);
          }
          return null;
        }}
      />
    </DashboardLayout>
  );
};

export default ApiIntegration;
