import test from 'node:test';import assert from 'node:assert/strict';
import admin from '../api/admin.js';import adminPage from '../api/admin-page.js';
import {COOKIE,digest,SESSION_SECONDS} from '../api/_lib/security.js';
import {env,call,fakeStore,testPassword,testHash} from './helpers.js';
async function login(){return call(admin,{method:'POST',body:{action:'login',password:testPassword}});}
test('sem sessão e cookie inventado não expõem dados',async t=>{env(t);await fakeStore(t);for(const cookie of ['',`${COOKIE}=${'a'.repeat(64)}`]){const r=await call(admin,{headers:{cookie}});assert.equal(r.code,401);assert.equal(r.data.orders,undefined);}const page=await call(adminPage);assert.equal(page.code,200);assert.match(page.html,/Área restrita/);assert.doesNotMatch(page.html,/id="rows"/);assert.match(page.headers['content-security-policy'],/frame-ancestors 'none'/);assert.match(page.headers['cache-control'],/no-store/);});
test('senha errada e limite de tentativas',async t=>{env(t);await fakeStore(t);for(let i=0;i<5;i++){const r=await call(admin,{method:'POST',body:{action:'login',password:'Senha errada suficientemente longa'}});assert.equal(r.code,401);assert.equal(r.headers['set-cookie'],undefined);}assert.equal((await login()).code,429);});
test('login, cookie seguro, sessão servidor, logout e revogação',async t=>{env(t);const store=await fakeStore(t);const r=await login();assert.equal(r.code,200);const cookie=r.headers['set-cookie'];for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=3600'])assert.ok(cookie.includes(flag));const token=cookie.split(';')[0].split('=')[1];const sessions=(await store.db.query('select token_hash from rifa_private.sessions')).rows;assert.equal(sessions[0].token_hash,digest(token));assert.ok(!JSON.stringify(sessions).includes(token));const headers={cookie};assert.equal((await call(admin,{headers})).code,200);assert.match((await call(adminPage,{headers})).html,/id="rows"/);assert.equal((await call(admin,{method:'POST',headers,body:{action:'logout'}})).code,200);assert.equal((await call(admin,{headers})).code,401);});
test('sessão expirada e senha alterada invalidam acesso',async t=>{env(t);const store=await fakeStore(t);let r=await login();let cookie=r.headers['set-cookie'];await store.db.exec("update rifa_private.sessions set expires_at=now()-interval '1 second'");assert.equal((await call(admin,{headers:{cookie}})).code,401);r=await login();cookie=r.headers['set-cookie'];process.env.ADMIN_PASSWORD_HASH='scrypt$'+'a'.repeat(32)+'$'+'b'.repeat(128);assert.equal((await call(admin,{headers:{cookie}})).code,401);assert.equal(SESSION_SECONDS,3600);});
test('origem externa, sem Origin e formulário não JSON são recusados',async t=>{env(t);await fakeStore(t);for(const origin of ['https://evil.example',undefined])assert.equal((await call(admin,{method:'POST',headers:{origin},body:{action:'login',password:testPassword}})).code,403);assert.equal((await call(admin,{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})).code,400);});
test('configuração incompleta e banco indisponível falham fechados',async t=>{env(t);const store=await fakeStore(t);delete process.env.ADMIN_PASSWORD_HASH;assert.equal((await login()).code,503);assert.equal((await call(adminPage)).code,503);process.env.ADMIN_PASSWORD_HASH='plaintext-insecure';assert.equal((await login()).code,503);process.env.ADMIN_PASSWORD_HASH=testHash;store.provider.storageFail=true;assert.equal((await login()).code,503);});
test('senha digitada na Vercel funciona, não vaza e sua troca revoga sessões',async t=>{
 env(t);const store=await fakeStore(t);process.env.ADMIN_PASSWORD=testPassword;
 delete process.env.ADMIN_PASSWORD_HASH;
 const bad=await call(admin,{method:'POST',body:{action:'login',password:'Senha incorreta 123!'}});assert.equal(bad.code,401);
 const r=await login();assert.equal(r.code,200);const cookie=r.headers['set-cookie'];
 assert.equal((await call(admin,{headers:{cookie}})).code,200);
 const page=await call(adminPage,{headers:{cookie}});
 const rows=(await store.db.query('select * from rifa_private.sessions')).rows;
 assert.ok(!JSON.stringify({page,r,rows}).includes(testPassword));
 const first=await import('../api/_lib/security.js');
 const anotherInstance=await import('../api/_lib/security.js?separate-instance');
 assert.equal(first.passwordHash(),anotherInstance.passwordHash());
 process.env.ADMIN_PASSWORD='Outra senha exclusiva 2026!';
 assert.equal((await call(admin,{headers:{cookie}})).code,401);
 assert.equal((await login()).code,401);
});
test('senha direta curta é recusada mesmo com hash alternativo configurado',async t=>{
 env(t);await fakeStore(t);process.env.ADMIN_PASSWORD='curta';
 assert.equal((await login()).code,503);
});
