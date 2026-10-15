import { randomUUID, randomBytes } from 'node:crypto';
import { getInfinitePayHandle, PRICE_CENTS, isValidQuantity } from './_lib/config.js';

import {appOrigin,sameOrigin,parseBody,clientBucket,digest} from './_lib/security.js';
import {storageConfig,takeRate} from './_lib/store.js';
import {createOrder,patchOrder} from './_lib/orders.js';

export function isCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      ['infinitepay.io', 'infinitepay.com.br'].some(domain =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

export default async function checkout(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  let body,origin;
  try {
    origin=appOrigin();storageConfig();
    if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
    if(!await takeRate(`checkout:${clientBucket(req)}`,15,300))return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos.'});
  }catch{return res.status(503).json({error:'Pagamento temporariamente indisponível.'});}
  try {body=parseBody(req);}catch{return res.status(400).json({error:'Pedido inválido.'});}
  const quantity=body.quantity;
  if(!isValidQuantity(quantity))return res.status(400).json({error:'Selecione uma quantidade válida.'});
  const name=typeof body.name==='string'?body.name.trim():'';
  let phone=typeof body.phone==='string'?body.phone.replace(/[^0-9]/g,''):'';
  if(phone.length===10||phone.length===11)phone='55'+phone;
  if(name.length<2||name.length>100||!/^55[1-9][0-9]{9,10}$/.test(phone))return res.status(400).json({error:'Informe seu nome e WhatsApp com DDD.'});
  const handle=getInfinitePayHandle();
  const id=randomUUID();
  const webhookToken=randomBytes(32).toString('hex');
  const order={id,name,phone:'+'+phone,quantity,amountCents:quantity*PRICE_CENTS,status:'creating',createdAt:Date.now(),webhookHash:digest(webhookToken)};
  try {await createOrder(order);}catch{return res.status(503).json({error:'Não foi possível registrar seu pedido. Tente novamente.'});}
  // Preço e conta recebedora vêm do servidor, nunca dos dados enviados pelo visitante.
  const payload = {
    handle,
    order_nsu: id,
    webhook_url: `${origin}/api/payment-webhook?token=${webhookToken}`,
    redirect_url: `${origin}/obrigado.html`,
    customer: {name,phone_number:'+'+phone},
    items: [{ quantity, price: PRICE_CENTS, description: 'Rifa Solidária — Ford New Fiesta 2013/2014' }],
  };
  try {
    const response = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    if(!response.ok)throw Error('Provider error');
    const result = await response.json();
    if(!isCheckoutUrl(result.url))throw Error('Invalid provider response');
    await patchOrder(id,{status:'pending'});
    return res.status(200).json({ url: result.url });
  } catch {
    try {await patchOrder(id,{status:'error'});}catch{}
    return res.status(502).json({ error: 'Não foi possível conectar ao pagamento. Tente novamente em instantes.' });
  }
}
