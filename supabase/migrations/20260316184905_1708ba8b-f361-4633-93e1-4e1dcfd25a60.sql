DO $$ BEGIN
  CREATE TYPE public.reference_upload_mode AS ENUM ('citizen', 'professional');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.indicator_classification AS ENUM ('regular', 'suficiente', 'bom', 'otimo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.indicator_flag_status AS ENUM ('done', 'attention', 'tracking');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.reference_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  upload_mode public.reference_upload_mode NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  replaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reference_upload_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  reference_upload_id UUID NOT NULL REFERENCES public.reference_uploads(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  upload_mode public.reference_upload_mode NOT NULL,
  column_names TEXT[] NOT NULL DEFAULT '{}',
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reference_upload_id, sheet_name)
);

CREATE TABLE IF NOT EXISTS public.reference_upload_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  reference_upload_id UUID NOT NULL REFERENCES public.reference_uploads(id) ON DELETE CASCADE,
  reference_upload_sheet_id UUID NOT NULL REFERENCES public.reference_upload_sheets(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_name TEXT,
  search_birth_date DATE,
  search_cpf TEXT,
  search_cns TEXT,
  match_found BOOLEAN NOT NULL DEFAULT false,
  match_source TEXT,
  backend_match JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reference_upload_sheet_id, row_index)
);

CREATE TABLE IF NOT EXISTS public.indicator_c2_patient_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  reference_upload_id UUID NOT NULL REFERENCES public.reference_uploads(id) ON DELETE CASCADE,
  reference_upload_row_id UUID REFERENCES public.reference_upload_rows(id) ON DELETE CASCADE,
  patient_key TEXT NOT NULL,
  patient_index INTEGER NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  cpf TEXT NOT NULL DEFAULT '',
  cns TEXT NOT NULL DEFAULT '',
  nascimento DATE,
  sexo TEXT NOT NULL DEFAULT '',
  unidade TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  idade_em_meses INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  classification public.indicator_classification NOT NULL DEFAULT 'regular',
  completed_flags INTEGER NOT NULL DEFAULT 0,
  pending_flags INTEGER NOT NULL DEFAULT 0,
  tracking_flags INTEGER NOT NULL DEFAULT 0,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reference_upload_id, patient_key)
);

CREATE TABLE IF NOT EXISTS public.indicator_c2_flag_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  patient_cache_id UUID NOT NULL REFERENCES public.indicator_c2_patient_cache(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status public.indicator_flag_status NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  points INTEGER NOT NULL DEFAULT 0,
  earned_points INTEGER NOT NULL DEFAULT 0,
  metric TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_cache_id, flag_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS reference_uploads_active_owner_idx
  ON public.reference_uploads(owner_user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS reference_uploads_owner_created_idx
  ON public.reference_uploads(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reference_upload_sheets_owner_upload_idx
  ON public.reference_upload_sheets(owner_user_id, reference_upload_id);

CREATE INDEX IF NOT EXISTS reference_upload_rows_owner_upload_idx
  ON public.reference_upload_rows(owner_user_id, reference_upload_id);

CREATE INDEX IF NOT EXISTS reference_upload_rows_search_cpf_idx
  ON public.reference_upload_rows(search_cpf);

CREATE INDEX IF NOT EXISTS reference_upload_rows_search_cns_idx
  ON public.reference_upload_rows(search_cns);

CREATE INDEX IF NOT EXISTS reference_upload_rows_search_name_birth_idx
  ON public.reference_upload_rows(search_name, search_birth_date);

CREATE INDEX IF NOT EXISTS indicator_c2_patient_cache_owner_upload_idx
  ON public.indicator_c2_patient_cache(owner_user_id, reference_upload_id, total_points DESC);

CREATE INDEX IF NOT EXISTS indicator_c2_flag_cache_owner_patient_idx
  ON public.indicator_c2_flag_cache(owner_user_id, patient_cache_id);

ALTER TABLE public.reference_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_upload_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_upload_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_c2_patient_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_c2_flag_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own reference uploads"
  ON public.reference_uploads
  FOR SELECT
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own reference uploads"
  ON public.reference_uploads
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own reference uploads"
  ON public.reference_uploads
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own reference uploads"
  ON public.reference_uploads
  FOR DELETE
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read own reference upload sheets"
  ON public.reference_upload_sheets
  FOR SELECT
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own reference upload sheets"
  ON public.reference_upload_sheets
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own reference upload sheets"
  ON public.reference_upload_sheets
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own reference upload sheets"
  ON public.reference_upload_sheets
  FOR DELETE
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read own reference upload rows"
  ON public.reference_upload_rows
  FOR SELECT
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own reference upload rows"
  ON public.reference_upload_rows
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own reference upload rows"
  ON public.reference_upload_rows
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own reference upload rows"
  ON public.reference_upload_rows
  FOR DELETE
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read own indicator c2 patients"
  ON public.indicator_c2_patient_cache
  FOR SELECT
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own indicator c2 patients"
  ON public.indicator_c2_patient_cache
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own indicator c2 patients"
  ON public.indicator_c2_patient_cache
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own indicator c2 patients"
  ON public.indicator_c2_patient_cache
  FOR DELETE
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read own indicator c2 flags"
  ON public.indicator_c2_flag_cache
  FOR SELECT
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own indicator c2 flags"
  ON public.indicator_c2_flag_cache
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own indicator c2 flags"
  ON public.indicator_c2_flag_cache
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own indicator c2 flags"
  ON public.indicator_c2_flag_cache
  FOR DELETE
  USING (auth.uid() = owner_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_reference_uploads_updated_at ON public.reference_uploads;
CREATE TRIGGER update_reference_uploads_updated_at
BEFORE UPDATE ON public.reference_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reference_upload_sheets_updated_at ON public.reference_upload_sheets;
CREATE TRIGGER update_reference_upload_sheets_updated_at
BEFORE UPDATE ON public.reference_upload_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reference_upload_rows_updated_at ON public.reference_upload_rows;
CREATE TRIGGER update_reference_upload_rows_updated_at
BEFORE UPDATE ON public.reference_upload_rows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_indicator_c2_patient_cache_updated_at ON public.indicator_c2_patient_cache;
CREATE TRIGGER update_indicator_c2_patient_cache_updated_at
BEFORE UPDATE ON public.indicator_c2_patient_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_indicator_c2_flag_cache_updated_at ON public.indicator_c2_flag_cache;
CREATE TRIGGER update_indicator_c2_flag_cache_updated_at
BEFORE UPDATE ON public.indicator_c2_flag_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();