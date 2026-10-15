# Ativação do painel administrativo

Acesso: `https://SEU-DOMINIO/gestao`. Não existe link na vitrine. O endereço pode ser descoberto; a proteção real é a sessão validada no servidor.

## Configurar na Vercel antes da publicação

1. Conecte um Redis persistente (Upstash, compatível com REST; pode reutilizar o antigo Vercel KV). Use um banco dedicado à rifa ou confirme isolamento. Mantenha as variáveis de banco somente no servidor.
2. Defina `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`).
3. Defina `APP_ORIGIN` com o endereço HTTPS público exato, sem caminho, por exemplo `https://sua-rifa.vercel.app`. Aliases de outros domínios não são autorizados para login/checkout.
4. No seu computador, execute `node scripts/admin-password.mjs`. Escolha uma senha exclusiva com pelo menos 12 caracteres. A digitação fica oculta. O script mostra apenas o hash: salve-o como `ADMIN_PASSWORD_HASH`, tipo Secret, na Vercel. Não envie sua senha em conversa nem a grave no GitHub.
5. Use valores e banco separados para Preview e Production. Faça novo deploy após configurar as variáveis. Acesse `/gestao`, teste login/logout, pedido e confirmação com sua conta InfinitePay.

Sem a configuração, o painel e o novo checkout falham fechados. Por isso, não promova esta versão em produção antes de configurar o banco e APP_ORIGIN. A versão anterior não registrava pedidos.

## Proteções implementadas

- Senha verificada com scrypt no servidor; nenhuma senha padrão.
- Cookie de sessão aleatório, `HttpOnly`, `Secure`, `SameSite=Strict`, prefixo `__Host-`, validade de uma hora; somente seu hash é armazenado no Redis.
- Logout revoga a sessão no servidor. Alterar o hash da senha invalida todas as sessões existentes.
- Cinco tentativas de login por IP a cada 15 minutos, limite global adicional e limitação de criação de checkouts. O Redis precisa estar disponível; indisponibilidade nunca libera acesso.
- Origem exata e JSON obrigatórios para login/logout/checkout. Endpoints de dados verificam a sessão em toda chamada.
- HTML do painel é entregue apenas após autenticação; a página pública não recebe dados administrativos.
- Sem cache, sem indexação, sem incorporação em iframe; CSP com nonce no painel.
- Nome e telefone são renderizados como texto, nunca como HTML.
- Webhook tem token aleatório por pedido e confere valor/pagamento diretamente na InfinitePay. A mensagem recebida, sozinha, nunca marca um pedido como pago.
- Atualização de pagamento é atômica e idempotente; reenvio do webhook não soma o mesmo pagamento novamente. A mesma transação não pode confirmar dois pedidos.

## O que o painel entrega

Participante e WhatsApp, quantidade, valor, data, situação do pedido; filtros e paginação; total confirmado, quantidade paga e progresso financeiro. Guarda apenas os pedidos criados após esta versão. Doações pelo Pix solidário não entram automaticamente. Esta versão não distribui números individuais, não realiza sorteios nem importa vendas antigas.

Não há confirmação manual de pagamento; a confirmação depende da InfinitePay. Em caso de ausência de webhook, confira os logs e a entrega no provedor antes de considerar a venda confirmada. Nenhum pagamento real foi realizado nos testes locais.
