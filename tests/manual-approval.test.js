import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {env,fakeStore,call,testPassword} from './helpers.js';
import admin from '../api/admin.js';import checkout from '../api/checkout.js';import webhook from '../api/payment-webhook.js';
import {page} from '../api/_lib/admin-view.js';
const buyer={name:'Teste aprovação',phone:'69999999999',quantity:2};
async function setup(t){env(t);const context=await fakeStore(t);await call(checkout,{method:'POST',body:buyer});const payment=context.provider.calls[0].body;const login=await call(admin,{method:'POST',body:{action:'login',password:testPassword}});const headers={cookie:login.headers['set-cookie']};return {...context,payment,headers,body:{action:'approve_payment',id:payment.order_nsu,amountCents:10000,confirmed:true}};}
test('aprovação exige sessão, origem, confirmação e valor do pedido',async t=>{
 const s=await setup(t);
 assert.equal((await call(admin,{method:'POST',body:s.body})).code,401);
 assert.equal((await call(admin,{method:'POST',body:s.body,headers:{...s.headers,origin:'https://evil.example'}})).code,403);
 assert.equal((await call(admin,{method:'POST',body:{...s.body,confirmed:false},headers:s.headers})).code,400);
 assert.equal((await call(admin,{method:'POST',body:{...s.body,amountCents:1},headers:s.headers})).code,409);
 assert.equal((await call(admin,{method:'POST',body:{...s.body,id:'00000000-0000-4000-8000-000000000000'},headers:s.headers})).code,404);
 const order=(await s.db.query('select status,ticket_start from rifa_private.orders')).rows[0];assert.equal(order.status,'pending');assert.equal(order.ticket_start,null);
});
test('aprovação manual emite números uma vez, registra origem e aceita webhook posterior sem duplicar',async t=>{
 const s=await setup(t);
 assert.equal((await call(admin,{method:'POST',body:s.body,headers:s.headers})).code,200);
 assert.equal((await call(admin,{method:'POST',body:s.body,headers:s.headers})).data.alreadyPaid,true);
 const order=(await s.db.query('select status,transaction_id,invoice_slug,ticket_start,ticket_end,paid_at from rifa_private.orders')).rows[0];
 assert.equal(order.status,'paid');assert.equal(order.transaction_id,'manual-'+s.body.id);assert.equal(order.invoice_slug,'manual-admin');assert.equal(Number(order.ticket_start),1);assert.equal(Number(order.ticket_end),2);assert.ok(order.paid_at);
 s.provider.check={success:true,paid:true,amount:10000};const event={order_nsu:s.body.id,transaction_nsu:'provider-after-manual',invoice_slug:'invoice-paid'};
 assert.equal((await call(webhook,{method:'POST',url:s.payment.webhook_url,body:event})).code,200);
 const listed=await call(admin,{headers:s.headers});assert.equal(listed.data.summary.paidCents,10000);assert.equal(listed.data.summary.paidQuantity,2);assert.equal(listed.data.orders[0].ticketStart,1);
 s.provider.check.paid=false;assert.equal((await call(webhook,{method:'POST',url:s.payment.webhook_url,body:event})).code,400);
 assert.equal((await s.db.query('select transaction_id from rifa_private.orders')).rows[0].transaction_id,'manual-'+s.body.id);
});
test('painel inclui ação com confirmação; script permanece válido',()=>{
 const html=page('test',true);assert.match(html,/Aprovar pagamento/);assert.match(html,/window.confirm/);for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
