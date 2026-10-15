# Rifa Solidária — Ford New Fiesta

Página com foto do carro, número a R$ 50,00, valor da cirurgia de R$ 150.000,00, anúncio do iPhone 17 Pro Max 256 GB aos 40% e Pix solidário. Textos pretos sobre fundos claros, inclusive botões e seleção de quantidade.

## Checkout automático da InfinitePay

O visitante escolhe a quantidade e clica em Pagar com InfinitePay. A função Vercel `api/checkout.js` gera o checkout pela API oficial e a página redireciona para a URL retornada. Não é necessário cadastrar links fixos.

A conta recebedora confirmada é `$thiago_beautynorte`, definida em `api/_lib/config.js`. Esta configuração explícita é usada mesmo que a hospedagem contenha uma variável antiga de outra conta.

O visitante digita uma quantidade inteira positiva ou usa os botões +/− e os atalhos. O total é atualizado automaticamente. Campos vazios, zero, negativos, frações e valores que ultrapassem a precisão monetária segura são rejeitados no navegador e no servidor. A quantidade não fica limitada aos atalhos 1, 5, 10, 20 e 50.

O preço permanece fixado no servidor em 5000 centavos por número. Preço e recebedor enviados pelo visitante são ignorados. Durante a requisição, os controles ficam bloqueados para evitar cliques repetidos.

## Publicação

Hospede o repositório na Vercel, com suporte a funções Node.js em `api/`. Use preset Other, sem comando de build e diretório de saída na raiz. Uma hospedagem puramente estática não executa `/api/checkout`.

Habilite Checkout Integrado na conta InfinitePay. A integração segue https://www.infinitepay.io/checkout-documentacao.

## Escopo

Este código abre o checkout externo. Não implementa emissão de números, apuração de progresso, painel ou confirmação automática por webhook. Não há teste de transação real sem a conta e hospedagem confirmadas.

## Pix solidário

Chave: `9518174b-547d-4b43-abdd-77111163d5d4`. O botão copia a chave; em navegadores sem permissão, seleciona o texto para cópia manual. A doação tem valor livre e não gera números da rifa.

## Verificação

Execute `node --test tests/checkout.test.js`. Os testes simulam a InfinitePay, sem criar cobranças. `preview/index.html` permite revisar o visual sem abrir pagamentos.
