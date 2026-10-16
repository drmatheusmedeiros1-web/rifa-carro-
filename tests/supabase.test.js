import test from 'node:test';
import assert from 'node:assert/strict';
import {database,migration,env,fakeStore} from './helpers.js';
import {storageConfig,takeRate,rpc} from '../api/_lib/store.js';
const sample={id:'00000000-0000-4000-8000-000000000001',name:'Teste SQL',phone:'+5569999999999',quantity:2,amountCents:10000,webhookHash:'a'.repeat(64)};
test('SQL reaplicável, RLS e RPC bloqueadas para visitantes e usuários comuns',async t=>{
 const db=await database(t);await db.exec(migration);
 const functions=await db.query("select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'rifa_%'");
 assert.equal(functions.rows.length,9);
 for(const role of ['anon','authenticated']){
  for(const fn of functions.rows){const r=await db.query('select has_function_privilege($1,$2::oid,\'EXECUTE\') as allowed',[role,fn.oid]);assert.equal(r.rows[0].allowed,false,role+' '+fn.proname);}
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query("select * from rifa_private.orders"),/permission denied/);
  await assert.rejects(db.query("select public.rifa_orders_list('all',0)"),/permission denied/);
  await assert.rejects(db.query("select public.rifa_order_paid($1,'forged',10000,'slug')",[sample.id]),/permission denied/);
  await db.exec('reset role');
 }
 const tables=await db.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rifa_private' and c.relkind='r'");
 assert.equal(tables.rows.length,3);assert.ok(tables.rows.every(r=>r.relrowsecurity));
 await db.exec('set role service_role');
 await assert.rejects(db.query('select * from rifa_private.orders'),/permission denied/);
 assert.equal((await db.query("select public.rifa_orders_list('all',0) as data")).rows[0].data.total,0);
});
test('restrições monetárias, idempotência e transação exclusiva no PostgreSQL',async t=>{
 const db=await database(t);
 const create=o=>db.query('select public.rifa_order_create($1)',[o]);
 await assert.rejects(create({...sample,amountCents:1}),/check constraint/);
 await create(sample);await assert.rejects(create(sample),/unique constraint/);
 const pay=(id,tx,amount)=>db.query("select public.rifa_order_paid($1,$2,$3,'invoice') as result",[id,tx,amount]).then(r=>r.rows[0].result);
 assert.equal(await pay(sample.id,'tx',1),-3);
 assert.deepEqual(await Promise.all([pay(sample.id,'tx',10000),pay(sample.id,'tx',10000)]),[1,0]);
 await db.query("select public.rifa_order_patch($1,'error')",[sample.id]);
 assert.equal(await pay(sample.id,'another',10000),-2);
 const second={...sample,id:'00000000-0000-4000-8000-000000000002'};await create(second);
 assert.equal(await pay(second.id,'tx',10000),-4);
 const result=(await db.query("select public.rifa_orders_list('paid',0) as data")).rows[0].data;
 assert.equal(result.total,1);assert.equal(result.summary.paidCents,10000);assert.equal(result.summary.totalOrders,2);
 assert.equal(result.orders[0].webhookHash,undefined);assert.equal(result.orders[0].transaction,undefined);
 await assert.rejects(db.query("select public.rifa_order_patch($1,'paid')",[second.id]),/Invalid status/);
});
test('limite de login é persistente e reinicia depois de expirar',async t=>{
 env(t);const {db}=await fakeStore(t);
 for(let i=0;i<5;i++)assert.equal(await takeRate('login:test',5,900),true);
 assert.equal(await takeRate('login:test',5,900),false);
 await db.exec("update rifa_private.rate_limits set expires_at=now()-interval '1 second'");
 assert.equal(await takeRate('login:test',5,900),true);
});
test('credencial privada só no backend, chaves públicas recusadas',async t=>{
 env(t);const {provider}=await fakeStore(t);
 await rpc('rifa_orders_list',{p_status:'all',p_page:0});
 assert.equal(provider.databaseCalls[0].headers.apikey,'sb_secret_test_only');
 assert.equal(provider.databaseCalls[0].headers.Authorization,undefined);
 for(const key of ['', 'sb_publishable_test',`e30.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.signature`]){
  process.env.SUPABASE_SECRET_KEY=key;assert.throws(storageConfig,/Storage unavailable/);
 }
 process.env.SUPABASE_SECRET_KEY='';
 process.env.SUPABASE_SERVICE_ROLE_KEY=`e30.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`;
 await rpc('rifa_orders_list',{p_status:'all',p_page:0});
 assert.equal(provider.databaseCalls[1].headers.Authorization,`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
});
