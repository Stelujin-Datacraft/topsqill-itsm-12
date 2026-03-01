
-- Add ON DELETE CASCADE to all foreign keys referencing policies(id)
ALTER TABLE policy_versions DROP CONSTRAINT IF EXISTS policy_versions_policy_id_fkey;
ALTER TABLE policy_versions ADD CONSTRAINT policy_versions_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE;

ALTER TABLE policy_approvals DROP CONSTRAINT IF EXISTS policy_approvals_policy_id_fkey;
ALTER TABLE policy_approvals ADD CONSTRAINT policy_approvals_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE;

ALTER TABLE policy_linkages DROP CONSTRAINT IF EXISTS policy_linkages_policy_id_fkey;
ALTER TABLE policy_linkages ADD CONSTRAINT policy_linkages_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE;

ALTER TABLE policy_acknowledgments DROP CONSTRAINT IF EXISTS policy_acknowledgments_policy_id_fkey;
ALTER TABLE policy_acknowledgments ADD CONSTRAINT policy_acknowledgments_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE;

ALTER TABLE policy_exceptions DROP CONSTRAINT IF EXISTS policy_exceptions_policy_id_fkey;
ALTER TABLE policy_exceptions ADD CONSTRAINT policy_exceptions_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE;

ALTER TABLE policy_ratings DROP CONSTRAINT IF EXISTS policy_ratings_policy_id_fkey;
ALTER TABLE policy_ratings ADD CONSTRAINT policy_ratings_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE;

ALTER TABLE policy_review_cycles DROP CONSTRAINT IF EXISTS policy_review_cycles_policy_id_fkey;
ALTER TABLE policy_review_cycles ADD CONSTRAINT policy_review_cycles_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE;
