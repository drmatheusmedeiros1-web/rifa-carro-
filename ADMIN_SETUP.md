# Ativação do painel com Supabase

Projeto escolhido: `jjbyiajueojdpidmknut`, URL `https://jjbyiajueojdpidmknut.supabase.co`.
Acesso ao painel: `https://rifa-carro-8oyn.vercel.app/gestao` após a ativação. Não existe link na vitrine. O endereço pode ser descoberto; a proteção real é a sessão validada no servidor.

## Configurar antes do merge e deploy

1. No projeto Supabase escolhido, execute `supabase/migrations/202610160001_rifa_admin.sql` pelo SQL Editor, ou aplique como migration pela conexão autorizada. O SQL cria somente o schema `rifa_private` e funções `public.rifa_*`. Não é necessário criar usuários no Supabase Auth para este painel: o login administrativo usa senha verificada no servidor.
2. Em Supabase → Settings → API Keys, crie uma Secret key para o servidor da rifa. Na Vercel, projeto `rifa-carro-8oyn`, configure `SUPABASE_SECRET_KEY` como Secret no ambiente Production. A chave começa com `sb_secret_`. Não use a chave publishable ou anon. A alternativa antiga é `SUPABASE_SERVICE_ROLE_KEY`, mas prefira Secret key. Nunca envie essas credenciais em conversa, no GitHub ou no frontend.
3. Na Vercel, configure `SUPABASE_URL=https://jjbyiajueojdpidmknut.supabase.co` e `APP_ORIGIN=https://rifa-carro-8oyn.vercel.app`. A origem deve ser HTTPS e exata; login e checkout em outros aliases são recusados. As duas variáveis não são secretas.
4. Na pasta do repositório (branch `codex/admin-seguro`), execute `node scripts/admin-password.mjs`. Digite e confirme uma senha exclusiva com pelo menos 12 caracteres; a digitação fica oculta. Copie apenas o hash gerado para `ADMIN_PASSWORD_HASH` na Vercel, tipo Secret, Production. Não grave a senha em arquivo, variável de ambiente ou conversa.
5. Use outro projeto Supabase e outra senha para Preview, caso configure esse ambiente. Não dê acesso ao banco de produção aos previews. Sem configuração, previews ficam indisponíveis por segurança.
6. Depois de configurar o SQL e as variáveis, faça o merge e um novo deploy. Verifique login/logout, bloqueio de acesso sem sessão e a integração de pagamento com a conta InfinitePay. O webhook precisa de um endereço acessível pela InfinitePay; a proteção de deployment da Vercel não pode bloquear o endpoint público de pagamento.

Sem SQL, credencial privada, banco disponível ou APP_ORIGIN, o novo checkout não abre cobranças. Sem ADMIN_PASSWORD_HASH, o painel não abre sessões. Não faça o merge antes de concluir a configuração necessária.

## Segurança

- Senha verificada por scrypt no servidor, sem senha padrão.
- Cookie aleatório `HttpOnly`, `Secure`, `SameSite=Strict`, prefixo `__Host-`, validade de uma hora. O banco guarda apenas o hash do token.
- Logout revoga a sessão no banco. Trocar o hash da senha invalida as sessões existentes.
- Cinco tentativas de login por IP a cada 15 minutos, limite global adicional e limite de criação de checkouts. Contadores e sessões expiram no banco; registros vencidos são limpos nas próximas gravações.
- Origem exata e JSON obrigatórios no login, logout e checkout. Sessão verificada a cada consulta administrativa.
- Tabelas em schema privado, com RLS habilitada e sem permissões diretas para anon, authenticated ou service_role. Somente funções específicas concedidas a service_role acessam os dados; a credencial fica na Vercel, no servidor.
- Funções SECURITY DEFINER têm search_path vazio, nomes de tabelas qualificados e acesso revogado de PUBLIC, anon e authenticated. Novos usuários ou chaves públicas não ganham poderes administrativos.
- HTML do dashboard entregue somente após autenticação, sem cache ou indexação, CSP com nonce e bloqueio de iframe. Nome e telefone são renderizados como texto.
- O webhook valida token por pedido e confere valor e pagamento diretamente na InfinitePay. Não confia apenas na notificação recebida.
- Confirmação usa transação e bloqueio de linha no PostgreSQL; uma restrição UNIQUE impede reutilizar a transação em outro pedido. Totais são calculados a partir dos pedidos pagos, sem contadores duplicáveis.

## Escopo e operação

O painel mostra participante e WhatsApp, quantidade, valor, data, situação do pedido, filtros e paginação; total confirmado, quantidade paga e progresso financeiro. Apenas pedidos posteriores à ativação são registrados. Não importa vendas antigas, não contabiliza automaticamente Pix solidário, não distribui números individuais e não realiza sorteios.

Não há confirmação manual: o pagamento depende da conferência com a InfinitePay. Se faltar webhook, confira a entrega no provedor. Nenhum pagamento real foi realizado nos testes locais.

Não há dependência de Redis nem contratação automática de plano pago. O Supabase Free tem limites e pode pausar projetos com baixa atividade. Banco pausado ou limite excedido deixa painel e checkout indisponíveis; reative o projeto no Supabase quando necessário. A gratuidade não é promessa de disponibilidade ou capacidade ilimitadas.

## Verificação local

`npm ci && npm test` executa os testes de API e a migration em PostgreSQL via PGlite. A InfinitePay e o transporte HTTP do Supabase são simulados; as funções SQL e suas permissões são executadas de verdade no banco local. Os testes verificam RLS, bloqueio de anon/authenticated, sessão, rate limit, valor correto, idempotência e transação única. Isso não substitui a validação na hospedagem e no projeto Supabase real.
