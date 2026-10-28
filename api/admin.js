import {headers,authReady,sameOrigin,parseBody,verifyPassword,loginRate,session,createSession,clearSession} from './_lib/security.js';
import {listOrders,findTicket} from './_lib/orders.js';
export default async function admin(req,res){
 headers(res);
 try{
  authReady();
  if(req.method==='GET'){
   if(!await session(req))return res.status(401).json({error:'Faça login para continuar.'});
   const url=new URL(req.url,'https://local.invalid');
   const ticket=url.searchParams.get('ticket');
   if(ticket){if(!/^[0-9]{1,15}$/.test(ticket)||Number(ticket)<1)return res.status(400).json({error:'Número inválido.'});return res.status(200).json(await findTicket(Number(ticket)));}
   const status=url.searchParams.get('status')||'all';
   const page=Number(url.searchParams.get('page')||0);
   if(!['all','pending','paid','error'].includes(status)||!Number.isSafeInteger(page)||page<0||page>100000)return res.status(400).json({error:'Filtro inválido.'});
   return res.status(200).json(await listOrders(status,page));
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Método não permitido.'});}
  if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
  let body;try{body=parseBody(req);}catch{return res.status(400).json({error:'Pedido inválido.'});}
  if(body.action==='login'){
   if(!await loginRate(req)){res.setHeader('Retry-After','900');return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos.'});}
   if(!await verifyPassword(body.password))return res.status(401).json({error:'Não foi possível entrar. Confira a senha.'});
   await clearSession(req,res);await createSession(res);
   return res.status(200).json({ok:true});
  }
  if(body.action==='logout'){
   await clearSession(req,res);return res.status(200).json({ok:true});
  }
  return res.status(400).json({error:'Ação inválida.'});
 }catch{return res.status(503).json({error:'Área administrativa temporariamente indisponível.'});}
}
