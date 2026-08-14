create extension if not exists pgcrypto;

create table if not exists projects (
  id text primary key,
  name text not null,
  repository_full_name text not null unique,
  production_url text not null,
  benchmark_profile text not null,
  status text not null default 'active' check (status in ('active','paused','archived')),
  phase text not null default 'quality' check (phase in ('lead','research','brief','development','quality','preview','approval','production','monitoring')),
  current_score numeric(5,2),
  gate_status text not null default 'unknown' check (gate_status in ('unknown','running','passed','failed','needs_evidence')),
  last_benchmark_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quality_runs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  standard_version text not null default '1.0.0',
  source text not null,
  status text not null check (status in ('queued','running','passed','failed','needs_evidence','cancelled')),
  raw_score numeric(5,2),
  final_score numeric(5,2),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists quality_runs_project_started_idx on quality_runs(project_id, started_at desc);
create unique index if not exists quality_runs_idempotency_idx on quality_runs(project_id, source, started_at);

create table if not exists findings (
  id text primary key,
  run_id uuid references quality_runs(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  check_id text,
  source text not null,
  severity text not null check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','fixing','blocked','resolved','accepted')),
  title text not null,
  detail text not null,
  evidence jsonb not null default '{}'::jsonb,
  automation_action text,
  owner_type text not null default 'agent' check (owner_type in ('agent','human')),
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists findings_project_status_idx on findings(project_id, status, severity);

create table if not exists decisions (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  type text not null check (type in ('final_approval','brand_direction','risk_acceptance','scope_change','irreversible_action')),
  title text not null,
  context text not null,
  recommendation text not null,
  risk text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  blocking boolean not null default true,
  requested_by text not null default 'control',
  resolved_by text,
  resolution_note text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists decisions_needs_human_idx on decisions(status, blocking, created_at desc);

create table if not exists workflow_runs (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  workflow text not null,
  stage text not null,
  status text not null check (status in ('queued','running','succeeded','failed','cancelled')),
  attempt integer not null default 1,
  external_url text,
  summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  delivery_id text,
  event_type text not null,
  project_id text references projects(id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique(provider, delivery_id)
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at before update on projects for each row execute function set_updated_at();
drop trigger if exists findings_set_updated_at on findings;
create trigger findings_set_updated_at before update on findings for each row execute function set_updated_at();
