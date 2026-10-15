import {scryptSync} from 'node:crypto';
import {rateScript,key} from '../api/_lib/store.js';
import {createScript,patchScript,paidScript} from '../api/_lib/orders.js';
export const testPassword='Test-only password 2026!';
const salt='b'.repeat(32);
export const testHash=`scrypt$${salt}$${scryptSync(testPassword,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}`;
export function env(t){const values={APP_ORIGIN:'https://rifa.example',KV_REST_API_URL:'https://redis.example',KV_REST_API_TOKEN:'test-only',ADMIN_PASSWORD_HASH:testHash,VERCEL:'0'};for(const [k,v]of Object.entries(values)){const old=process.env[k];process.env[k]=v;t.after(()=>{if(old===undefined)delete process.env[k];else process.env[k]=old;});}}
export async function call(handler,{method='GET',body,url='/api/admin',headers={},ip='127.0.0.1'}={}){const req={method,body,url,headers:{origin:'https://rifa.example','content-type':'application/json',...headers},socket:{remoteAddress:ip}};const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v},status(n){this.code=n;return this},json(x){this.data=x;return this},send(x){this.html=x;return this},end(){return this}};await handler(req,res);return res;}
export function fakeStore(t){const strings=new Map(),zsets=new Map(),hashes=new Map(),expires=new Map();const provider={calls:[],link:{url:'https://checkout.infinitepay.com.br/test'},check:{success:true,paid:true,amount:35000},fail:false};const z=(k)=>{if(!zsets.has(k))zsets.set(k,new Map());return zsets.get(k)};const h=(k)=>{if(!hashes.has(k))hashes.set(k,new Map());return hashes.get(k)};
function run(c){const [cmd,...a]=c;
 if(cmd==='GET'){if(expires.has(a[0])&&expires.get(a[0])<=Date.now()){strings.delete(a[0]);return null;}return strings.get(a[0])??null;}
 if(cmd==='SET'){strings.set(a[0],a[1]);if(a[2]==='EX')expires.set(a[0],Date.now()+Number(a[3])*1000);return 'OK';}
 if(cmd==='DEL'){strings.delete(a[0]);return 1;}
 if(cmd==='ZCARD')return z(a[0]).size;
 if(cmd==='ZREVRANGE')return [...z(a[0])].sort((a,b)=>b[1]-a[1]).slice(Number(a[1]),Number(a[2])+1).map(x=>x[0]);
 if(cmd==='MGET')return a.map(k=>strings.get(k)??null);
 if(cmd==='HMGET')return a.slice(1).map(k=>h(a[0]).get(k)??null);
 if(cmd==='EVAL'){const [script,n,...rest]=a;const keys=rest.slice(0,n),args=rest.slice(n);
 if(script===rateScript){const count=Number(strings.get(keys[0])||0)+1;strings.set(keys[0],String(count));return count;}
 if(script===createScript){if(strings.has(keys[0]))return 0;strings.set(keys[0],args[0]);z(keys[1]).set(args[2],Number(args[1]));z(keys[2]).set(args[2],Number(args[1]));return 1;}
 if(script===patchScript){const raw=strings.get(keys[0]);if(!raw)return 0;const o=JSON.parse(raw);if(o.status==='paid')return 1;Object.assign(o,JSON.parse(args[0]));strings.set(keys[0],JSON.stringify(o));z(keys[1]).delete(o.id);z(keys[2]).delete(o.id);z(o.status==='error'?keys[2]:keys[1]).set(o.id,o.createdAt);return 1;}
 if(script===paidScript){const raw=strings.get(keys[0]);if(!raw)return -1;const o=JSON.parse(raw);if(o.status==='paid')return o.transaction===args[0]?0:-2;if(o.amountCents!==Number(args[1]))return -3;const owner=strings.get(keys[1]);if(owner&&owner!==o.id)return -4;strings.set(keys[1],o.id);Object.assign(o,{status:'paid',transaction:args[0],paidAt:Number(args[2]),invoiceSlug:args[3]});strings.set(keys[0],JSON.stringify(o));z(keys[2]).delete(o.id);z(keys[3]).delete(o.id);z(keys[4]).set(o.id,o.createdAt);for(const [k,v]of Object.entries({paidCents:o.amountCents,paidQuantity:o.quantity,paidOrders:1}))h(keys[5]).set(k,Number(h(keys[5]).get(k)||0)+v);return 1;}
 }
 throw Error('Unsupported mock command');}
 t.mock.method(globalThis,'fetch',async(url,options)=>{
 if(url==='https://redis.example'){if(provider.storageFail)throw Error('DB down');return {ok:true,json:async()=>({result:run(JSON.parse(options.body))})};}
 provider.calls.push({url,body:JSON.parse(options.body)});if(provider.fail)throw Error('Provider unavailable');
 return {ok:true,json:async()=>url.endsWith('payment_check')?provider.check:provider.link};
 });return {strings,zsets,hashes,expires,provider,run};}
