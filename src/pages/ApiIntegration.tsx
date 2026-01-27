import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ApiKeyManagement } from '@/components/api/ApiKeyManagement';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ApiIntegration() {
  const navigate = useNavigate();

  return (
    <DashboardLayout
      title="API Integration"
      actions={
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      }
    >
      <ApiKeyManagement />
    </DashboardLayout>
  );
}
