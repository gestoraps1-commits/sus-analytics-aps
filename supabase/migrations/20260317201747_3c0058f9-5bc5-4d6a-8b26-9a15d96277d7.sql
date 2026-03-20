
INSERT INTO public.job_functions (name, is_active) VALUES
  ('Médico(a)', true),
  ('ACS - Agente Comunitário de Saúde', true),
  ('Enfermeiro(a)', true),
  ('Técnico(a) em Enfermagem', true),
  ('Gestor(a)', true),
  ('Coordenador(a)', true),
  ('TI (Tecnologia da Informação)', true)
ON CONFLICT DO NOTHING;
