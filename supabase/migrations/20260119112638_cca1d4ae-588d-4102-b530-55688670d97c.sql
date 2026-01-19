-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view runs for their data feeds" ON public.data_feed_runs;

-- Create a more permissive policy for viewing runs
CREATE POLICY "Authenticated users can view data feed runs"
  ON public.data_feed_runs
  FOR SELECT
  TO authenticated
  USING (true);