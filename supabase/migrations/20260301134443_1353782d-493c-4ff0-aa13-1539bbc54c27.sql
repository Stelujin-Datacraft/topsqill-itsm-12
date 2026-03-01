
-- Clear all Knowledge Base content to start fresh
-- Child tables cascade automatically from policies
DELETE FROM policies;
DELETE FROM knowledge_base_folders;
DELETE FROM policy_templates;
