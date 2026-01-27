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
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
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
