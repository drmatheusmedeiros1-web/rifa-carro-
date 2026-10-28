import {headers,parseBody,sameOrigin,digest} from './_lib/security.js';
import {rpc} from './_lib/store.js';
export default async function receipt(req,res){
 headers(res);
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 try{
  if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
  let body;try{body=parseBody(req);}catch{return res.status(400).json({error:'Pedido inválido.'});}
  if(typeof body.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.id)||typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return res.status(404).json({error:'Link de confirmação inválido.'});
  const order=await rpc('rifa_receipt',{p_id:body.id,p_hash:digest(body.token)});
  if(!order)return res.status(404).json({error:'Link de confirmação inválido.'});
  return res.status(200).json(order);
 }catch{return res.status(503).json({error:'Não foi possível consultar agora. Tente novamente.'});}
}
