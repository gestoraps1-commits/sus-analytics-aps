
-- Allow anonymous users to read active municipalities, job_functions, and access_profiles
-- so the registration page can populate dropdowns

CREATE POLICY "anon_read_active_municipalities"
ON public.municipalities
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "anon_read_active_health_units"
ON public.health_units
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "anon_read_active_job_functions"
ON public.job_functions
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "anon_read_active_access_profiles"
ON public.access_profiles
FOR SELECT
TO anon
USING (is_active = true);
