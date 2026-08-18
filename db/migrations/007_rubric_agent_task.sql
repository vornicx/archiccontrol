-- Archic Control milestone 7: automated visual rubric reviewer tasks.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'agent_tasks'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%task_type%';

  if constraint_name is not null then
    execute format('alter table agent_tasks drop constraint %I', constraint_name);
  end if;
end $$;

alter table agent_tasks
  add constraint agent_tasks_task_type_check
  check (task_type in ('research','implement','autofix','quality','rubric','playwright','benchmark','preview','smoke','monitor'));
