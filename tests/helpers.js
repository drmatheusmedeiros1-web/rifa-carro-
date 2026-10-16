import {scryptSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
export const testPassword='Test-only password 2026!';
const salt='b'.repeat(32);
export const testHash=`scrypt$${salt}$${scryptSync(testPassword,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}`;
export function env(t){const values={APP_ORIGIN:'https://rifa.example',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_only',SUPABASE_SERVICE_ROLE_KEY:'',ADMIN_PASSWORD_HASH:testHash,ADMIN_PASSWORD:'',VERCEL:'0'};for(const [k,v]of Object.entries(values)){const old=process.env[k];process.env[k]=v;t.after(()=>{if(old===undefined)delete process.env[k];else process.env[k]=old;});}}
export async function call(handler,{method='GET',body,url='/api/admin',headers={},ip='127.0.0.1'}={}){const req={method,body,url,headers:{origin:'https://rifa.example','content-type':'application/json',...headers},socket:{remoteAddress:ip}};const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v},status(n){this.code=n;return this},json(x){this.data=x;return this},send(x){this.html=x;return this},end(){return this}};await handler(req,res);return res;}
export const migration=readFileSync(new URL('../supabase/migrations/202610160001_rifa_admin.sql',import.meta.url),'utf8');
export async function database(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec('create role anon; create role authenticated; create role service_role;');
 // Reproduce Supabase's default public function grants to check their revocation.
 await db.exec('alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;');
 await db.exec(migration);return db;
}
export async function fakeStore(t){
 const db=await database(t);
 const provider={calls:[],databaseCalls:[],link:{url:'https://checkout.infinitepay.com.br/test'},check:{success:true,paid:true,amount:35000},fail:false};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(url.startsWith('https://test.supabase.co/rest/v1/rpc/')){
   if(provider.storageFail)throw Error('DB down');
   provider.databaseCalls.push({url,headers:options.headers});
   const fn=url.split('/').pop(),params=JSON.parse(options.body),names=Object.keys(params);
   if(!/^rifa_[a-z_]+$/.test(fn)||names.some(n=>!/^p_[a-z_]+$/.test(n)))throw Error('Invalid test query');
   await db.exec('set role service_role');
   try {
    const result=await db.query(`select public.${fn}(${names.map((n,i)=>`${n} => $${i+1}`).join(',')}) as result`,Object.values(params));
    return {ok:true,json:async()=>result.rows[0].result};
   } catch {return {ok:false,json:async()=>({message:'Database error'})};}
   finally {await db.exec('reset role');}
  }
  if(!url.startsWith('https://api.checkout.infinitepay.io/'))throw Error('Unexpected URL');
  provider.calls.push({url,body:JSON.parse(options.body)});if(provider.fail)throw Error('Provider unavailable');
  return {ok:true,json:async()=>url.endsWith('payment_check')?provider.check:provider.link};
 });return {db,provider};
}
