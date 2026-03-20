alter table public.indicator_uploads
add column if not exists reference_upload_id uuid references public.reference_uploads(id) on delete cascade;

create unique index if not exists idx_indicator_uploads_reference_unique
on public.indicator_uploads(reference_upload_id, indicator_code);