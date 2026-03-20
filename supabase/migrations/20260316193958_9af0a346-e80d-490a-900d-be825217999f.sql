create type public.indicator_code as enum ('c2_development_child');

create table if not exists public.indicator_uploads (
  id uuid primary key default gen_random_uuid(),
  indicator_code public.indicator_code not null,
  owner_user_id uuid not null,
  name text not null,
  original_file_name text not null,
  selected_sheet_name text,
  is_active boolean not null default true,
  uploaded_at timestamp with time zone not null default now(),
  replaced_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.indicator_nominal_patients (
  id uuid primary key default gen_random_uuid(),
  indicator_code public.indicator_code not null,
  owner_user_id uuid not null,
  indicator_upload_id uuid not null references public.indicator_uploads(id) on delete cascade,
  sheet_name text not null,
  patient_index integer not null,
  patient_key text not null,
  nome text not null default '',
  cpf text not null default '',
  cns text not null default '',
  sexo text not null default '',
  acs text not null default '',
  nascimento date,
  backend_nome text not null default '',
  backend_cpf text not null default '',
  backend_cns text not null default '',
  backend_sexo text not null default '',
  backend_unidade text not null default '',
  backend_equipe text not null default '',
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (indicator_upload_id, sheet_name, patient_index),
  unique (indicator_upload_id, patient_key)
);

create table if not exists public.indicator_procedure_refreshes (
  id uuid primary key default gen_random_uuid(),
  indicator_code public.indicator_code not null,
  owner_user_id uuid not null,
  indicator_upload_id uuid not null references public.indicator_uploads(id) on delete cascade,
  refresh_scope text not null default 'procedures',
  status text not null default 'completed',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.indicator_c2_patient_status (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  indicator_upload_id uuid not null references public.indicator_uploads(id) on delete cascade,
  nominal_patient_id uuid not null references public.indicator_nominal_patients(id) on delete cascade,
  refresh_id uuid references public.indicator_procedure_refreshes(id) on delete set null,
  idade_em_meses integer not null default 0,
  total_points integer not null default 0,
  classification public.indicator_classification not null default 'regular',
  completed_flags integer not null default 0,
  pending_flags integer not null default 0,
  tracking_flags integer not null default 0,
  source_snapshot jsonb not null default '{}'::jsonb,
  calculated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (nominal_patient_id)
);

create table if not exists public.indicator_c2_flag_status (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  patient_status_id uuid not null references public.indicator_c2_patient_status(id) on delete cascade,
  nominal_patient_id uuid not null references public.indicator_nominal_patients(id) on delete cascade,
  flag_key text not null,
  title text not null,
  status public.indicator_flag_status not null,
  completed boolean not null default false,
  points integer not null default 0,
  earned_points integer not null default 0,
  metric text not null default '',
  summary text not null default '',
  detail text not null default '',
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (patient_status_id, flag_key)
);

alter table public.indicator_uploads enable row level security;
alter table public.indicator_nominal_patients enable row level security;
alter table public.indicator_procedure_refreshes enable row level security;
alter table public.indicator_c2_patient_status enable row level security;
alter table public.indicator_c2_flag_status enable row level security;

create policy "Users can create own indicator uploads"
on public.indicator_uploads
for insert
to authenticated
with check (auth.uid() = owner_user_id);

create policy "Users can read own indicator uploads"
on public.indicator_uploads
for select
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can update own indicator uploads"
on public.indicator_uploads
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users can delete own indicator uploads"
on public.indicator_uploads
for delete
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can create own nominal patients"
on public.indicator_nominal_patients
for insert
to authenticated
with check (auth.uid() = owner_user_id);

create policy "Users can read own nominal patients"
on public.indicator_nominal_patients
for select
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can update own nominal patients"
on public.indicator_nominal_patients
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users can delete own nominal patients"
on public.indicator_nominal_patients
for delete
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can create own procedure refreshes"
on public.indicator_procedure_refreshes
for insert
to authenticated
with check (auth.uid() = owner_user_id);

create policy "Users can read own procedure refreshes"
on public.indicator_procedure_refreshes
for select
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can update own procedure refreshes"
on public.indicator_procedure_refreshes
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users can delete own procedure refreshes"
on public.indicator_procedure_refreshes
for delete
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can create own c2 patient status"
on public.indicator_c2_patient_status
for insert
to authenticated
with check (auth.uid() = owner_user_id);

create policy "Users can read own c2 patient status"
on public.indicator_c2_patient_status
for select
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can update own c2 patient status"
on public.indicator_c2_patient_status
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users can delete own c2 patient status"
on public.indicator_c2_patient_status
for delete
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can create own c2 flag status"
on public.indicator_c2_flag_status
for insert
to authenticated
with check (auth.uid() = owner_user_id);

create policy "Users can read own c2 flag status"
on public.indicator_c2_flag_status
for select
to authenticated
using (auth.uid() = owner_user_id);

create policy "Users can update own c2 flag status"
on public.indicator_c2_flag_status
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "Users can delete own c2 flag status"
on public.indicator_c2_flag_status
for delete
to authenticated
using (auth.uid() = owner_user_id);

create index if not exists idx_indicator_uploads_owner_code_active on public.indicator_uploads(owner_user_id, indicator_code, is_active);
create index if not exists idx_indicator_nominal_patients_upload on public.indicator_nominal_patients(indicator_upload_id, sheet_name, patient_index);
create index if not exists idx_indicator_nominal_patients_lookup on public.indicator_nominal_patients(owner_user_id, indicator_code, cpf, cns);
create index if not exists idx_indicator_procedure_refreshes_upload on public.indicator_procedure_refreshes(indicator_upload_id, created_at desc);
create index if not exists idx_indicator_c2_patient_status_upload on public.indicator_c2_patient_status(indicator_upload_id, total_points, pending_flags);
create index if not exists idx_indicator_c2_flag_status_patient on public.indicator_c2_flag_status(patient_status_id, flag_key);

create trigger update_indicator_uploads_updated_at
before update on public.indicator_uploads
for each row
execute function public.update_updated_at_column();

create trigger update_indicator_nominal_patients_updated_at
before update on public.indicator_nominal_patients
for each row
execute function public.update_updated_at_column();

create trigger update_indicator_c2_patient_status_updated_at
before update on public.indicator_c2_patient_status
for each row
execute function public.update_updated_at_column();

create trigger update_indicator_c2_flag_status_updated_at
before update on public.indicator_c2_flag_status
for each row
execute function public.update_updated_at_column();