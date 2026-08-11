-- Reinicio completo de la BD — ejecutar en Supabase → SQL Editor → Run
-- Admin: usuario asistente.social / contraseña municipio2026

drop table if exists public.donations cascade;
drop table if exists public.assistants cascade;

create table if not exists public.donations (
  id bigserial primary key,
  sequence bigint generated always as identity unique,
  code text not null,
  created_at timestamptz not null default now(),
  donor jsonb not null default '{}'::jsonb,
  donation jsonb not null default '{}'::jsonb,
  coordination jsonb not null default '{}'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  response jsonb,
  status text not null default 'pending',
  tracking_status text not null default 'Pendiente de coordinación'
);

alter table public.donations
add column if not exists tracking_status text not null default 'Pendiente de coordinación';

alter table public.donations enable row level security;

drop policy if exists "anon_can_read_donations" on public.donations;
create policy "anon_can_read_donations"
on public.donations
for select
to anon
using (true);

drop policy if exists "anon_can_insert_donations" on public.donations;
create policy "anon_can_insert_donations"
on public.donations
for insert
to anon
with check (true);

drop policy if exists "anon_can_update_donations" on public.donations;
create policy "anon_can_update_donations"
on public.donations
for update
to anon
using (true)
with check (true);

create table if not exists public.assistants (
  id bigserial primary key,
  username text not null unique,
  password text not null,
  full_name text,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.assistants
add column if not exists is_primary boolean not null default false;

alter table public.assistants enable row level security;

drop policy if exists "anon_can_read_assistants" on public.assistants;
create policy "anon_can_read_assistants"
on public.assistants
for select
to anon
using (active = true);

drop policy if exists "anon_can_insert_assistants" on public.assistants;
create policy "anon_can_insert_assistants"
on public.assistants
for insert
to anon
with check (active = true and is_primary = false);

insert into public.assistants (username, password, full_name, is_primary, active)
values ('asistente.social', 'municipio2026', 'Asistente Social Principal', true, true)
on conflict (username) do nothing;

update public.assistants
set is_primary = true
where username = 'asistente.social';

-- Tabla de preguntas posibles para Gemini
create table if not exists public.gemini_questions (
  id bigserial primary key,
  question text not null,
  category text,
  created_at timestamptz not null default now()
);

alter table public.gemini_questions enable row level security;

drop policy if exists "anon_can_read_gemini_questions" on public.gemini_questions;
create policy "anon_can_read_gemini_questions"
  on public.gemini_questions
  for select
  to anon
  using (true);

insert into public.gemini_questions (question, category)
values
  ('¿Cuántas donaciones hay pendientes?', 'cantidad'),
  ('¿Cuántas donaciones están en estado pending?', 'cantidad'),
  ('¿Cuántas donaciones de alimentos hay?', 'categoria'),
  ('¿Cuántas donaciones de ropa hay?', 'categoria'),
  ('¿Cuántas donaciones de medicamentos hay?', 'categoria'),
  ('¿Cuántas donaciones son para retiro?', 'modalidad'),
  ('¿Cuántas donaciones son para llevar?', 'modalidad'),
  ('¿Cuántas donaciones tienen modalidad retiro a domicilio?', 'modalidad'),
  ('¿Qué donaciones tienen modalidad retiro?', 'modalidad'),
  ('¿Qué donaciones tienen modalidad llevar?', 'modalidad'),
  ('¿Qué donaciones son urgentes?', 'urgencia'),
  ('¿Qué donaciones tienen prioridad urgente?', 'urgencia'),
  ('¿Qué donaciones son para familias con bebés?', 'beneficiario'),
  ('¿Qué donaciones son para instituciones?', 'donante'),
  ('¿Qué donaciones están asignadas?', 'estado'),
  ('¿Qué donaciones están sin asignar?', 'estado'),
  ('¿Qué donaciones tienen respuesta?', 'respuesta'),
  ('¿Qué donaciones no tienen respuesta?', 'respuesta'),
  ('¿Qué donaciones tienen preferencia de entrega urgente?', 'preferencia'),
  ('¿Cuál es el estado de la donación MC-2026-001?', 'detalle'),
  ('¿Cuál es el estado de la donación MC-2026-002?', 'detalle'),
  ('¿Cuál es el estado de la donación MC-2026-003?', 'detalle'),
  ('¿Hay donaciones descartadas?', 'estado'),
  ('¿Cómo puedo priorizar las donaciones pendientes?', 'priorización'),
  ('¿Cuántas donaciones pendientes hay para una institución?', 'combinada'),
  ('¿Qué donaciones tienen coordenadas o dirección de retiro?', 'coordinación'),
  ('¿Qué donaciones necesitan coordinación urgente?', 'coordinación'),
  ('¿Qué donaciones tienen más de un item?', 'detalle'),
  ('¿Qué donaciones incluyen leche, alimentos o medicamentos?', 'categoria'),
  ('¿Qué donaciones tienen referencia de contrafrente?', 'coordinación'),
  ('¿Qué donaciones tienen donante particular?', 'donante'),
  ('¿Qué donaciones tienen donante institución?', 'donante'),
  ('¿Qué donaciones necesitan tratarse primero?', 'priorización'),
  ('¿Qué donaciones hay para entrega hoy?', 'priorización'),
  ('¿Cuál es el total de donaciones en la base?', 'cantidad'),
  ('¿Cuántas donaciones fueron descartadas?', 'cantidad'),
  ('¿Qué donaciones tienen descripción de bebé o niño?', 'beneficiario'),
  ('¿Qué donaciones tienen preferencia de entrega en el domicilio del donante?', 'coordinación'),
  ('¿Hay donaciones de medicamentos para familia con necesidades médicas?', 'urgencia'),
  ('¿Qué donaciones tienen objetos clasificados como kit de primeros auxilios?', 'categoria'),
  ('¿Cuántas donaciones tienen más de 10 kg?', 'cantidad'),
  ('¿Qué donaciones tienen artículos de primera necesidad?', 'categoria'),
  ('¿Qué donaciones pueden entregarse rápido?', 'priorización'),
  ('¿Qué donaciones necesito revisar primero?', 'priorización'),
  ('¿Qué donaciones son más urgentes según el campo de preferencia?', 'urgencia'),
  ('¿Qué donaciones tienen comentarios de urgencia en coordinación?', 'coordinación'),
  ('¿Qué donaciones tienen dirección de retiro especificada?', 'coordinación'),
  ('¿Qué donaciones no tienen dirección de retiro clara?', 'coordinación'),
  ('¿Qué donaciones tienen el campo modalidad definido?', 'modalidad'),
  ('¿Qué donaciones tienen el campo donor.tipo igual a Institución?', 'donante'),
  ('¿Qué donaciones tienen el campo donor.tipo igual a Particular?', 'donante'),
  ('¿Qué donaciones incluyen un objeto llamado Canasta básica?', 'detalle'),
  ('¿Qué donaciones incluyen un objeto llamado Conjunto de bebé?', 'detalle'),
  ('¿Qué donaciones incluyen un objeto llamado Kit de primeros auxilios?', 'detalle'),
  ('¿Qué donaciones tienen dirección Calle San Martín 123?', 'coordinación'),
  ('¿Qué donaciones tienen dirección Av. Córdoba 456?', 'coordinación'),
  ('¿Qué donaciones mencionan Ingreso por contrafrente en coordinación?', 'coordinación'),
  ('¿Qué preguntas conviene hacer para priorizar donaciones urgentes?', 'consulta');

-- Datos de ejemplo para donaciones
insert into public.donations (code, created_at, donor, donation, coordination, photos, response, status)
values
  ('MC-2026-001', '2026-06-10T10:00:00Z', '{"nombre":"Ana","apellido":"Gómez","email":"ana.gomez@example.com","telefono":"0341 155 123 456","tipo":"Particular"}', '{"categoria":"Ropa","objeto":"Conjunto de bebé","estado":"Nuevo","cantidad":"3 prendas","descripcion":"Ropa para recién nacido y zapatillas"}', '{"modalidad":"retiro","direccion":"Calle San Martín 123","preferencia":"Para familias con bebés"}', '[]', null, 'pending'),
  ('MC-2026-002', '2026-06-12T14:30:00Z', '{"nombre":"Jorge","apellido":"Pérez","email":"jorge.perez@example.com","telefono":"0341 155 654 321","tipo":"Institución"}', '{"categoria":"Alimentos","objeto":"Canasta básica","estado":"Fresco","cantidad":"15 kg","descripcion":"Alimentos no perecederos y leche larga vida"}', '{"modalidad":"llevar","referencias":"Ingreso por contrafrente","preferencia":"Priorizar entrega urgente"}', '[]', null, 'pending'),
  ('MC-2026-003', '2026-06-08T09:20:00Z', '{"nombre":"María","apellido":"López","email":"maria.lopez@example.com","telefono":"0341 154 987 321","tipo":"Particular"}', '{"categoria":"Medicamentos","objeto":"Kit de primeros auxilios","estado":"Sellado","cantidad":"Varios","descripcion":"Medicamentos básicos y vendajes"}', '{"modalidad":"retiro","direccion":"Av. Córdoba 456","preferencia":"Urgente para familia con necesidades médicas"}', '[]', null, 'pending');

drop policy if exists "anon_can_update_donations" on public.donations;
create policy "anon_can_update_donations"
on public.donations
for update
to anon
using (true)
with check (true);

-- Tablas para el Asistente de IA
-- Tabla para guardar preguntas de chat generales
create table if not exists public.ai_chat_questions (
  id bigserial primary key,
  question text not null,
  response text,
  category text,
  timestamp timestamptz not null default now()
);

alter table public.ai_chat_questions enable row level security;

drop policy if exists "anon_can_read_ai_chat_questions" on public.ai_chat_questions;
create policy "anon_can_read_ai_chat_questions"
on public.ai_chat_questions
for select
to anon
using (true);

drop policy if exists "anon_can_insert_ai_chat_questions" on public.ai_chat_questions;
create policy "anon_can_insert_ai_chat_questions"
on public.ai_chat_questions
for insert
to anon
with check (true);

-- Tabla para guardar preguntas sobre donaciones específicas
create table if not exists public.ai_donation_questions (
  id bigserial primary key,
  donation_id bigint,
  question text not null,
  response text,
  created_at timestamptz not null default now()
);

alter table public.ai_donation_questions enable row level security;

drop policy if exists "anon_can_read_ai_donation_questions" on public.ai_donation_questions;
create policy "anon_can_read_ai_donation_questions"
on public.ai_donation_questions
for select
to anon
using (true);

drop policy if exists "anon_can_insert_ai_donation_questions" on public.ai_donation_questions;
create policy "anon_can_insert_ai_donation_questions"
on public.ai_donation_questions
for insert
to anon
with check (true);

