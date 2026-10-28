# Números e confirmação

1. Execute `supabase/migrations/202610280001_ticket_numbers.sql` no projeto Supabase configurado na Vercel (tkjeabbsyvidysltwufi).
2. Após o SQL concluir, publique esta branch/PR. Não publicar antes da migração: o recibo e a numeração dependem das novas funções.

A migração numera pedidos já marcados como pagos em ordem de confirmação, começando em 0001. Pedidos pendentes não recebem números. Não altera valores, comprovantes ou confirmação financeira. É reaplicável.

Os novos pedidos recebem link individual na volta da InfinitePay, com token aleatório independente do webhook. O token é armazenado como hash no banco e enviado no fragmento do link. Links de compras anteriores não possuíam esse token; consulte/copie os números dessas compras no painel.

WhatsApp fornecido pelo organizador, preservado literalmente: +55 69 9965-2006 (wa.me/556999652006). O comprador precisa tocar em Enviar; não há envio automático.

Números exibidos com no mínimo quatro dígitos. Pedidos acima de 100 cotas mostram intervalo inclusivo para manter a mensagem curta. Numeração é sequencial, exclusiva e transacional; esta atualização não executa sorteios.
