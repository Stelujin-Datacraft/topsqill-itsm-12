-- VIS documents: separate PostgreSQL UUID PK from application logical IDs.
-- REVIEWABLE ONLY — do not auto-apply from CI/agents against Dev or Prod.
-- Apply manually to the Development Supabase project first, then Production after validation.
--
-- Background: Nest seeds / addresses rows with logical IDs such as `form-vulnerability`.
-- `vis_documents.id` is uuid, so writing those strings into `id` fails. This migration
-- adds `logical_id` and backfills from payload->>'id' (fallback: id::text).
--
-- Duplicate (collection, logical_id) rows are disambiguated by appending ':' || id::text
-- to non-keeper logical_ids (never deletes records). Keepers prefer non-deleted, then
-- earliest created_at. Review `vis_documents_logical_id_conflicts` if that view is created.

-- ── Column ──────────────────────────────────────────────────────────────────

ALTER TABLE public.vis_documents
  ADD COLUMN IF NOT EXISTS logical_id text;

COMMENT ON COLUMN public.vis_documents.logical_id IS
  'Application-level document id (e.g. form-vulnerability). UUID PK remains in id.';

-- ── Backfill ────────────────────────────────────────────────────────────────

UPDATE public.vis_documents
SET logical_id = COALESCE(NULLIF(btrim(payload->>'id'), ''), id::text)
WHERE logical_id IS NULL
   OR btrim(logical_id) = '';

-- ── Duplicate report (read-only; no deletes) ────────────────────────────────
-- Rows that share (collection, logical_id) before disambiguation. Empty = clean.

CREATE OR REPLACE VIEW public.vis_documents_logical_id_conflicts AS
SELECT
  collection,
  logical_id,
  count(*) AS row_count,
  array_agg(id ORDER BY created_at, id) AS document_ids,
  count(*) FILTER (WHERE deleted_at IS NULL) AS active_count
FROM public.vis_documents
WHERE logical_id IS NOT NULL
GROUP BY collection, logical_id
HAVING count(*) > 1;

COMMENT ON VIEW public.vis_documents_logical_id_conflicts IS
  'Pre/post-migration duplicate (collection, logical_id) groups. Inspect before/after apply; never auto-delete.';

-- ── Disambiguate duplicates without deleting ───────────────────────────────
-- Keep one row per (collection, logical_id): prefer active (deleted_at IS NULL),
-- then earliest created_at, then id. Non-keepers get logical_id || ':' || id::text
-- so a unique index can be created safely. Manual review may still remount
-- integrations onto the keeper logical_id if a conflict existed in Dev.

WITH ranked AS (
  SELECT
    id,
    collection,
    logical_id,
    ROW_NUMBER() OVER (
      PARTITION BY collection, logical_id
      ORDER BY (deleted_at IS NULL) DESC, created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.vis_documents
  WHERE logical_id IS NOT NULL
)
UPDATE public.vis_documents d
SET
  logical_id = d.logical_id || ':' || d.id::text,
  payload = jsonb_set(
    COALESCE(d.payload, '{}'::jsonb),
    '{id}',
    to_jsonb(d.logical_id || ':' || d.id::text),
    true
  ),
  updated_at = now()
FROM ranked r
WHERE d.id = r.id
  AND r.rn > 1;

-- ── Enforce NOT NULL + unique (collection, logical_id) ──────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.vis_documents WHERE logical_id IS NULL OR btrim(logical_id) = ''
  ) THEN
    RAISE EXCEPTION
      'vis_documents.logical_id backfill left NULL/blank rows; aborting unique index create';
  END IF;
END $$;

ALTER TABLE public.vis_documents
  ALTER COLUMN logical_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vis_documents_collection_logical_id_uidx
  ON public.vis_documents (collection, logical_id);

CREATE INDEX IF NOT EXISTS vis_documents_logical_id_idx
  ON public.vis_documents (logical_id)
  WHERE deleted_at IS NULL;
