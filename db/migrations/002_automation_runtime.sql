-- Archic Control milestone 2: durable agent work, journey contracts and deploy evidence.

create table if not exists journey_manifests (
  project_id text primary key references projects(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  manifest jsonb not null,
  source text not null default 'control' check (source in ('control','repository')),
  content_sha text,
  validated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id text references projects(id) on delete cascade,
  finding_id text references findings(id) on delete set null,
  task_type text not null check (task_type in ('research','implement','autofix','quality','playwright','benchmark','preview','smoke','monitor')),
  executor text not null default 'worker' check (executor in ('worker','github_dispatch')),
  status text not null default 'queued' check (status in ('queued','dispatched','leased','running','succeeded','failed','blocked','cancelled')),
  priority integer not null default 50 check (priority between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  attempt integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_token_hash text,
  leased_until timestamptz,
  external_url text,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists agent_tasks_queue_idx
  on agent_tasks(status, available_at, priority desc, created_at)
  where status in ('queued','dispatched');
create index if not exists agent_tasks_project_idx on agent_tasks(project_id, created_at desc);

create table if not exists deployment_previews (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  provider text not null default 'vercel',
  environment text not null check (environment in ('preview','production')),
  git_sha text,
  git_ref text,
  url text not null,
  status text not null check (status in ('queued','building','ready','failed','promoted','superseded')),
  quality_status text not null default 'unknown' check (quality_status in ('unknown','running','passed','failed','needs_evidence')),
  source_event_id uuid references integration_events(id) on delete set null,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  promoted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists deployment_previews_project_idx on deployment_previews(project_id, created_at desc);

create table if not exists smoke_checks (
  id uuid primary key default gen_random_uuid(),
  deployment_id text not null references deployment_previews(id) on delete cascade,
  task_id uuid references agent_tasks(id) on delete set null,
  status text not null check (status in ('queued','running','passed','failed')),
  checks jsonb not null default '[]'::jsonb,
  duration_ms integer,
  external_url text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists smoke_checks_deployment_idx on smoke_checks(deployment_id, started_at desc);

drop trigger if exists journey_manifests_set_updated_at on journey_manifests;
create trigger journey_manifests_set_updated_at before update on journey_manifests for each row execute function set_updated_at();
drop trigger if exists agent_tasks_set_updated_at on agent_tasks;
create trigger agent_tasks_set_updated_at before update on agent_tasks for each row execute function set_updated_at();
drop trigger if exists deployment_previews_set_updated_at on deployment_previews;
create trigger deployment_previews_set_updated_at before update on deployment_previews for each row execute function set_updated_at();

