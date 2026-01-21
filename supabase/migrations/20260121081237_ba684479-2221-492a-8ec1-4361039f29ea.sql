-- Add DELETE policy for admins on audit_logs
CREATE POLICY "Admins can delete audit logs"
ON public.audit_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Add DELETE policy for admins on form_audit_logs
CREATE POLICY "Admins can delete form audit logs"
ON public.form_audit_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);