# Portal GOACM

Site de vendas e portal de licenças GOACM. O portal, o plugin do SketchUp e as Edge Functions usam o mesmo projeto Supabase. O código do backend e o histórico de migrações acompanham este repositório em `supabase/`.

## Configuração da Vercel

Defina `portal/` como diretório raiz. A configuração já executa o build Vite, publica `dist/` e mantém as rotas do portal. O build da Vercel é interrompido se faltar uma configuração segura ou se o Supabase selecionado não for o projeto usado pelo plugin.

Cadastre estas variáveis públicas nos ambientes Vercel Preview e Production:

```dotenv
VITE_API=supabase
VITE_SUPABASE_URL=<URL HTTPS do projeto Supabase usado pelo plugin>
VITE_SUPABASE_ANON_KEY=<chave anon ou publishable pública desse projeto>
```

Use apenas a chave `anon` ou `publishable` do Supabase no navegador. O build rejeita chave `service_role`/`sb_secret_`, projeto diferente do plugin e modo `mock` em produção. Nunca cadastre token do Mercado Pago ou chave privada em uma variável `VITE_*`.

## Supabase e plugin

O SketchUp autentica diretamente pela Edge Function `sketchup-auth`, no projeto Supabase incorporado ao plugin. Cadastre no Vercel a URL HTTPS desse mesmo projeto e sua chave pública. Os nomes das tabelas finais começam com `license_`; as migrações históricas que criam e renomeiam o esquema devem ser aplicadas em ordem, após revisar o histórico remoto e fazer backup.

As Edge Functions estão em `supabase/functions/`. Publique as funções de login/licença, portal, pagamentos e `admin-overview` no projeto de produção. `admin-overview` exige sessão Supabase, e-mail confirmado e presença na allowlist privada `SITE_ADMIN_EMAILS`. O painel mostra contagens, contas recentes e pedidos; não existe controle administrativo no cliente que possa conceder privilégios.

Para tornar uma conta administradora:

1. Cadastre a conta pelo fluxo normal do portal e confirme o e-mail.
2. No Supabase, defina `SITE_ADMIN_EMAILS` com o e-mail autorizado. Mais de uma conta pode ser informada, separada por vírgulas.
3. Saia e entre de novo no portal. A opção Administração aparece no menu.

Não existe senha padrão nem usuário administrativo embutido no repositório. A allowlist deve ser alterada somente no ambiente seguro do Supabase.

## Mercado Pago

O token de acesso e o segredo HMAC do webhook ficam somente nos secrets das Edge Functions do Supabase. Nunca os coloque no Vercel nem no código do navegador. Configure no Supabase:

| Variável | Valor atual ou uso |
| --- | --- |
| `MP_ACCESS_TOKEN` | Access Token de produção do Mercado Pago |
| `MP_WEBHOOK_SECRET` | Segredo HMAC criado na configuração de Webhooks do Mercado Pago |
| `MP_PRO_MONTHLY_AMOUNT_CENTS` | `9700` para R$ 97,00 mensais |
| `MP_PRO_ANNUAL_AMOUNT_CENTS` | `97000` para R$ 970,00 anuais |
| `SITE_ADMIN_EMAILS` | E-mail confirmado autorizado a administrar o portal |
| `GOACM_PORTAL_URL` | Origem HTTPS de produção do portal, usada no retorno do checkout |
| `GOACM_PORTAL_ORIGINS` | Origens permitidas para chamadas do navegador, separadas por vírgulas |
| `ENTITLEMENT_ED25519_PRIVATE_KEY` | Chave privada do protocolo de licença do plugin, somente no servidor |
| `GOACM_LICENSE_SIGNING_PRIVATE_KEY` | Chave privada RS256 da ponte legada `/api/login`, somente se esse fluxo ainda for usado |
| `GOACM_LICENSE_KEY_ID` | Identificador da chave RS256 legada |
| `MP_SELLER_ID` | Opcional; usado para consultas de chargeback |

`MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` devem ser cadastrados usando a tela de secrets do Supabase ou `supabase secrets set`. O preço em centavos é obrigatório: a página pública e o checkout leem os mesmos valores do backend, sem fallback local. Uma alteração de preço é aplicada em um único lugar.

O plano mensal usa a API de assinaturas, cartão recorrente e teste de sete dias. O anual cria uma preferência Checkout Pro avulsa com Pix. O webhook valida a assinatura HMAC, consulta o pagamento na API do Mercado Pago e só então atualiza a licença. O retorno do navegador, por si só, não libera acesso. [A documentação do Mercado Pago descreve a assinatura HMAC dos Webhooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications) e identifica `bank_transfer` como Pix no Brasil [na lista de meios de pagamento](https://www.mercadopago.com.br/developers/pt/docs/sales-processing/payment-methods).

Secrets de Edge Functions podem ser cadastrados no Dashboard do Supabase ou pela CLI. O Supabase injeta as credenciais próprias do projeto no runtime; não copie a chave `service_role` para a Vercel. [Guia oficial de secrets do Supabase](https://supabase.com/docs/guides/functions/secrets).

## Desenvolvimento local

```powershell
npm install
npm run dev
```

O modo de demonstração é exclusivo de desenvolvimento. Para usar um backend local ou de homologação, copie `.env.example` para `.env.local` e informe a URL e a chave pública do mesmo projeto escolhido para a validação.

Para o backend local, `supabase/functions/env.example` lista as variáveis necessárias. Copie para `supabase/functions/.env`, preencha secrets de teste e não envie esse arquivo ao Git.

## Integração do plugin

O plugin e o portal compartilham as contas pelo Supabase Auth e a licença pelas funções de login e validação do SketchUp. O cliente entra no SketchUp com o mesmo e-mail e senha do portal. Cada pessoa pode autorizar um computador; a troca da máquina é feita revogando a anterior no portal.

O arquivo `api/login.js` permanece como compatibilidade para versões antigas do cliente. A versão reconstruída do plugin chama `sketchup-auth` diretamente; esse caminho é o principal para a ativação.
