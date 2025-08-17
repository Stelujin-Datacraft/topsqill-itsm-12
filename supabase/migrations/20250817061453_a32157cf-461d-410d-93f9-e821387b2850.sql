-- Create saved_filters table for storing user-specific form filters
CREATE TABLE public.saved_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  form_id UUID NOT NULL,
  name TEXT NOT NULL,
  filter_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_filters
CREATE POLICY "Users can view their own saved filters" 
ON public.saved_filters 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved filters" 
ON public.saved_filters 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved filters" 
ON public.saved_filters 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved filters" 
ON public.saved_filters 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_saved_filters_updated_at
BEFORE UPDATE ON public.saved_filters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_saved_filters_user_form ON public.saved_filters(user_id, form_id);