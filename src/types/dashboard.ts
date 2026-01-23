export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  organization_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  layout?: any[];
  reference_id?: string;
}

export interface ReportMedia {
  id: string;
  report_id: string;
  media_type: 'image' | 'video' | 'link' | 'document';
  title?: string;
  description?: string;
  url?: string;
  file_path?: string;
  thumbnail_url?: string;
  metadata?: Record<string, any>;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface DashboardWithReports extends Dashboard {
  reports: Array<{
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
  }>;
}
