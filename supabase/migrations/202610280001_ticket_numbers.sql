-- Execute no SQL Editor do projeto tkjeabbsyvidysltwufi.
begin;
lock table rifa_private.orders in share row exclusive mode;
alter table rifa_private.orders add column if not exists ticket_start bigint;
alter table rifa_private.orders add column if not exists ticket_end bigint;
alter table rifa_private.orders add column if not exists receipt_hash text check (receipt_hash ~ '^[a-f0-9]{64}$');
create table if not exists rifa_private.ticket_counter (id boolean primary key default true check(id), next_number bigint not null check(next_number>0));
insert into rifa_private.ticket_counter(id,next_number) values(true,1) on conflict do nothing;
alter table rifa_private.ticket_counter enable row level security;
revoke all on rifa_private.ticket_counter from public,anon,authenticated,service_role;
create or replace function rifa_private.assign_tickets() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and OLD.ticket_start is not null then
  if NEW.ticket_start is distinct from OLD.ticket_start or NEW.ticket_end is distinct from OLD.ticket_end or NEW.quantity<>OLD.quantity or NEW.status<>'paid' then raise exception 'Issued tickets are immutable'; end if;
  return NEW;
 end if;
 if NEW.status='paid' then
  update rifa_private.ticket_counter set next_number=next_number+NEW.quantity where id=true
  returning next_number-NEW.quantity, next_number-1 into NEW.ticket_start,NEW.ticket_end;
 else NEW.ticket_start=null; NEW.ticket_end=null;
 end if;
 return NEW;
end $$;
revoke all on function rifa_private.assign_tickets() from public,anon,authenticated,service_role;
drop trigger if exists assign_tickets on rifa_private.orders;
create trigger assign_tickets before insert or update on rifa_private.orders for each row execute function rifa_private.assign_tickets();
-- Somente pagamentos já confirmados recebem números; pedidos pendentes permanecem intactos.
do $$ declare r record; begin
 for r in select id from rifa_private.orders where status='paid' and ticket_start is null order by paid_at,created_at,id loop
  update rifa_private.orders set status=status where id=r.id;
 end loop;
end $$;
create or replace function public.rifa_order_create(p_order jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
begin
 insert into rifa_private.orders(id,name,phone,quantity,amount_cents,webhook_hash,receipt_hash)
 values((p_order->>'id')::uuid,p_order->>'name',p_order->>'phone',(p_order->>'quantity')::bigint,(p_order->>'amountCents')::bigint,p_order->>'webhookHash',p_order->>'receiptHash');
 return 1;
end $$;
create or replace function public.rifa_orders_list(p_status text,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rows jsonb; total bigint; summary jsonb;
begin
 if p_status is null or p_status not in ('all','pending','paid','error') or p_page is null or p_page not between 0 and 100000 then raise exception 'Invalid filter'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'phone',o.phone,'quantity',o.quantity,'amountCents',o.amount_cents,'status',o.status,'createdAt',o.created_at,'paidAt',o.paid_at,'ticketStart',o.ticket_start,'ticketEnd',o.ticket_end) order by o.created_at desc,o.id desc),'[]'::jsonb) into rows
 from (select * from rifa_private.orders where p_status='all' or status=p_status or (p_status='pending' and status='creating') order by created_at desc,id desc limit 50 offset p_page*50) o;
 select count(*) into total from rifa_private.orders where p_status='all' or status=p_status or (p_status='pending' and status='creating');
 select jsonb_build_object('paidCents',coalesce(sum(amount_cents) filter(where status='paid'),0),'paidQuantity',coalesce(sum(quantity) filter(where status='paid'),0),'paidOrders',count(*) filter(where status='paid'),'totalOrders',count(*)) into summary from rifa_private.orders;
 return jsonb_build_object('orders',rows,'total',total,'page',p_page,'pageSize',50,'summary',summary);
end $$;


create or replace function public.rifa_receipt(p_id uuid,p_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'name',name,'status',status,'quantity',quantity,'ticketStart',ticket_start,'ticketEnd',ticket_end)
 from rifa_private.orders where id=p_id and receipt_hash=p_hash;
$$;
revoke all on function public.rifa_receipt(uuid,text) from public,anon,authenticated;
grant execute on function public.rifa_receipt(uuid,text) to service_role;
revoke all on function public.rifa_order_create(jsonb),public.rifa_orders_list(text,integer) from public,anon,authenticated;
grant execute on function public.rifa_order_create(jsonb),public.rifa_orders_list(text,integer) to service_role;
create or replace function public.rifa_orders_find(p_ticket bigint) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('orders',coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone,'quantity',quantity,'amountCents',amount_cents,'status',status,'createdAt',created_at,'paidAt',paid_at,'ticketStart',ticket_start,'ticketEnd',ticket_end)),'[]'::jsonb),'total',count(*),'page',0,'pageSize',50,'summary',public.rifa_orders_list('all',0)->'summary')
 from rifa_private.orders where p_ticket between ticket_start and ticket_end;
$$;
revoke all on function public.rifa_orders_find(bigint) from public,anon,authenticated;
grant execute on function public.rifa_orders_find(bigint) to service_role;
notify pgrst,'reload schema';
commit;
