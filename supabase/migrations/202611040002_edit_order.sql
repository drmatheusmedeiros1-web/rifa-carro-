-- Execute no SQL Editor do projeto tkjeabbsyvidysltwufi.
-- Alterações locais não modificam cobranças já criadas na InfinitePay.
begin;
alter table rifa_private.orders add column if not exists quantity_changes jsonb not null default '[]'::jsonb;
create or replace function public.rifa_order_edit(p_id uuid,p_quantity bigint,p_expected_quantity bigint)
returns integer language plpgsql security definer set search_path='' as $$
declare o rifa_private.orders%rowtype;
begin
 if p_quantity is null or p_quantity not between 1 and 1801439850948 or p_expected_quantity is null then raise exception 'Invalid quantity'; end if;
 select * into o from rifa_private.orders where id=p_id for update;
 if not found then return -1; end if;
 if o.status not in ('creating','pending','error') then return -2; end if;
 if o.quantity<>p_expected_quantity then return -3; end if;
 if o.quantity=p_quantity then return 0; end if;
 update rifa_private.orders set quantity=p_quantity,amount_cents=p_quantity*5000,
 quantity_changes=quantity_changes||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'from',o.quantity,'to',p_quantity,'source','manual-admin')) where id=p_id;
 return 1;
end $$;
revoke all on function public.rifa_order_edit(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.rifa_order_edit(uuid,bigint,bigint) to service_role;
notify pgrst,'reload schema';
commit;
