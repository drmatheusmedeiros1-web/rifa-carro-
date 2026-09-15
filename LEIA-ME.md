# Rifa Solidária — como publicar

## 1. Suba o código pro GitHub
1. Crie uma conta gratuita em https://github.com (se ainda não tiver).
2. Clique em "New repository", dê um nome (ex: `rifa-new-fiesta`) e crie.
3. Na página do repositório vazio, clique em "uploading an existing file".
4. Arraste TODOS os arquivos e pastas deste zip (mantendo a pasta `api` intacta) e clique em "Commit changes".

## 2. Publique na Vercel
1. Crie uma conta gratuita em https://vercel.com (dá pra entrar direto com o GitHub).
2. Clique em "Add New… > Project" e selecione o repositório que você acabou de criar.
3. Não precisa mexer em nada nas configurações — clique em "Deploy".
4. Em alguns segundos você recebe uma URL tipo `https://rifa-new-fiesta.vercel.app`.

## 3. Ative o banco de dados (Vercel KV)
1. Dentro do projeto na Vercel, vá na aba "Storage".
2. Clique em "Create Database" e escolha "KV" (ou "Upstash for Redis", é a mesma coisa).
3. Conecte o banco ao seu projeto quando for perguntado.
4. Vá em "Deployments" e clique em "Redeploy" pra a conexão valer.

## 4. Teste antes de divulgar
1. Abra a sua URL da Vercel.
2. Compre 1 número de teste e veja se o checkout da InfinitePay abre.
3. Depois de pagar, confira se a página volta mostrando a confirmação.
4. Confira o painel do organizador (botão "Sou organizador", senha `fiesta2026`) e veja se o pedido de teste aparece.

## 5. Divulgue
Use a URL da Vercel (não precisa de domínio próprio) na bio do Instagram @beautynorte.profesional e nos posts/stories.

## Pra trocar alguma coisa depois (WhatsApp, senha, preço, total de números)
Edite o arquivo `api/_lib/config.js` no GitHub (dá pra editar direto pelo site, no ícone de lápis) e a Vercel republica sozinha.
Se quiser deixar essas informações fora do código, você também pode defini-las em Vercel > Settings > Environment Variables com os nomes: `INFINITEPAY_HANDLE`, `WHATSAPP_NUMBER`, `ORG_PASSCODE`, `TOTAL_NUMBERS`, `PRICE`.
