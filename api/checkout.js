import { randomUUID } from 'node:crypto';
import { getInfinitePayHandle, PRICE_CENTS, isValidQuantity } from './_lib/config.js';

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
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Pedido inválido.' }); }
  const quantity = body?.quantity;
  if (!isValidQuantity(quantity)) {
    return res.status(400).json({ error: 'Selecione uma quantidade válida.' });
  }
  const handle = getInfinitePayHandle();
  if (!handle) {
    return res.status(503).json({ error: 'O pagamento está temporariamente indisponível. Entre em contato com a organização.' });
  }
  // Preço e conta recebedora vêm do servidor, nunca dos dados enviados pelo visitante.
  const payload = {
    handle,
    order_nsu: randomUUID(),
    items: [{ quantity, price: PRICE_CENTS, description: 'Rifa Solidária — Ford New Fiesta 2013/2014' }],
  };
  try {
    const response = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return res.status(502).json({ error: 'Não foi possível abrir o checkout. Tente novamente em instantes.' });
    const result = await response.json();
    if (!isCheckoutUrl(result.url)) return res.status(502).json({ error: 'Não foi possível abrir o checkout. Tente novamente em instantes.' });
    return res.status(200).json({ url: result.url });
  } catch {
    return res.status(502).json({ error: 'Não foi possível conectar ao pagamento. Tente novamente em instantes.' });
  }
}
