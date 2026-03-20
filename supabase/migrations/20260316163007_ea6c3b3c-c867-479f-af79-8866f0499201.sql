CREATE TYPE public.app_role AS ENUM ('admin', 'analyst');

CREATE TYPE public.catalog_kind AS ENUM ('transport_header', 'record_type', 'code_dictionary', 'reference');

CREATE TYPE public.extraction_run_status AS ENUM ('queued', 'running', 'completed', 'failed');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.dictionary_catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind public.catalog_kind NOT NULL,
  version TEXT NOT NULL,
  source_label TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.catalog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES public.dictionary_catalogs(id) ON DELETE CASCADE,
  entry_key TEXT NOT NULL,
  code TEXT,
  label TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, entry_key)
);

CREATE TABLE public.ficha_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  technical_name TEXT,
  version TEXT NOT NULL,
  description TEXT,
  transport_type_code TEXT,
  serialization_protocol TEXT,
  file_extension TEXT DEFAULT '.esus',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ficha_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_definition_id UUID NOT NULL REFERENCES public.ficha_definitions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_path TEXT,
  data_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  min_length INTEGER,
  max_length INTEGER,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  references_catalog_id UUID REFERENCES public.dictionary_catalogs(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ficha_definition_id, field_key)
);

CREATE TABLE public.extraction_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  ficha_definition_id UUID REFERENCES public.ficha_definitions(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_config_id UUID NOT NULL REFERENCES public.extraction_configs(id) ON DELETE CASCADE,
  status public.extraction_run_status NOT NULL DEFAULT 'queued',
  run_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_catalog_entries_catalog_id ON public.catalog_entries(catalog_id);
CREATE INDEX idx_ficha_fields_ficha_definition_id ON public.ficha_fields(ficha_definition_id);
CREATE INDEX idx_extraction_configs_created_by ON public.extraction_configs(created_by);
CREATE INDEX idx_extraction_configs_ficha_definition_id ON public.extraction_configs(ficha_definition_id);
CREATE INDEX idx_extraction_runs_config_id ON public.extraction_runs(extraction_config_id);
CREATE INDEX idx_extraction_runs_created_by ON public.extraction_runs(created_by);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_read_dictionary()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_dictionary()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_access_extraction_config(_config_owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _config_owner OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_extraction_config(_config_owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _config_owner OR public.has_role(auth.uid(), 'admin');
$$;

CREATE TRIGGER update_dictionary_catalogs_updated_at
BEFORE UPDATE ON public.dictionary_catalogs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_catalog_entries_updated_at
BEFORE UPDATE ON public.catalog_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ficha_definitions_updated_at
BEFORE UPDATE ON public.ficha_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ficha_fields_updated_at
BEFORE UPDATE ON public.ficha_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_extraction_configs_updated_at
BEFORE UPDATE ON public.extraction_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read dictionary catalogs"
ON public.dictionary_catalogs
FOR SELECT
TO authenticated
USING (public.can_read_dictionary());

CREATE POLICY "Admins can manage dictionary catalogs"
ON public.dictionary_catalogs
FOR ALL
TO authenticated
USING (public.can_manage_dictionary())
WITH CHECK (public.can_manage_dictionary());

CREATE POLICY "Users can read catalog entries"
ON public.catalog_entries
FOR SELECT
TO authenticated
USING (public.can_read_dictionary());

CREATE POLICY "Admins can manage catalog entries"
ON public.catalog_entries
FOR ALL
TO authenticated
USING (public.can_manage_dictionary())
WITH CHECK (public.can_manage_dictionary());

CREATE POLICY "Users can read ficha definitions"
ON public.ficha_definitions
FOR SELECT
TO authenticated
USING (public.can_read_dictionary());

CREATE POLICY "Admins can manage ficha definitions"
ON public.ficha_definitions
FOR ALL
TO authenticated
USING (public.can_manage_dictionary())
WITH CHECK (public.can_manage_dictionary());

CREATE POLICY "Users can read ficha fields"
ON public.ficha_fields
FOR SELECT
TO authenticated
USING (public.can_read_dictionary());

CREATE POLICY "Admins can manage ficha fields"
ON public.ficha_fields
FOR ALL
TO authenticated
USING (public.can_manage_dictionary())
WITH CHECK (public.can_manage_dictionary());

CREATE POLICY "Users can read extraction configs"
ON public.extraction_configs
FOR SELECT
TO authenticated
USING (public.can_access_extraction_config(created_by));

CREATE POLICY "Users can create own extraction configs"
ON public.extraction_configs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own extraction configs"
ON public.extraction_configs
FOR UPDATE
TO authenticated
USING (public.can_manage_extraction_config(created_by))
WITH CHECK (public.can_manage_extraction_config(created_by));

CREATE POLICY "Users can delete own extraction configs"
ON public.extraction_configs
FOR DELETE
TO authenticated
USING (public.can_manage_extraction_config(created_by));

CREATE POLICY "Users can read extraction runs"
ON public.extraction_runs
FOR SELECT
TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

CREATE POLICY "Users can create own extraction runs"
ON public.extraction_runs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own extraction runs"
ON public.extraction_runs
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own extraction runs"
ON public.extraction_runs
FOR DELETE
TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE VIEW public.ficha_definition_summary AS
SELECT
  fd.id,
  fd.slug,
  fd.name,
  fd.technical_name,
  fd.version,
  fd.description,
  fd.transport_type_code,
  fd.file_extension,
  fd.is_active,
  COUNT(ff.id) AS field_count
FROM public.ficha_definitions fd
LEFT JOIN public.ficha_fields ff ON ff.ficha_definition_id = fd.id
GROUP BY fd.id;

CREATE VIEW public.catalog_summary AS
SELECT
  dc.id,
  dc.slug,
  dc.name,
  dc.kind,
  dc.version,
  dc.source_label,
  dc.is_active,
  COUNT(ce.id) AS entry_count
FROM public.dictionary_catalogs dc
LEFT JOIN public.catalog_entries ce ON ce.catalog_id = dc.id
GROUP BY dc.id;