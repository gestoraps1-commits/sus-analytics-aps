
-- Create new enums
CREATE TYPE public.user_status AS ENUM ('pendente_aprovacao', 'aprovado', 'bloqueado', 'reprovado', 'inativo');
CREATE TYPE public.section_access AS ENUM ('sem_acesso', 'visualizacao', 'edicao', 'admin_total');

-- Municipalities
CREATE TABLE public.municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;

-- Health Units
CREATE TABLE public.health_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.health_units ENABLE ROW LEVEL SECURITY;

-- Job Functions
CREATE TABLE public.job_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_functions ENABLE ROW LEVEL SECURITY;

-- Access Profiles
CREATE TABLE public.access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

-- Profile Permissions
CREATE TABLE public.profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  access_level public.section_access NOT NULL DEFAULT 'sem_acesso',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, section_key)
);
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

-- App Users
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  nome_completo text NOT NULL,
  cpf text,
  cns text,
  municipality_id uuid REFERENCES public.municipalities(id),
  health_unit_id uuid REFERENCES public.health_units(id),
  job_function_id uuid REFERENCES public.job_functions(id),
  profile_id uuid REFERENCES public.access_profiles(id),
  telefone text,
  email text NOT NULL,
  status public.user_status NOT NULL DEFAULT 'pendente_aprovacao',
  acesso boolean NOT NULL DEFAULT false,
  precisa_trocar_senha boolean NOT NULL DEFAULT false,
  is_master_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Approval Logs
CREATE TABLE public.approval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is app admin (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_app_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE auth_user_id = _user_id
    AND is_master_admin = true
  ) OR public.has_role(_user_id, 'admin');
$$;

-- RLS Policies: municipalities
CREATE POLICY "admin_manage_municipalities" ON public.municipalities FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid())) WITH CHECK (public.is_app_admin(auth.uid()));
CREATE POLICY "read_active_municipalities" ON public.municipalities FOR SELECT TO authenticated
  USING (is_active = true);

-- RLS Policies: health_units
CREATE POLICY "admin_manage_health_units" ON public.health_units FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid())) WITH CHECK (public.is_app_admin(auth.uid()));
CREATE POLICY "read_active_health_units" ON public.health_units FOR SELECT TO authenticated
  USING (is_active = true);

-- RLS Policies: job_functions
CREATE POLICY "admin_manage_job_functions" ON public.job_functions FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid())) WITH CHECK (public.is_app_admin(auth.uid()));
CREATE POLICY "read_active_job_functions" ON public.job_functions FOR SELECT TO authenticated
  USING (is_active = true);

-- RLS Policies: access_profiles
CREATE POLICY "admin_manage_access_profiles" ON public.access_profiles FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid())) WITH CHECK (public.is_app_admin(auth.uid()));
CREATE POLICY "read_active_access_profiles" ON public.access_profiles FOR SELECT TO authenticated
  USING (is_active = true);

-- RLS Policies: profile_permissions
CREATE POLICY "admin_manage_profile_permissions" ON public.profile_permissions FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid())) WITH CHECK (public.is_app_admin(auth.uid()));
CREATE POLICY "read_own_profile_permissions" ON public.profile_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE auth_user_id = auth.uid() AND profile_id = profile_permissions.profile_id));

-- RLS Policies: app_users
CREATE POLICY "admin_manage_app_users" ON public.app_users FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid())) WITH CHECK (public.is_app_admin(auth.uid()));
CREATE POLICY "read_own_app_user" ON public.app_users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY "update_own_app_user" ON public.app_users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "insert_own_app_user" ON public.app_users FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- RLS Policies: approval_logs
CREATE POLICY "admin_manage_approval_logs" ON public.approval_logs FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid())) WITH CHECK (public.is_app_admin(auth.uid()));
CREATE POLICY "read_own_approval_logs" ON public.approval_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE id = approval_logs.app_user_id AND auth_user_id = auth.uid()));

-- Updated_at triggers
CREATE TRIGGER update_municipalities_updated_at BEFORE UPDATE ON public.municipalities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_health_units_updated_at BEFORE UPDATE ON public.health_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_functions_updated_at BEFORE UPDATE ON public.job_functions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_access_profiles_updated_at BEFORE UPDATE ON public.access_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_users_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
