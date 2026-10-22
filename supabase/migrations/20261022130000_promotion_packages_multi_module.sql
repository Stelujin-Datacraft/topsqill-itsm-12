-- Allow one promotion package to cover multiple modules (Archer-style).
-- Keeps legacy `module` text as a human-readable label for lists/UI.

ALTER TABLE public.promotion_packages
  ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing single-module packages
UPDATE public.promotion_packages
SET modules = jsonb_build_array(module)
WHERE modules = '[]'::jsonb
   OR modules IS NULL
   OR jsonb_typeof(modules) <> 'array'
   OR jsonb_array_length(modules) = 0;

COMMENT ON COLUMN public.promotion_packages.modules IS
  'JSON array of module names included in this package, e.g. ["Forms","Workflows"]';
COMMENT ON COLUMN public.promotion_packages.module IS
  'Display label: single module name, or joined names for multi-module packages';
