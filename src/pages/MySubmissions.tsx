import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { MySubmissions as MySubmissionsComponent } from '@/components/MySubmissions';

const MySubmissions = () => {
  return (
    <DashboardLayout title="My Submissions" description="View and manage your form submissions">
      <MySubmissionsComponent />
    </DashboardLayout>
  );
};

export default MySubmissions;
