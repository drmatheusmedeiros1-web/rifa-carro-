export class Unavailable extends Error {}
export function storageConfig() {
  const url=process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token=process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url || !token || !url.startsWith('https://')) throw new Unavailable('Storage unavailable');
  return {url:url.replace(/\/$/,''),token};
}
export async function redis(...command) {
  const {url,token}=storageConfig();
  const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Unavailable('Storage unavailable');
  const data=await response.json();
  if(data.error)throw new Unavailable('Storage unavailable');
  return data.result;
}
export const key=(suffix)=>`rifa:v1:${suffix}`;
export const rateScript=`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`;
export async function takeRate(bucket,limit,seconds){return Number(await redis('EVAL',rateScript,1,key(`rate:${bucket}`),seconds))<=limit;}
