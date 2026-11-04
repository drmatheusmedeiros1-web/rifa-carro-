-- Execute no SQL Editor do projeto tkjeabbsyvidysltwufi.
-- Cancela somente o registro local; não estorna nem invalida links da InfinitePay.
begin;
alter table rifa_private.orders drop constraint if exists orders_status_check;
alter table rifa_private.orders add constraint orders_status_check check(status in ('creating','pending','error','paid','cancelled'));
alter table rifa_private.orders add column if not exists cancelled_at bigint;
create or replace function public.rifa_order_cancel(p_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare o rifa_private.orders%rowtype;
begin
 select * into o from rifa_private.orders where id=p_id for update;
 if not found then return -1; end if;
 if o.status='paid' then return -2; end if;
 if o.status='cancelled' then return 0; end if;
 update rifa_private.orders set status='cancelled',cancelled_at=(extract(epoch from now())*1000)::bigint where id=p_id;
 return 1;
end $$;
create or replace function public.rifa_order_patch(p_id uuid,p_status text)
returns integer language plpgsql security definer set search_path = '' as $$
begin
 if p_status is null or p_status not in ('pending','error') then raise exception 'Invalid status'; end if;
 -- Concurrent UPDATE waits for the row lock and rechecks status afterwards.
 update rifa_private.orders set status=p_status where id=p_id and status not in ('paid','cancelled');
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
 if o.status='cancelled' and p_transaction='manual-'||p_id::text then return -5; end if;
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
 if p_status is null or p_status not in ('all','pending','paid','error','cancelled') or p_page is null or p_page not between 0 and 100000 then raise exception 'Invalid filter'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'phone',o.phone,'quantity',o.quantity,'amountCents',o.amount_cents,'status',o.status,'createdAt',o.created_at,'paidAt',o.paid_at,'ticketStart',o.ticket_start,'ticketEnd',o.ticket_end) order by o.created_at desc,o.id desc),'[]'::jsonb) into rows
 from (select * from rifa_private.orders where p_status='all' or status=p_status or (p_status='pending' and status='creating') order by created_at desc,id desc limit 50 offset p_page*50) o;
 select count(*) into total from rifa_private.orders where p_status='all' or status=p_status or (p_status='pending' and status='creating');
 select jsonb_build_object('paidCents',coalesce(sum(amount_cents) filter(where status='paid'),0),'paidQuantity',coalesce(sum(quantity) filter(where status='paid'),0),'paidOrders',count(*) filter(where status='paid'),'totalOrders',count(*)) into summary from rifa_private.orders;
 return jsonb_build_object('orders',rows,'total',total,'page',p_page,'pageSize',50,'summary',summary);
end $$;
revoke all on function public.rifa_order_cancel(uuid),public.rifa_order_patch(uuid,text),public.rifa_order_paid(uuid,text,bigint,text),public.rifa_orders_list(text,integer) from public,anon,authenticated;
grant execute on function public.rifa_order_cancel(uuid),public.rifa_order_patch(uuid,text),public.rifa_order_paid(uuid,text,bigint,text),public.rifa_orders_list(text,integer) to service_role;
notify pgrst,'reload schema';
commit;
