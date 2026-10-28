import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {env,fakeStore,call,database} from './helpers.js';
import checkout from '../api/checkout.js';
import webhook from '../api/payment-webhook.js';
import receipt from '../api/receipt.js';
import {page} from '../api/_lib/admin-view.js';
const migration=readFileSync(new URL('../supabase/migrations/202610280001_ticket_numbers.sql',import.meta.url),'utf8');
test('recibo exige token; somente confirmação emite números; replay preserva números',async t=>{
 env(t);const {db,provider}=await fakeStore(t);
 const buy=await call(checkout,{method:'POST',body:{name:'Teste',phone:'69999999999',quantity:2}});assert.equal(buy.code,200);
 const payload=provider.calls[0].body,u=new URL(payload.redirect_url);
 const body={id:u.searchParams.get('pedido'),token:new URLSearchParams(u.hash.slice(1)).get('token')};
 assert.equal((await call(receipt,{method:'POST',body:{...body,token:'0'.repeat(64)}})).code,404);
 let r=await call(receipt,{method:'POST',body});assert.equal(r.data.ticketStart,null);assert.equal(r.data.status,'pending');
 provider.check={success:true,paid:true,amount:10000};const event={order_nsu:body.id,transaction_nsu:'test-tickets',invoice_slug:'invoice-test'};
 for(let i=0;i<2;i++)assert.equal((await call(webhook,{method:'POST',url:payload.webhook_url,body:event})).code,200);
 r=await call(receipt,{method:'POST',body});assert.equal(r.data.ticketStart,1);assert.equal(r.data.ticketEnd,2);assert.equal(r.data.phone,undefined);
 const listing=(await db.query("select public.rifa_orders_list('paid',0) as data")).rows[0].data;assert.equal(listing.orders[0].ticketStart,1);
 assert.equal(listing.orders[0].receipt_hash,undefined);
 await db.exec(migration);assert.equal((await call(receipt,{method:'POST',body})).data.ticketStart,1);
 await db.exec('set role anon');await assert.rejects(db.query('select public.rifa_receipt($1,$2)',[body.id,'0'.repeat(64)]),/permission denied/);
});
test('atribuição serializada, intervalos exclusivos e números imutáveis',async t=>{
 const db=await database(t);
 for(let i=1;i<=3;i++)await db.query("select public.rifa_order_create($1)",[JSON.stringify({id:`00000000-0000-4000-8000-00000000000${i}`,name:'Teste',phone:'+5569999999999',quantity:i,amountCents:i*5000,webhookHash:'a'.repeat(64)})]);
 await Promise.all([1,2].map(i=>db.query("select public.rifa_order_paid($1,$2,$3,'invoice')",[`00000000-0000-4000-8000-00000000000${i}`,'transaction-'+i,i*5000])));
 const rows=(await db.query('select ticket_start,ticket_end from rifa_private.orders where ticket_start is not null order by ticket_start')).rows;
 assert.equal(Number(rows[0].ticket_start),1);assert.equal(Number(rows[1].ticket_start),Number(rows[0].ticket_end)+1);assert.equal(Number(rows[1].ticket_end),3);
 await assert.rejects(db.query('update rifa_private.orders set ticket_start=100 where ticket_start=1'),/immutable/);
 assert.equal((await db.query("select ticket_start from rifa_private.orders where status='creating'")).rows[0].ticket_start,null);
});
test('scripts de confirmação e painel têm sintaxe válida e ações previstas',()=>{
 const html=readFileSync(new URL('../obrigado.html',import.meta.url),'utf8');
 for(const text of [html,page('test',true)])for(const match of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 assert.match(html,/wa.me\/556999652006/);assert.match(page('test',true),/Copiar mensagem/);
});
test('migração numera compra paga anterior e mantém pendente sem números',async t=>{
 const db=await database(t);await db.exec('drop trigger assign_tickets on rifa_private.orders');
 for(let i=1;i<=2;i++)await db.query('select public.rifa_order_create($1)',[{id:`00000000-0000-4000-8000-00000000000${i}`,name:'Anterior',phone:'+5569999999999',quantity:2,amountCents:10000,webhookHash:'a'.repeat(64)}]);
 await db.query("select public.rifa_order_paid('00000000-0000-4000-8000-000000000001','old-paid',10000,'old-invoice')");
 await db.exec(migration);
 const rows=(await db.query('select status,ticket_start,ticket_end from rifa_private.orders order by id')).rows;
 assert.equal(Number(rows[0].ticket_start),1);assert.equal(Number(rows[0].ticket_end),2);assert.equal(rows[1].ticket_start,null);
 const found=(await db.query('select public.rifa_orders_find(2) as data')).rows[0].data;assert.equal(found.total,1);assert.equal(found.orders[0].name,'Anterior');
});
