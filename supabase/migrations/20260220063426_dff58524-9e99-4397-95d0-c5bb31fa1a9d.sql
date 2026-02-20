
-- Create storage bucket for generated documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-documents', 'generated-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for generated-documents bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-documents');

CREATE POLICY "Users can view documents in their org"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-documents');

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-documents');

-- Create document_history table
CREATE TABLE public.document_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  form_name TEXT NOT NULL,
  generated_by UUID NOT NULL,
  generated_by_email TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_type TEXT NOT NULL DEFAULT 'default',
  selected_fields JSONB NOT NULL DEFAULT '[]',
  submission_count INTEGER NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  organization_id UUID REFERENCES public.organizations(id)
);

-- Enable RLS
ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view document history in their org"
ON public.document_history FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert document history"
ON public.document_history FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete document history in their org"
ON public.document_history FOR DELETE TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
  )
);
