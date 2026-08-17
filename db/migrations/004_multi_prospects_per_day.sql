-- Archic Control milestone 4: store each qualified daily opportunity as its own prospect.

alter table prospects drop constraint if exists prospects_run_date_key;

create index if not exists prospects_run_date_idx
  on prospects(run_date desc, score desc, created_at asc);

create unique index if not exists prospects_run_date_name_uidx
  on prospects(run_date, lower(name));
