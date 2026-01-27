import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ApiKeyManagement } from '@/components/api/ApiKeyManagement';

const ApiIntegration: React.FC = () => {
  return (
    <DashboardLayout title="API Integration" description="Manage API keys and external integrations">
      <ApiKeyManagement />
    </DashboardLayout>
  );
};

export default ApiIntegration;
