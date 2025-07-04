
import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { MySubmissions as MySubmissionsComponent } from '@/components/MySubmissions';

const MySubmissions = () => {
  return (
    <DashboardLayout>
      <MySubmissionsComponent />
    </DashboardLayout>
  );
};

export default MySubmissions;
