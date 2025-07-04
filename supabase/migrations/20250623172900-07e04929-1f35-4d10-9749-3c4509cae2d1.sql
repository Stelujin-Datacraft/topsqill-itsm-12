
-- Add foreign key constraints to form_assignments table
ALTER TABLE form_assignments 
ADD CONSTRAINT form_assignments_form_id_fkey 
FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;

ALTER TABLE form_assignments 
ADD CONSTRAINT form_assignments_assigned_by_user_id_fkey 
FOREIGN KEY (assigned_by_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

ALTER TABLE form_assignments 
ADD CONSTRAINT form_assignments_assigned_to_user_id_fkey 
FOREIGN KEY (assigned_to_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
