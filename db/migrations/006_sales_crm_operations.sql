-- Archic Sales V2: manual CRM operations, pricing and multiple contacts.

alter table sales_leads
  add column if not exists quoted_price numeric(12,2),
  add column if not exists maintenance_monthly numeric(12,2),
  add column if not exists source text;

create table if not exists sales_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references sales_leads(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  whatsapp text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_contacts_lead_idx on sales_contacts(lead_id, is_primary desc, created_at);

drop trigger if exists sales_contacts_set_updated_at on sales_contacts;
create trigger sales_contacts_set_updated_at before update on sales_contacts for each row execute function set_updated_at();

-- Preserve any primary contact already stored on the V1 lead record.
insert into sales_contacts(lead_id,name,phone,email,is_primary,notes)
select id,
       coalesce(nullif(contact_name,''), 'Contacto principal'),
       phone,
       email,
       true,
       'Importado automáticamente desde la ficha comercial V1.'
from sales_leads l
where (contact_name is not null or phone is not null or email is not null)
  and not exists (select 1 from sales_contacts c where c.lead_id=l.id);

create table if not exists sales_pipeline_stages (
  key text primary key,
  label text not null,
  position integer not null,
  active boolean not null default true,
  probability integer not null default 0 check (probability between 0 and 100),
  terminal boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint sales_pipeline_stage_key check (key in ('found','researched','prototype','contacted','interested','meeting','proposal','negotiation','won','lost'))
);

drop trigger if exists sales_pipeline_stages_set_updated_at on sales_pipeline_stages;
create trigger sales_pipeline_stages_set_updated_at before update on sales_pipeline_stages for each row execute function set_updated_at();

insert into sales_pipeline_stages(key,label,position,active,probability,terminal)
values
  ('found','Encontrado',10,true,5,false),
  ('researched','Investigado',20,true,10,false),
  ('prototype','Prototipo',30,true,20,false),
  ('contacted','Contactado',40,true,25,false),
  ('interested','Interesado',50,true,45,false),
  ('meeting','Reunión',60,true,60,false),
  ('proposal','Propuesta',70,true,70,false),
  ('negotiation','Negociación',80,true,85,false),
  ('won','Ganado',90,true,100,true),
  ('lost','Perdido',100,false,0,true)
on conflict(key) do nothing;
