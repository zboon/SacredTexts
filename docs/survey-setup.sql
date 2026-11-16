-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Creates the table the hidden survey page (survey.js) writes to. The public
-- (anon) key can ADD and READ rows, so everyone who takes the survey can see
-- everyone's answers (the page says so). It cannot change or delete any.
create table if not exists public.survey_responses (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  survey     text  not null default 'calendar' check (char_length(survey) <= 40),
  name       text  check (char_length(name) <= 80),
  answers    jsonb not null check (pg_column_size(answers) < 6000)
);

alter table public.survey_responses enable row level security;

drop policy if exists "anyone can submit a survey answer" on public.survey_responses;
create policy "anyone can submit a survey answer"
  on public.survey_responses for insert to anon, authenticated
  with check (true);

grant insert on public.survey_responses to anon, authenticated;

drop policy if exists "anyone can read survey answers" on public.survey_responses;
create policy "anyone can read survey answers"
  on public.survey_responses for select to anon, authenticated
  using (true);

grant select on public.survey_responses to anon, authenticated;
-- No update/delete policy on purpose.
