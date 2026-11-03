-- Record reference numbers (form_submissions.submission_ref_id) are unique across
-- all forms, but the generator numbers each form separately from a prefix taken
-- from the form's reference_id. Forms whose reference_ids share a prefix (for
-- example grc.asset-type-register and grc.asset-register both give "grc") hand out
-- the same number, and the insert fails with
--   duplicate key value violates unique constraint "form_submissions_submission_ref_id_key".
--
-- This trigger runs after the generator (BEFORE triggers fire in name order) and,
-- only when the number is already taken, moves to the next free number with the
-- same prefix and width, e.g. grc1102001 -> grc1102002.
--
-- Safe to run more than once. Apply in the Supabase SQL Editor for each environment.

CREATE OR REPLACE FUNCTION public.ensure_unique_submission_ref_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text := NEW.submission_ref_id;
  digits text;
  prefix text;
  width integer;
  counter numeric;
  attempts integer := 0;
BEGIN
  IF candidate IS NULL OR btrim(candidate) = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND candidate IS NOT DISTINCT FROM OLD.submission_ref_id THEN
    RETURN NEW;
  END IF;
  -- SECURITY DEFINER: the check must see every form's records, not only the rows RLS shows the user.
  IF NOT EXISTS (
    SELECT 1 FROM public.form_submissions s
    WHERE s.submission_ref_id = candidate AND s.id IS DISTINCT FROM NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Two inserts resolving the same collision must not pick the same next number.
  PERFORM pg_advisory_xact_lock(hashtext('form_submissions.submission_ref_id'));

  digits := substring(candidate FROM '[0-9]+$');
  IF digits IS NULL THEN
    prefix := candidate || '-';
    width := 1;
    counter := 1;
  ELSE
    prefix := left(candidate, length(candidate) - length(digits));
    width := length(digits);
    counter := digits::numeric;
  END IF;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.form_submissions s
      WHERE s.submission_ref_id = candidate AND s.id IS DISTINCT FROM NEW.id
    );
    attempts := attempts + 1;
    IF attempts > 100000 THEN
      RAISE EXCEPTION 'Could not find a free record reference number after %', NEW.submission_ref_id;
    END IF;
    counter := counter + 1;
    candidate := prefix || lpad(counter::text, greatest(width, length(counter::text)), '0');
  END LOOP;

  NEW.submission_ref_id := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_ensure_unique_submission_ref_id ON public.form_submissions;
CREATE TRIGGER zz_ensure_unique_submission_ref_id
BEFORE INSERT OR UPDATE OF submission_ref_id ON public.form_submissions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_unique_submission_ref_id();
