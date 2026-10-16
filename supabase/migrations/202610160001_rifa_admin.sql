-- Apply in the SQL Editor of jjbyiajueojdpidmknut as the project database owner.
-- Dedicated schema: no changes to Auth users or unrelated application tables.
begin;
create schema if not exists rifa_private;
revoke all on schema rifa_private from public, anon, authenticated, service_role;

create table if not exists rifa_private.orders (
 id uuid primary key,
 name text not null check (char_length(name) between 2 and 100),
 phone text not null check (phone ~ '^\+55[1-9][0-9]{9,10}$'),
 quantity bigint not null check (quantity between 1 and 1801439850948),
 amount_cents bigint not null check (amount_cents = quantity * 5000),
 status text not null default 'creating' check (status in ('creating','pending','error','paid')),
 created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
 webhook_hash text not null check (webhook_hash ~ '^[a-f0-9]{64}$'),
 transaction_id text unique,
 invoice_slug text,
 paid_at bigint,
 check ((status = 'paid') = (transaction_id is not null and paid_at is not null)),
 check (transaction_id is null or transaction_id ~ '^[-a-zA-Z0-9_.]{1,128}$')
);
create index if not exists orders_created on rifa_private.orders(created_at desc, id desc);
create index if not exists orders_status_created on rifa_private.orders(status, created_at desc, id desc);
create table if not exists rifa_private.sessions (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 data jsonb not null,
 expires_at timestamptz not null
);
create index if not exists sessions_expiry on rifa_private.sessions(expires_at);
create table if not exists rifa_private.rate_limits (
 bucket text primary key,
 attempts integer not null,
 expires_at timestamptz not null
);
create index if not exists rate_expiry on rifa_private.rate_limits(expires_at);
alter table rifa_private.orders enable row level security;
alter table rifa_private.sessions enable row level security;
alter table rifa_private.rate_limits enable row level security;
revoke all on all tables in schema rifa_private from public, anon, authenticated, service_role;

-- SECURITY DEFINER functions are callable only by the server's service_role.
-- Empty search_path and fully qualified tables prevent object substitution.
create or replace function public.rifa_take_rate(p_bucket text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
 if p_bucket is null or length(p_bucket)>150 or p_limit is null or p_limit not between 1 and 1000 or p_seconds is null or p_seconds not between 1 and 86400 then raise exception 'Invalid limit'; end if;
 delete from rifa_private.rate_limits where expires_at <= now();
 insert into rifa_private.rate_limits as r(bucket,attempts,expires_at)
 values(p_bucket,1,now()+make_interval(secs=>p_seconds))
 on conflict(bucket) do update set
 attempts=case when r.expires_at<=now() then 1 else least(r.attempts+1,1000000) end,
 expires_at=case when r.expires_at<=now() then now()+make_interval(secs=>p_seconds) else r.expires_at end
 returning attempts into n;
 return n <= p_limit;
end $$;
create or replace function public.rifa_session_get(p_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
 select data from rifa_private.sessions where token_hash=p_hash and expires_at>now();
$$;
create or replace function public.rifa_session_set(p_hash text,p_data jsonb,p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_seconds is null or p_seconds not between 1 and 3600 or p_data is null then raise exception 'Invalid session'; end if;
 delete from rifa_private.sessions where expires_at<=now();
 insert into rifa_private.sessions(token_hash,data,expires_at) values(p_hash,p_data,now()+make_interval(secs=>p_seconds));
 return true;
end $$;
create or replace function public.rifa_session_delete(p_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 delete from rifa_private.sessions where token_hash=p_hash;
 return true;
end $$;
create or replace function public.rifa_order_create(p_order jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
begin
 insert into rifa_private.orders(id,name,phone,quantity,amount_cents,webhook_hash)
 values((p_order->>'id')::uuid,p_order->>'name',p_order->>'phone',(p_order->>'quantity')::bigint,(p_order->>'amountCents')::bigint,p_order->>'webhookHash');
 return 1;
end $$;
create or replace function public.rifa_order_get(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',id,'name',name,'phone',phone,'quantity',quantity,'amountCents',amount_cents,'status',status,'createdAt',created_at,'webhookHash',webhook_hash,'transaction',transaction_id,'invoiceSlug',invoice_slug,'paidAt',paid_at)
 from rifa_private.orders where id=p_id;
$$;
create or replace function public.rifa_order_patch(p_id uuid,p_status text)
returns integer language plpgsql security definer set search_path = '' as $$
begin
 if p_status is null or p_status not in ('pending','error') then raise exception 'Invalid status'; end if;
 -- Concurrent UPDATE waits for the row lock and rechecks status afterwards.
 update rifa_private.orders set status=p_status where id=p_id and status<>'paid';
 return 1;
end $$;
create or replace function public.rifa_order_paid(p_id uuid,p_transaction text,p_amount bigint,p_slug text)
returns integer language plpgsql security definer set search_path = '' as $$
declare o rifa_private.orders%rowtype;
begin
 if p_transaction is null or p_transaction !~ '^[-a-zA-Z0-9_.]{1,128}$' or p_slug is null or p_slug !~ '^[-a-zA-Z0-9_]{1,160}$' then raise exception 'Invalid payment'; end if;
 select * into o from rifa_private.orders where id=p_id for update;
 if not found then return -1; end if;
 if o.status='paid' then
  if o.transaction_id=p_transaction then return 0; else return -2; end if;
 end if;
 if p_amount is null or o.amount_cents<>p_amount then return -3; end if;
 begin
  update rifa_private.orders set status='paid',transaction_id=p_transaction,invoice_slug=p_slug,paid_at=(extract(epoch from now())*1000)::bigint where id=p_id;
 exception when unique_violation then return -4;
 end;
 return 1;
end $$;
create or replace function public.rifa_orders_list(p_status text,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rows jsonb; total bigint; summary jsonb;
begin
 if p_status is null or p_status not in ('all','pending','paid','error') or p_page is null or p_page not between 0 and 100000 then raise exception 'Invalid filter'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'phone',o.phone,'quantity',o.quantity,'amountCents',o.amount_cents,'status',o.status,'createdAt',o.created_at,'paidAt',o.paid_at) order by o.created_at desc,o.id desc),'[]'::jsonb) into rows
 from (select * from rifa_private.orders where p_status='all' or status=p_status or (p_status='pending' and status='creating') order by created_at desc,id desc limit 50 offset p_page*50) o;
 select count(*) into total from rifa_private.orders where p_status='all' or status=p_status or (p_status='pending' and status='creating');
 select jsonb_build_object('paidCents',coalesce(sum(amount_cents) filter(where status='paid'),0),'paidQuantity',coalesce(sum(quantity) filter(where status='paid'),0),'paidOrders',count(*) filter(where status='paid'),'totalOrders',count(*)) into summary from rifa_private.orders;
 return jsonb_build_object('orders',rows,'total',total,'page',p_page,'pageSize',50,'summary',summary);
end $$;

-- Supabase may grant new public functions to anon/authenticated by default.
-- Explicitly revoke each of OUR functions; never change unrelated functions.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('rifa_take_rate','rifa_session_get','rifa_session_set','rifa_session_delete','rifa_order_create','rifa_order_get','rifa_order_patch','rifa_order_paid','rifa_orders_list')
 loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
