
-- Link existing auth user contact@topsqill.com to the new TopSqill Org as admin
INSERT INTO public.user_profiles (id, email, first_name, last_name, organization_id, role, status)
SELECT
  '17cbdbf4-c2d6-46ec-ab1c-530b6ab1d10d'::uuid,
  'contact@topsqill.com',
  'TopSqill',
  'Admin',
  '02d3e90e-548a-423e-bd3a-221e63266dda'::uuid,
  'admin',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles WHERE id = '17cbdbf4-c2d6-46ec-ab1c-530b6ab1d10d'::uuid
);

-- If profile already existed but pointed elsewhere, repoint it to TopSqill Org as admin
UPDATE public.user_profiles
SET organization_id = '02d3e90e-548a-423e-bd3a-221e63266dda'::uuid,
    role = 'admin',
    status = 'active'
WHERE id = '17cbdbf4-c2d6-46ec-ab1c-530b6ab1d10d'::uuid;
