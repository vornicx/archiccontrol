-- Archic Control milestone 3: conservative commercial prospecting and daily prototype publication.

create table if not exists prospects (
  id text primary key,
  run_date date not null unique,
  name text not null,
  city text,
  category text,
  website_url text,
  social_url text,
  status text not null check (status in ('researching','verified','ready','discarded','blocked')),
  score numeric(5,2),
  verification_confidence text not null default 'unverified' check (verification_confidence in ('unverified','medium','high')),
  evidence jsonb not null default '[]'::jsonb,
  research jsonb not null default '{}'::jsonb,
  price jsonb not null default '{}'::jsonb,
  outreach jsonb not null default '{}'::jsonb,
  repository_full_name text,
  deployment_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_status_date_idx on prospects(status, run_date desc);

drop trigger if exists prospects_set_updated_at on prospects;
create trigger prospects_set_updated_at before update on prospects for each row execute function set_updated_at();
