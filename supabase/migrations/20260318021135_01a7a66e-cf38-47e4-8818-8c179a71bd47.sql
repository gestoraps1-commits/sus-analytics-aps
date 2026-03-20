-- Fix RLS policies: change target role from public to authenticated for sensitive tables

-- indicator_c2_flag_cache
DROP POLICY IF EXISTS "Users can create own indicator c2 flags" ON public.indicator_c2_flag_cache;
DROP POLICY IF EXISTS "Users can delete own indicator c2 flags" ON public.indicator_c2_flag_cache;
DROP POLICY IF EXISTS "Users can read own indicator c2 flags" ON public.indicator_c2_flag_cache;
DROP POLICY IF EXISTS "Users can update own indicator c2 flags" ON public.indicator_c2_flag_cache;

CREATE POLICY "Users can create own indicator c2 flags" ON public.indicator_c2_flag_cache FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own indicator c2 flags" ON public.indicator_c2_flag_cache FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can read own indicator c2 flags" ON public.indicator_c2_flag_cache FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own indicator c2 flags" ON public.indicator_c2_flag_cache FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- indicator_c2_patient_cache
DROP POLICY IF EXISTS "Users can create own indicator c2 patients" ON public.indicator_c2_patient_cache;
DROP POLICY IF EXISTS "Users can delete own indicator c2 patients" ON public.indicator_c2_patient_cache;
DROP POLICY IF EXISTS "Users can read own indicator c2 patients" ON public.indicator_c2_patient_cache;
DROP POLICY IF EXISTS "Users can update own indicator c2 patients" ON public.indicator_c2_patient_cache;

CREATE POLICY "Users can create own indicator c2 patients" ON public.indicator_c2_patient_cache FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own indicator c2 patients" ON public.indicator_c2_patient_cache FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can read own indicator c2 patients" ON public.indicator_c2_patient_cache FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own indicator c2 patients" ON public.indicator_c2_patient_cache FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- reference_uploads
DROP POLICY IF EXISTS "Users can create own reference uploads" ON public.reference_uploads;
DROP POLICY IF EXISTS "Users can delete own reference uploads" ON public.reference_uploads;
DROP POLICY IF EXISTS "Users can read own reference uploads" ON public.reference_uploads;
DROP POLICY IF EXISTS "Users can update own reference uploads" ON public.reference_uploads;

CREATE POLICY "Users can create own reference uploads" ON public.reference_uploads FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own reference uploads" ON public.reference_uploads FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can read own reference uploads" ON public.reference_uploads FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own reference uploads" ON public.reference_uploads FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- reference_upload_sheets
DROP POLICY IF EXISTS "Users can create own reference upload sheets" ON public.reference_upload_sheets;
DROP POLICY IF EXISTS "Users can delete own reference upload sheets" ON public.reference_upload_sheets;
DROP POLICY IF EXISTS "Users can read own reference upload sheets" ON public.reference_upload_sheets;
DROP POLICY IF EXISTS "Users can update own reference upload sheets" ON public.reference_upload_sheets;

CREATE POLICY "Users can create own reference upload sheets" ON public.reference_upload_sheets FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own reference upload sheets" ON public.reference_upload_sheets FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can read own reference upload sheets" ON public.reference_upload_sheets FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own reference upload sheets" ON public.reference_upload_sheets FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- reference_upload_rows
DROP POLICY IF EXISTS "Users can create own reference upload rows" ON public.reference_upload_rows;
DROP POLICY IF EXISTS "Users can delete own reference upload rows" ON public.reference_upload_rows;
DROP POLICY IF EXISTS "Users can read own reference upload rows" ON public.reference_upload_rows;
DROP POLICY IF EXISTS "Users can update own reference upload rows" ON public.reference_upload_rows;

CREATE POLICY "Users can create own reference upload rows" ON public.reference_upload_rows FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own reference upload rows" ON public.reference_upload_rows FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can read own reference upload rows" ON public.reference_upload_rows FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own reference upload rows" ON public.reference_upload_rows FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);