-- Create table for reusable external data source connections
CREATE TABLE public.data_source_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('http_api', 'database', 'file_url')),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- HTTP API configuration
  http_url TEXT,
  http_method TEXT DEFAULT 'GET',
  http_headers JSONB DEFAULT '{}',
  http_auth_type TEXT, -- 'none', 'bearer', 'basic', 'api_key'
  http_auth_config JSONB DEFAULT '{}', -- Encrypted auth details
  http_response_path TEXT, -- JSONPath to data array in response
  -- Database configuration
  db_type TEXT, -- 'postgresql', 'mysql', 'mssql'
  db_connection_string TEXT, -- Encrypted
  db_query TEXT,
  -- File URL configuration
  file_url TEXT,
  file_type TEXT, -- 'csv', 'excel', 'json'
  file_sheet_name TEXT, -- For Excel files
  -- Field discovery cache
  discovered_fields JSONB DEFAULT '[]',
  last_field_discovery_at TIMESTAMPTZ,
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add source type to data_feeds table
ALTER TABLE public.data_feeds 
ADD COLUMN source_type TEXT DEFAULT 'form' CHECK (source_type IN ('form', 'http_api', 'database', 'csv', 'excel', 'file_url'));

-- Add external source configuration to data_feeds
ALTER TABLE public.data_feeds 
ADD COLUMN external_source_config JSONB DEFAULT NULL;

-- Add reference to shared connection (optional - for shared connections mode)
ALTER TABLE public.data_feeds 
ADD COLUMN data_source_connection_id UUID REFERENCES public.data_source_connections(id) ON DELETE SET NULL;

-- Create storage bucket for uploaded files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('data-feed-files', 'data-feed-files', false, 52428800) -- 50MB limit
ON CONFLICT (id) DO NOTHING;

-- RLS policies for data_source_connections
ALTER TABLE public.data_source_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project users can view connections" ON public.data_source_connections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = data_source_connections.project_id
      AND pu.user_id = auth.uid()
    )
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = data_source_connections.organization_id
    )
  );

CREATE POLICY "Project admins can create connections" ON public.data_source_connections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = data_source_connections.project_id
      AND pu.user_id = auth.uid()
      AND pu.role IN ('admin', 'editor')
    )
    OR auth.uid() = created_by
  );

CREATE POLICY "Project admins can update connections" ON public.data_source_connections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = data_source_connections.project_id
      AND pu.user_id = auth.uid()
      AND pu.role IN ('admin', 'editor')
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Project admins can delete connections" ON public.data_source_connections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = data_source_connections.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
    )
    OR created_by = auth.uid()
  );

-- Storage policies for data feed files
CREATE POLICY "Users can upload data feed files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'data-feed-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view data feed files" ON storage.objects
  FOR SELECT USING (bucket_id = 'data-feed-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their data feed files" ON storage.objects
  FOR DELETE USING (bucket_id = 'data-feed-files' AND auth.uid() IS NOT NULL);

-- Add update trigger
CREATE TRIGGER update_data_source_connections_updated_at
  BEFORE UPDATE ON public.data_source_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();