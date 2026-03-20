DO $$
BEGIN
  ALTER TYPE public.indicator_code ADD VALUE IF NOT EXISTS 'c3_gestation_puerperium';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.indicator_c3_patient_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_upload_id UUID NOT NULL REFERENCES public.indicator_uploads(id) ON DELETE CASCADE,
  nominal_patient_id UUID NOT NULL REFERENCES public.indicator_nominal_patients(id) ON DELETE CASCADE,
  refresh_id UUID REFERENCES public.indicator_procedure_refreshes(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL,
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
  CONSTRAINT indicator_c3_patient_status_nominal_patient_id_key UNIQUE (nominal_patient_id)
);

CREATE INDEX IF NOT EXISTS idx_indicator_c3_patient_status_upload_id ON public.indicator_c3_patient_status(indicator_upload_id);
CREATE INDEX IF NOT EXISTS idx_indicator_c3_patient_status_owner_user_id ON public.indicator_c3_patient_status(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_indicator_c3_patient_status_refresh_id ON public.indicator_c3_patient_status(refresh_id);

ALTER TABLE public.indicator_c3_patient_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicator_c3_patient_status' AND policyname = 'Users can create own c3 patient status'
  ) THEN
    CREATE POLICY "Users can create own c3 patient status"
    ON public.indicator_c3_patient_status
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicator_c3_patient_status' AND policyname = 'Users can read own c3 patient status'
  ) THEN
    CREATE POLICY "Users can read own c3 patient status"
    ON public.indicator_c3_patient_status
    FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicator_c3_patient_status' AND policyname = 'Users can update own c3 patient status'
  ) THEN
    CREATE POLICY "Users can update own c3 patient status"
    ON public.indicator_c3_patient_status
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicator_c3_patient_status' AND policyname = 'Users can delete own c3 patient status'
  ) THEN
    CREATE POLICY "Users can delete own c3 patient status"
    ON public.indicator_c3_patient_status
    FOR DELETE
    TO authenticated
    USING (auth.uid() = owner_user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.indicator_c3_flag_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_status_id UUID NOT NULL REFERENCES public.indicator_c3_patient_status(id) ON DELETE CASCADE,
  nominal_patient_id UUID NOT NULL REFERENCES public.indicator_nominal_patients(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
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
  CONSTRAINT indicator_c3_flag_status_patient_status_id_flag_key_key UNIQUE (patient_status_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_indicator_c3_flag_status_patient_status_id ON public.indicator_c3_flag_status(patient_status_id);
CREATE INDEX IF NOT EXISTS idx_indicator_c3_flag_status_nominal_patient_id ON public.indicator_c3_flag_status(nominal_patient_id);
CREATE INDEX IF NOT EXISTS idx_indicator_c3_flag_status_owner_user_id ON public.indicator_c3_flag_status(owner_user_id);

ALTER TABLE public.indicator_c3_flag_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicator_c3_flag_status' AND policyname = 'Users can create own c3 flag status'
  ) THEN
    CREATE POLICY "Users can create own c3 flag status"
    ON public.indicator_c3_flag_status
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicator_c3_flag_status' AND policyname = 'Users can read own c3 flag status'
  ) THEN
    CREATE POLICY "Users can read own c3 flag status"
    ON public.indicator_c3_flag_status
    FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicator_c3_flag_status' AND policyname = 'Users can update own c3 flag status'
  ) THEN
    CREATE POLICY "Users can update own c3 flag status"
    ON public.indicator_c3_flag_status
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicator_c3_flag_status' AND policyname = 'Users can delete own c3 flag status'
  ) THEN
    CREATE POLICY "Users can delete own c3 flag status"
    ON public.indicator_c3_flag_status
    FOR DELETE
    TO authenticated
    USING (auth.uid() = owner_user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_indicator_c3_patient_status_updated_at ON public.indicator_c3_patient_status;
CREATE TRIGGER update_indicator_c3_patient_status_updated_at
BEFORE UPDATE ON public.indicator_c3_patient_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_indicator_c3_flag_status_updated_at ON public.indicator_c3_flag_status;
CREATE TRIGGER update_indicator_c3_flag_status_updated_at
BEFORE UPDATE ON public.indicator_c3_flag_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();