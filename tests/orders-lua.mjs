// Executa os scripts Lua reais; usa luatex como interpretador local opcional.
import {writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createScript,patchScript,paidScript} from '../api/_lib/orders.js';
import {rateScript} from '../api/_lib/store.js';
const lua=String.raw`
local values,zsets,hashes,objects={},{},{},{}
local serial=0
local function copy(t) if type(t)~='table' then return t end local c={} for k,v in pairs(t) do c[k]=copy(v) end return c end
cjson={encode=function(t) serial=serial+1 local k='json:'..serial objects[k]=copy(t) return k end,decode=function(s) assert(objects[s],'missing json') return copy(objects[s]) end}
redis={call=function(cmd,k,a,b)
 if cmd=='GET' then return values[k] end
 if cmd=='SET' then values[k]=a return 'OK' end
 if cmd=='EXISTS' then return values[k] and 1 or 0 end
 if cmd=='ZADD' then zsets[k]=zsets[k] or {} zsets[k][b]=tonumber(a) return 1 end
 if cmd=='ZREM' then if zsets[k] then zsets[k][a]=nil end return 1 end
 if cmd=='HINCRBY' then hashes[k]=hashes[k] or {} hashes[k][a]=(hashes[k][a] or 0)+tonumber(b) return hashes[k][a] end
 if cmd=='INCR' then values[k]=(values[k] or 0)+1 return values[k] end
 if cmd=='EXPIRE' then return 1 end
 error('unknown command '..cmd)
end}
local function run(script,keys,args) KEYS=keys ARGV=args return assert(load(script))() end
local order={id='one',quantity=7,amountCents=35000,status='creating',createdAt=100}
assert(run(CREATE,{'order1','all','pending'},{cjson.encode(order),100,'one'})==1)
assert(run(CREATE,{'order1','all','pending'},{cjson.encode(order),100,'one'})==0)
assert(run(PATCH,{'order1','pending','error'},{cjson.encode({status='pending'})})==1)
local keys={'order1','tx-one','pending','error','paid','stats'}
assert(run(PAID,keys,{'transaction1',1,200,'slug'})==-3)
assert(run(PAID,keys,{'transaction1',35000,200,'slug'})==1)
assert(run(PAID,keys,{'transaction1',35000,200,'slug'})==0)
assert(hashes.stats.paidCents==35000 and hashes.stats.paidQuantity==7 and hashes.stats.paidOrders==1)
assert(run(PATCH,{'order1','pending','error'},{cjson.encode({status='error'})})==1)
assert(cjson.decode(values.order1).status=='paid')
assert(run(PAID,keys,{'another-transaction',35000,200,'slug'})==-2)
order.id='two'
assert(run(CREATE,{'order2','all','pending'},{cjson.encode(order),100,'two'})==1)
assert(run(PAID,{'order2','tx-one','pending','error','paid','stats'},{'transaction1',35000,200,'slug'})==-4)
assert(cjson.decode(values.order2).status=='creating')
assert(run(RATE,{'limit'},{900})==1 and run(RATE,{'limit'},{900})==2)
print('OK: scripts Lua reais, idempotencia, transacao unica, contadores e corrida de status.')
`;
const source=`CREATE=[==[${createScript}]==]\nPATCH=[==[${patchScript}]==]\nPAID=[==[${paidScript}]==]\nRATE=[==[${rateScript}]==]\n`+lua;
const path=join(tmpdir(),`rifa-lua-${process.pid}.lua`);writeFileSync(path,source);
try {const r=spawnSync('luatex',['--luaonly',path],{encoding:'utf8'});if(r.error){console.error('luatex não disponível: teste Lua não executado.');process.exitCode=1;}else{process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exitCode=r.status;}}finally{unlinkSync(path);}
