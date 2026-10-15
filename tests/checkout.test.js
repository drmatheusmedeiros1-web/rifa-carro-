import test from 'node:test';
import assert from 'node:assert/strict';
import checkout, { isCheckoutUrl } from '../api/checkout.js';

function setHandle(t,value) {
  const previous=process.env.INFINITEPAY_HANDLE;
  process.env.INFINITEPAY_HANDLE=value;
  t.after(()=>{if(previous===undefined)delete process.env.INFINITEPAY_HANDLE;else process.env.INFINITEPAY_HANDLE=previous;});
}

async function call(body, method='POST') {
  const res={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}};
  await checkout({method,body},res);
  return res;
}

test('checkout envia quantidades com R$ 50 por número e recebedor do servidor',async t=>{
  setHandle(t,'$recebedor-teste');
  let payload;
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    assert.equal(url,'https://api.checkout.infinitepay.io/links');
    payload=JSON.parse(options.body);
    return {ok:true,json:async()=>({url:'https://checkout.infinitepay.com.br/pedido-teste'})};
  });
  for(const quantity of [1,5,10,20,50]){
    const res=await call({quantity,price:1,handle:'outro-recebedor'});
    assert.equal(res.code,200);
    assert.equal(payload.handle,'recebedor-teste');
    assert.equal(payload.items[0].price,5000);
    assert.equal(payload.items[0].quantity,quantity);
    assert.match(payload.order_nsu,/^[0-9a-f-]{36}$/);
  }
});
test('quantidades inválidas, JSON quebrado e método GET não chamam o provedor',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('não deveria chamar')});
  for(const quantity of [0,-1,2,1.5,'1',null,100000])assert.equal((await call({quantity})).code,400);
  assert.equal((await call('{')).code,400);
  assert.equal((await call({},'GET')).code,405);
  assert.equal(fetch.mock.callCount(),0);
});
test('sem InfiniteTag retorna indisponibilidade sem gerar cobrança',async t=>{
  setHandle(t,'');
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('não deveria chamar')});
  assert.equal((await call({quantity:1})).code,503);
  assert.equal(fetch.mock.callCount(),0);
});
test('erros, timeout e resposta inválida do provedor são tratados',async t=>{
  setHandle(t,'recebedor-teste');
  const fetch=t.mock.method(globalThis,'fetch',async()=>({ok:false}));
  assert.equal((await call({quantity:1})).code,502);
  fetch.mock.mockImplementation(async()=>{throw new DOMException('timeout','TimeoutError')});
  assert.equal((await call({quantity:1})).code,502);
  fetch.mock.mockImplementation(async()=>({ok:true,json:async()=>({url:'https://example.com'})}));
  assert.equal((await call({quantity:1})).code,502);
});
test('redirecionamento somente para HTTPS da InfinitePay',()=>{
  for(const url of ['https://checkout.infinitepay.com.br/a','https://checkout.infinitepay.io/a'])assert.equal(isCheckoutUrl(url),true);
  for(const url of ['http://checkout.infinitepay.io/a','https://infinitepay.io.example.com','javascript:alert(1)','https://user@checkout.infinitepay.io','bad'])assert.equal(isCheckoutUrl(url),false);
});
