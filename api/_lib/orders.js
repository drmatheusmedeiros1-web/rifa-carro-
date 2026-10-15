import { redis,key } from './store.js';
export const orderKey=id=>key(`order:${id}`);
export const createScript=`
if redis.call('EXISTS',KEYS[1])==1 then return 0 end
redis.call('SET',KEYS[1],ARGV[1])
redis.call('ZADD',KEYS[2],ARGV[2],ARGV[3])
redis.call('ZADD',KEYS[3],ARGV[2],ARGV[3])
return 1`;
export async function createOrder(order){
 return redis('EVAL',createScript,3,orderKey(order.id),key('orders'),key('orders:pending'),JSON.stringify(order),order.createdAt,order.id);
}
export async function getOrder(id){const raw=await redis('GET',orderKey(id));return raw?JSON.parse(raw):null;}
export const patchScript=`
local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
local o=cjson.decode(raw)
if o.status=='paid' then return 1 end
local p=cjson.decode(ARGV[1]); for k,v in pairs(p) do o[k]=v end
redis.call('SET',KEYS[1],cjson.encode(o))
redis.call('ZREM',KEYS[2],o.id); redis.call('ZREM',KEYS[3],o.id)
local idx=KEYS[2]; if o.status=='error' then idx=KEYS[3] end
redis.call('ZADD',idx,o.createdAt,o.id)
return 1`;
export async function patchOrder(id,patch){return redis('EVAL',patchScript,3,orderKey(id),key('orders:pending'),key('orders:error'),JSON.stringify(patch));}
export const paidScript=`
local raw=redis.call('GET',KEYS[1]); if not raw then return -1 end
local o=cjson.decode(raw)
if o.status=='paid' then if o.transaction==ARGV[1] then return 0 else return -2 end end
if tonumber(o.amountCents)~=tonumber(ARGV[2]) then return -3 end
local owner=redis.call('GET',KEYS[2]); if owner and owner~=o.id then return -4 end
redis.call('SET',KEYS[2],o.id)
o.status='paid'; o.transaction=ARGV[1]; o.paidAt=tonumber(ARGV[3]); o.invoiceSlug=ARGV[4]
redis.call('SET',KEYS[1],cjson.encode(o))
redis.call('ZREM',KEYS[3],o.id); redis.call('ZREM',KEYS[4],o.id)
redis.call('ZADD',KEYS[5],o.createdAt,o.id)
redis.call('HINCRBY',KEYS[6],'paidCents',o.amountCents)
redis.call('HINCRBY',KEYS[6],'paidQuantity',o.quantity)
redis.call('HINCRBY',KEYS[6],'paidOrders',1)
return 1`;
export async function markPaid(order,transaction,slug){
 return Number(await redis('EVAL',paidScript,6,orderKey(order.id),key(`transaction:${transaction}`),key('orders:pending'),key('orders:error'),key('orders:paid'),key('stats'),transaction,order.amountCents,Date.now(),slug));
}
export async function listOrders(status,page){
 const index=status==='all'?key('orders'):key(`orders:${status}`);
 const [ids,total,stats,totalOrders]=await Promise.all([redis('ZREVRANGE',index,page*50,page*50+49),redis('ZCARD',index),redis('HMGET',key('stats'),'paidCents','paidQuantity','paidOrders'),redis('ZCARD',key('orders'))]);
 const rows=ids.length?await redis('MGET',...ids.map(orderKey)):[];
 const orders=rows.filter(Boolean).map(raw=>{
 const o=JSON.parse(raw);
 return {id:o.id,createdAt:o.createdAt,name:o.name,phone:o.phone,quantity:o.quantity,amountCents:o.amountCents,status:o.status,paidAt:o.paidAt||null};
 });
 return {orders,total:Number(total),page,pageSize:50,summary:{paidCents:Number(stats[0]||0),paidQuantity:Number(stats[1]||0),paidOrders:Number(stats[2]||0),totalOrders:Number(totalOrders)}};
}
