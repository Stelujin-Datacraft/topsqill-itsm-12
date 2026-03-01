
-- Fix folder → policies cascade delete
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_folder_id_fkey;
ALTER TABLE policies
ADD CONSTRAINT policies_folder_id_fkey
FOREIGN KEY (folder_id) REFERENCES knowledge_base_folders(id) ON DELETE CASCADE;
