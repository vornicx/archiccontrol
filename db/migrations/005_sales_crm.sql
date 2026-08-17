-- Archic Sales V1: a focused commercial workspace for Antero and the Archic pipeline.

create table if not exists sales_leads (
  id text primary key,
  prospect_id text references prospects(id) on delete set null,
  name text not null,
  city text,
  category text,
  stage text not null default 'found' check (stage in ('found','researched','prototype','contacted','interested','meeting','proposal','negotiation','won','lost')),
  score numeric(5,2),
  estimated_value numeric(12,2),
  contact_name text,
  phone text,
  email text,
  website_url text,
  social_url text,
  prototype_url text,
  repository_full_name text,
  owner text not null default 'antero' check (owner in ('antero','vadim')),
  next_action_owner text not null default 'antero' check (next_action_owner in ('antero','vadim')),
  next_action text,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_leads_stage_idx on sales_leads(stage, score desc);
create index if not exists sales_leads_next_action_idx on sales_leads(next_action_owner, next_action_at) where next_action is not null;

drop trigger if exists sales_leads_set_updated_at on sales_leads;
create trigger sales_leads_set_updated_at before update on sales_leads for each row execute function set_updated_at();

create table if not exists sales_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references sales_leads(id) on delete cascade,
  type text not null check (type in ('call','message','email','note','stage_change')),
  outcome text check (outcome is null or outcome in ('no_answer','call_later','interested','wants_proposal','meeting','not_interested','won')),
  note text,
  actor text not null default 'antero' check (actor in ('antero','vadim','system')),
  created_at timestamptz not null default now()
);

create index if not exists sales_activities_lead_created_idx on sales_activities(lead_id, created_at desc);

insert into sales_leads(id,name,city,category,stage,score,estimated_value,website_url,prototype_url,repository_full_name,owner,next_action_owner,next_action,next_action_at,last_contact_at,notes)
values
('finca-la-sevillana','Finca La Sevillana','Écija','Eventos','prototype',78,550,null,null,'vornicx/fincalasevillana','antero','antero','Llamar y presentar el prototipo','2026-08-18 10:30:00+02',null,'Prototipo preparado. La llamada debe centrarse en enseñar el resultado, no en vender una lista de funciones.'),
('five-star-rentals','Five Star Rentals','Marbella','Luxury car rental','contacted',86,700,'https://fivestars-rental.com/en/','https://fivestarrentals.vercel.app','vornicx/fivestarrentals','antero','antero','Llamar si sigue sin responder al WhatsApp','2026-08-18 12:30:00+02','2026-08-15 20:00:00+02','El responsable pidió continuar por WhatsApp. Ya recibió el prototipo.'),
('zusto-cafe','Zusto Café','Puerto Banús','Café','contacted',82,650,null,null,null,'antero','antero','Segundo intento de llamada','2026-08-18 13:00:00+02','2026-08-17 19:00:00+02','La última llamada no fue contestada. Mantener el siguiente contacto corto y directo.'),
('prisma-renting','PRISMA Renting','España','Renting','prototype',88,700,'https://prismarenting.com/','https://prismarenting.netlify.app/',null,'vadim','vadim','Terminar el prototipo y preparar el handoff comercial','2026-08-18 09:30:00+02',null,'Primero completar migración y elevar la landing. Después pasa a Antero para contacto.'),
('cafe-los-rosarios','Café Los Rosarios','Écija','Café','researched',74,500,null,null,null,'vadim','vadim','Preparar prototipo antes de contactar','2026-08-18 16:00:00+02',null,'Lead local para el modelo de web rápida de alta calidad.'),
('la-bocana','La Bocana','Puerto Banús','Restaurante','contacted',90,6500,null,null,null,'antero','antero','Revisar respuesta al correo y hacer follow-up','2026-08-19 11:00:00+02','2026-08-15 19:00:00+02','Oportunidad de mayor alcance. Mantener separada del paquete de webs rápidas.')
on conflict(id) do nothing;

insert into sales_activities(lead_id,type,outcome,note,actor,created_at)
select 'five-star-rentals','message',null,'Prototipo enviado por WhatsApp tras la llamada inicial.','antero','2026-08-15 20:00:00+02'
where not exists (select 1 from sales_activities where lead_id='five-star-rentals' and note='Prototipo enviado por WhatsApp tras la llamada inicial.');

insert into sales_activities(lead_id,type,outcome,note,actor,created_at)
select 'zusto-cafe','call','no_answer','No respondió la llamada.','antero','2026-08-17 19:00:00+02'
where not exists (select 1 from sales_activities where lead_id='zusto-cafe' and note='No respondió la llamada.');
