import {timingSafeEqual} from 'node:crypto';
import {digest,parseBody} from './_lib/security.js';
import {getOrder,markPaid} from './_lib/orders.js';
import {getInfinitePayHandle} from './_lib/config.js';
export default async function paymentWebhook(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
 let body;try{body=parseBody(req);}catch{return res.status(400).json({error:'Evento inválido.'});}
 const {order_nsu:id,transaction_nsu:transaction,invoice_slug:slug}=body;
 const token=new URL(req.url,'https://local.invalid').searchParams.get('token');
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||typeof transaction!=='string'||!/^[-a-zA-Z0-9_.]{1,128}$/.test(transaction)||typeof slug!=='string'||!/^[-a-zA-Z0-9_]{1,160}$/.test(slug)||!token||!/^[a-f0-9]{64}$/.test(token))return res.status(400).json({error:'Evento inválido.'});
 try{
  const order=await getOrder(id);
  if(!order||!order.webhookHash||!timingSafeEqual(Buffer.from(order.webhookHash,'hex'),Buffer.from(digest(token),'hex')))return res.status(403).json({error:'Evento não autorizado.'});
  if(order.status==='paid' && order.transaction===transaction)return res.status(200).json({ok:true});
  const response=await fetch('https://api.checkout.infinitepay.io/payment_check',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({handle:getInfinitePayHandle(),order_nsu:id,transaction_nsu:transaction,slug}),signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)return res.status(400).json({error:'Confirmação indisponível. Reenviar evento.'});
  const verification=await response.json();
  if(verification.success!==true||verification.paid!==true||verification.amount!==order.amountCents)return res.status(400).json({error:'Pagamento ainda não confirmado para este pedido.'});
  const result=await markPaid(order,transaction,slug);
  if(result<0)return res.status(400).json({error:'Evento incompatível com o pedido.'});
  return res.status(200).json({ok:true});
 }catch{return res.status(400).json({error:'Confirmação indisponível. Reenviar evento.'});}
}
