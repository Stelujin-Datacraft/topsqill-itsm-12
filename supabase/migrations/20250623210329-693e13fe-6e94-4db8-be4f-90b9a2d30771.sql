
-- Add approval status columns to form_submissions table
ALTER TABLE form_submissions 
ADD COLUMN approval_status text DEFAULT 'pending',
ADD COLUMN approved_by uuid REFERENCES user_profiles(id),
ADD COLUMN approval_timestamp timestamp with time zone,
ADD COLUMN approval_notes text;

-- Create index for better query performance
CREATE INDEX idx_form_submissions_approval_status ON form_submissions(approval_status);
CREATE INDEX idx_form_submissions_approved_by ON form_submissions(approved_by);
