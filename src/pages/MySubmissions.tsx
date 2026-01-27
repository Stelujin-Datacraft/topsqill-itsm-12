
import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { MySubmissions as MySubmissionsComponent } from '@/components/MySubmissions';

const MySubmissions = () => {
  return (
    <DashboardLayout title="My Submissions">
      <div className="space-y-6">
        <p className="text-muted-foreground">
          View and manage your form submissions
        </p>
        <MySubmissionsComponent />
      </div>
    </DashboardLayout>
  );
};

export default MySubmissions;
