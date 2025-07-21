-- Create saved_queries table
CREATE TABLE saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE saved_queries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own saved queries" ON saved_queries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved queries" ON saved_queries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved queries" ON saved_queries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved queries" ON saved_queries
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saved_queries_updated_at
  BEFORE UPDATE ON saved_queries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();