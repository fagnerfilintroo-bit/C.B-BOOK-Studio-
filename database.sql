
-- =====================================================
-- C.B.BOOK CLOUD
-- BANCO CENTRAL DOS APLICATIVOS
-- =====================================================

create extension if not exists pgcrypto;

-- =====================================================
-- 1. PROJETOS DO STUDIO
-- =====================================================

create table if not exists public.studio_projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  status text default 'Planejamento',
  goal text default '',
  next_action text default '',
  focus text default '',
  color text default '',
  stages jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 2. DOCUMENTOS DO STUDIO
-- =====================================================

create table if not exists public.studio_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null references public.studio_projects(id) on delete cascade,
  category text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  created_at timestamptz default now()
);

-- =====================================================
-- 3. LIVROS DA EDITORA / BIBLIOTECA C.B.BOOK
-- =====================================================

create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  description text,
  cover_path text,
  pdf_path text,
  category text,
  publication_status text default 'draft',
  access_level text default 'private',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 4. PROVAS E AVALIAÇÕES
-- =====================================================

create table if not exists public.library_assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  subject text,
  assessment_type text default 'prova',
  file_path text,
  answer_key_path text,
  access_level text default 'private',
  created_at timestamptz default now()
);

-- =====================================================
-- 5. QUESTÕES
-- =====================================================

create table if not exists public.library_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid references public.library_assessments(id) on delete cascade,
  statement text not null,
  alternatives jsonb not null default '[]'::jsonb,
  correct_answer text,
  explanation text,
  created_at timestamptz default now()
);

-- =====================================================
-- 6. ÍNDICES
-- =====================================================

create index if not exists idx_studio_projects_user
on public.studio_projects(user_id);

create index if not exists idx_studio_documents_project
on public.studio_documents(project_id);

create index if not exists idx_library_books_owner
on public.library_books(owner_id);

create index if not exists idx_library_assessments_owner
on public.library_assessments(owner_id);

create index if not exists idx_library_questions_assessment
on public.library_questions(assessment_id);

-- =====================================================
-- 7. SEGURANÇA RLS
-- =====================================================

alter table public.studio_projects enable row level security;
alter table public.studio_documents enable row level security;
alter table public.library_books enable row level security;
alter table public.library_assessments enable row level security;
alter table public.library_questions enable row level security;

-- Projetos

create policy "studio_projects_select"
on public.studio_projects for select
to authenticated
using (auth.uid() = user_id);

create policy "studio_projects_insert"
on public.studio_projects for insert
to authenticated
with check (auth.uid() = user_id);

create policy "studio_projects_update"
on public.studio_projects for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "studio_projects_delete"
on public.studio_projects for delete
to authenticated
using (auth.uid() = user_id);

-- Documentos

create policy "studio_documents_select"
on public.studio_documents for select
to authenticated
using (auth.uid() = user_id);

create policy "studio_documents_insert"
on public.studio_documents for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.studio_projects p
    where p.id = project_id
    and p.user_id = auth.uid()
  )
);

create policy "studio_documents_delete"
on public.studio_documents for delete
to authenticated
using (auth.uid() = user_id);

-- Livros

create policy "library_books_select"
on public.library_books for select
to authenticated
using (
  auth.uid() = owner_id
  or access_level = 'public'
);

create policy "library_books_insert"
on public.library_books for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "library_books_update"
on public.library_books for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "library_books_delete"
on public.library_books for delete
to authenticated
using (auth.uid() = owner_id);

-- Provas

create policy "library_assessments_select"
on public.library_assessments for select
to authenticated
using (
  auth.uid() = owner_id
  or access_level = 'public'
);

create policy "library_assessments_insert"
on public.library_assessments for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "library_assessments_update"
on public.library_assessments for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "library_assessments_delete"
on public.library_assessments for delete
to authenticated
using (auth.uid() = owner_id);

-- Questões

create policy "library_questions_select"
on public.library_questions for select
to authenticated
using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.library_assessments a
    where a.id = assessment_id
    and (
      a.owner_id = auth.uid()
      or a.access_level = 'public'
    )
  )
);

create policy "library_questions_insert"
on public.library_questions for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "library_questions_update"
on public.library_questions for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "library_questions_delete"
on public.library_questions for delete
to authenticated
using (auth.uid() = owner_id);

-- =====================================================
-- 8. STORAGE PRIVADO
-- =====================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('studio-files', 'studio-files', false, 26214400),
  ('library-files', 'library-files', false, 52428800)
on conflict (id) do nothing;

-- Studio: arquivos organizados pelo usuário

create policy "studio_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'studio-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "studio_storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'studio-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "studio_storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'studio-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Biblioteca C.B.Book

create policy "library_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'library-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "library_storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'library-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "library_storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'library-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- FINAL
-- =====================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete
on public.studio_projects,
   public.studio_documents,
   public.library_books,
   public.library_assessments,
   public.library_questions
to authenticated;
