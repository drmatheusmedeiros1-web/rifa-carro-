# Rifa Solidária — Ford New Fiesta

Página estática em `index.html`, com foto do carro, número a R$ 50,00, valor da cirurgia de R$ 150.000,00, anúncio do iPhone 17 Pro Max 256 GB aos 40% e Pix solidário.

## Publicação

Importe este repositório na Vercel como site estático, sem comando de build e com a raiz como diretório de saída. A página não precisa de banco de dados.

## Checkout externo da InfinitePay

Configure `checkout-config.js` com os links reais da InfinitePay para cada quantidade e total. O endereço do checkout não foi fornecido e não constava no repositório original. Enquanto não houver link válido, a página informa a indisponibilidade e não cria cobranças.

Um link de valor fixo não muda de preço com a seleção na página: cada link deve ter o total correspondente na InfinitePay. Os dados do comprador serão informados no checkout externo, não nesta página.

Este repositório não contém API, webhook, painel do organizador, distribuição de números nem confirmação automática de pagamento. As instruções antigas citavam arquivos que não estavam presentes. A implementação desses recursos não faz parte desta alteração.

## Pix solidário

Chave: `9518174b-547d-4b43-abdd-77111163d5d4`. Botão de cópia com alternativa de seleção manual. A transferência ocorre no aplicativo do banco, com valor livre. Doações não geram números da rifa.

## Prévia

`preview/index.html` permite revisar o visual e os cálculos sem redirecionar para pagamentos.
