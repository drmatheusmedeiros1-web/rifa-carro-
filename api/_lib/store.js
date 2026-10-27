export class Unavailable extends Error {
 constructor(message){super(message);if(process.env.VERCEL==='1')console.error('[rifa-config]',message);}
}
export function storageConfig() {
  const raw=process.env.SUPABASE_URL;
  const token=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const url=new URL(raw);
    if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw new Unavailable('SUPABASE_URL_INVALID');
    if(!token)throw new Unavailable('SUPABASE_SECRET_KEY_MISSING');
    // Browser/publishable keys never authorize this backend.
    if(!token.startsWith('sb_secret_')) {
      let payload;try{payload=JSON.parse(Buffer.from(token.split('.')[1]||'', 'base64url').toString());}catch{throw new Unavailable('SUPABASE_SECRET_KEY_INVALID_FORMAT');}
      if(payload.role!=='service_role')throw new Unavailable('SUPABASE_SECRET_KEY_NOT_SERVER_KEY');
    }
    return {url:url.origin,token};
  }catch(error){if(error instanceof Unavailable)throw error;throw new Unavailable('Storage unavailable');}
}
export async function rpc(name,params={}) {
  const {url,token}=storageConfig();
  const headers={apikey:token,'Content-Type':'application/json'};
  if(!token.startsWith('sb_secret_'))headers.Authorization=`Bearer ${token}`;
  try {
    const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(params),signal:AbortSignal.timeout(8000)});
    if(!response.ok){
      let details;try{details=await response.json();}catch{}
      const code=typeof details?.code==='string' && /^[A-Z0-9_]{1,32}$/.test(details.code)?details.code:'UNKNOWN';
      throw new Unavailable(`SUPABASE_RPC_HTTP_${response.status}_${code}`);
    }
    return await response.json();
  }catch(error){if(error instanceof Unavailable)throw error;throw new Unavailable('SUPABASE_RPC_NETWORK_ERROR');}
}
export async function takeRate(bucket,limit,seconds){return await rpc('rifa_take_rate',{p_bucket:bucket,p_limit:limit,p_seconds:seconds})===true;}
export const getSession=hash=>rpc('rifa_session_get',{p_hash:hash});
export const setSession=(hash,data,seconds)=>rpc('rifa_session_set',{p_hash:hash,p_data:data,p_seconds:seconds});
export const deleteSession=hash=>rpc('rifa_session_delete',{p_hash:hash});
