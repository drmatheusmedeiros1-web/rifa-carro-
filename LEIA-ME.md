# Rifa Solidária — Ford New Fiesta

Página com foto do carro, número a R$ 50,00, valor da cirurgia de R$ 150.000,00, anúncio do iPhone 17 Pro Max 256 GB aos 40% e Pix solidário. Textos pretos sobre fundos claros, inclusive botões e seleção de quantidade.

## Checkout automático da InfinitePay

O visitante escolhe a quantidade, informa nome e WhatsApp e clica em Pagar com InfinitePay. A função Vercel `api/checkout.js` gera o checkout pela API oficial e a página redireciona para a URL retornada. Não é necessário cadastrar links fixos.

A conta recebedora confirmada é `$thiago_beautynorte`, definida em `api/_lib/config.js`. Esta configuração explícita é usada mesmo que a hospedagem contenha uma variável antiga de outra conta.

O visitante digita uma quantidade inteira positiva ou usa os botões +/− e os atalhos. O total é atualizado automaticamente. Campos vazios, zero, negativos, frações e valores que ultrapassem a precisão monetária segura são rejeitados no navegador e no servidor. A quantidade não fica limitada aos atalhos 1, 5, 10, 20 e 50.

O preço permanece fixado no servidor em 5000 centavos por número. Preço e recebedor enviados pelo visitante são ignorados. Durante a requisição, os controles ficam bloqueados para evitar cliques repetidos.

## Publicação

Hospede o repositório na Vercel, com suporte a funções Node.js em `api/`. Use preset Other, sem comando de build e diretório de saída na raiz. Uma hospedagem puramente estática não executa `/api/checkout`.

Habilite Checkout Integrado na conta InfinitePay. A integração segue https://www.infinitepay.io/checkout-documentacao.

## Painel e registro de pedidos

O painel em `/gestao` exige autenticação no servidor e não tem link na página pública. Exibe pedidos novos, participantes, quantidades, situação, total confirmado e progresso financeiro. O webhook consulta a InfinitePay antes de confirmar um pagamento; reenvios não duplicam os totais.

**Antes de publicar**, configure banco Supabase, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_ORIGIN` e `ADMIN_PASSWORD` como variável secreta conforme [ADMIN_SETUP.md](ADMIN_SETUP.md). Sem configuração, o novo checkout e o painel ficam indisponíveis. Não coloque senhas ou tokens no código.

Não implementa emissão de números individuais ou sorteio, nem importa vendas antigas. O Pix solidário não entra automaticamente no painel. Nenhuma transação real foi realizada nos testes.

## Pix solidário

Chave: `9518174b-547d-4b43-abdd-77111163d5d4`. O botão copia a chave; em navegadores sem permissão, seleciona o texto para cópia manual. A doação tem valor livre e não gera números da rifa.

## Verificação

Execute `npm ci` e `npm test`. Os testes executam as funções SQL em PostgreSQL local via PGlite e simulam a InfinitePay, sem criar cobranças. `preview/index.html` permite revisar o visual sem abrir pagamentos.
