import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getSession,setSession,deleteSession,takeRate,Unavailable,storageConfig } from './store.js';
const scrypt=promisify(scryptCallback);
export const COOKIE='__Host-rifa_admin';
export const SESSION_SECONDS=3600;
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function appOrigin(){
  try {const url=new URL(process.env.APP_ORIGIN);if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw Error();return url.origin;}
  catch{throw new Unavailable('Origin not configured');}
}
export function sameOrigin(req){return req.headers?.origin===appOrigin();}
export function headers(res){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
}
export function parseBody(req){
  if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))throw Error('Invalid type');
  const text=typeof req.body==='string'?req.body:JSON.stringify(req.body);
  if(!text || Buffer.byteLength(text)>8192)throw Error('Invalid body');
  const body=typeof req.body==='string'?JSON.parse(text):req.body;
  if(!body || typeof body!=='object' || Array.isArray(body))throw Error('Invalid body');
  return body;
}
export function passwordHash(){
 const hash=process.env.ADMIN_PASSWORD_HASH||'';
 if(!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash))throw new Unavailable('Admin not configured');
 return hash;
}
export function authReady(){passwordHash();storageConfig();appOrigin();}
export async function verifyPassword(password){
 const hash=passwordHash();
 if(typeof password!=='string' || password.length<12 || password.length>256)return false;
 const [,salt,expected]=hash.split('$');
 const actual=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return timingSafeEqual(actual,Buffer.from(expected,'hex'));
}
export function clientBucket(req){
 // Vercel overwrites x-real-ip; do not trust user-supplied x-forwarded-for.
 const ip=process.env.VERCEL==='1'?req.headers?.['x-real-ip']:req.socket?.remoteAddress;
 return digest(String(ip||'unknown')).slice(0,32);
}
export function cookieToken(req){
 const match=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`));
 const token=match?.slice(COOKIE.length+1);
 return token && /^[a-f0-9]{64}$/.test(token)?token:null;
}
export async function session(req){
 authReady();
 const token=cookieToken(req);if(!token)return null;
 const raw=await getSession(digest(token));
 if(!raw)return null;
 try {const data=raw;return data.expires>Date.now() && data.fingerprint===digest(passwordHash())?data:null;}catch{return null;}
}
export async function createSession(res){
 const token=randomBytes(32).toString('hex');
 await setSession(digest(token),{expires:Date.now()+SESSION_SECONDS*1000,fingerprint:digest(passwordHash())},SESSION_SECONDS);
 res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`);
}
export async function clearSession(req,res){
 const token=cookieToken(req);if(token)await deleteSession(digest(token));
 res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
export async function loginRate(req){
 return await takeRate(`login:${clientBucket(req)}`,5,900) && await takeRate('login-global',100,900);
}
