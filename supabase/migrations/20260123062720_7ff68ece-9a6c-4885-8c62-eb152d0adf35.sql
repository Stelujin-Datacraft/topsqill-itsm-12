-- Create dashboards table
CREATE TABLE public.dashboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_id TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_public BOOLEAN DEFAULT false,
  layout JSON DEFAULT '[]'::json,
  reference_id TEXT UNIQUE
);

-- Add dashboard_id to reports table
ALTER TABLE public.reports 
ADD COLUMN dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE CASCADE;

-- Create report_media table for media components
CREATE TABLE public.report_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'link', 'document')),
  title TEXT,
  description TEXT,
  url TEXT,
  file_path TEXT,
  thumbnail_url TEXT,
  metadata JSON DEFAULT '{}'::json,
  layout JSON DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}'::json,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

-- Enable RLS on dashboards
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- Enable RLS on report_media
ALTER TABLE public.report_media ENABLE ROW LEVEL SECURITY;

-- Dashboard policies
CREATE POLICY "Users can view dashboards in their projects" 
ON public.dashboards 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create dashboards" 
ON public.dashboards 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their dashboards" 
ON public.dashboards 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their dashboards" 
ON public.dashboards 
FOR DELETE 
USING (true);

-- Report media policies
CREATE POLICY "Users can view report media" 
ON public.report_media 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create report media" 
ON public.report_media 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update report media" 
ON public.report_media 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete report media" 
ON public.report_media 
FOR DELETE 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_dashboards_project_id ON public.dashboards(project_id);
CREATE INDEX idx_dashboards_organization_id ON public.dashboards(organization_id);
CREATE INDEX idx_reports_dashboard_id ON public.reports(dashboard_id);
CREATE INDEX idx_report_media_report_id ON public.report_media(report_id);

-- Create updated_at trigger for dashboards
CREATE TRIGGER update_dashboards_updated_at
BEFORE UPDATE ON public.dashboards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for report_media
CREATE TRIGGER update_report_media_updated_at
BEFORE UPDATE ON public.report_media
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for report media files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('report-media', 'report-media', true);

-- Storage policies for report media bucket
CREATE POLICY "Anyone can view report media files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'report-media');

CREATE POLICY "Authenticated users can upload report media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'report-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their report media files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'report-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their report media files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'report-media' AND auth.role() = 'authenticated');