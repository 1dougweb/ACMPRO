# Backend Supabase do GOACM

Este diretório contém as migrações e Edge Functions do portal, checkout, webhook e ativação. O esquema final usa as tabelas `license_*`; aplique as migrações numeradas e publique as funções no projeto de destino.

## Migrações

As migrações criam contas e membros (três acessos nos planos comuns), assinaturas, pedidos, dispositivos, registros de aceite dos termos e política de privacidade, ledger de pagamentos e log de eventos. A licença vitalícia da conta administradora não tem limite de membros. Execute-as com o Supabase CLI depois de vincular o projeto correto.

As migrações 001–005 preservam o histórico do esquema legado; a migração 006 deixa as tabelas finais com o prefixo `license_`. A migração 007 vincula a confirmação de um convite à vaga exata enviada e libera convites duplicados para o mesmo e-mail. A migração 008 reconcilia pagamentos anuais aprovados após expiração: mantém o registro financeiro, mas só libera a licença se o pagamento ocorreu dentro do prazo do pedido. A migração 009 serializa os eventos de pagamento, registra estados pendentes/recusados/estornados antes de liberar acesso e impede que eventos atrasados reativem cobranças estornadas. As rotinas SQL e as Edge Functions passam a consultar os nomes finais depois da migração 006.

| Arquivo | Conteúdo |
| --- | --- |
| `202610160001_acm360_commerce.sql` | Contas, membros, assinaturas, pedidos, dispositivos e políticas de acesso. |
| `202610160002_mercadopago_payments.sql` | Ledger de pagamentos, funções financeiras e estado de teste da assinatura mensal. |
| `202610160003_one_device_per_member.sql` | Regra de um computador ativo por pessoa; revoga máquinas excedentes, mantendo a usada mais recentemente. |
| `202610160004_legal_acceptance.sql` | Registro da versão e do horário de aceite dos Termos e da Política de Privacidade. |
| `202610160005_existing_schema_compat.sql` | Acrescenta os campos de teste e aceite legal caso as tabelas já existissem antes das migrações atuais. |
| `202610160006_rename_commerce_tables.sql` | Renomeia as tabelas antigas para `license_*`, sem copiar ou apagar dados, e atualiza funções que as consultam. |
| `202610170001_bind_invitation_to_member.sql` | Associa a confirmação do usuário ao convite exato; convites legados sem identificador usam o mais antigo, e convites pendentes duplicados são liberados. |
| `202610170002_reconcile_annual_payment_expiry.sql` | Registra pagamentos anuais aprovados no ledger e só ativa a licença quando a aprovação ocorreu dentro do prazo do pedido. |
| `202610170003_order_payment_webhook_events.sql` | Serializa o processamento por pagamento, grava estados não aprovados e mantém aprovação/estorno idempotentes para planos mensal e anual. |
| `202610170004_plugin_license_protocol.sql` | Adiciona segredo de dispositivo, idioma da conta e ativação com limite de um computador por pessoa para o protocolo SketchUp. |
| `202610170006_lifetime_admin_license.sql` | Concede licença vitalícia à conta titular administradora e remove o limite de assentos somente dessa conta. |

As funções e migrações estão versionadas junto ao portal, mas a configuração local existente aponta para outro projeto Supabase e não pode ser usada com o plugin. A URL pública do Vercel e o projeto remoto precisam ser cadastrados nos respectivos ambientes seguros antes do deploy. Confira o histórico remoto, faça backup e aplique migrações pendentes em ordem; a migração `202610160006_rename_commerce_tables.sql` renomeia tabelas no lugar e interrompe se os nomes antigos e novos coexistirem. A migração `202610170004_plugin_license_protocol.sql` depende das tabelas finais `license_*`.

## Secrets

Configure estes valores como secrets de Edge Functions; não os coloque no `.env` do portal:

| Secret | Uso |
| --- | --- |
| `MP_ACCESS_TOKEN` | Access Token de sandbox ou produção do Mercado Pago |
| `MP_SELLER_ID` | ID do vendedor, exigido para consultar notificações de chargeback |
| `MP_WEBHOOK_SECRET` | Chave secreta HMAC gerada na configuração do webhook Mercado Pago |
| `MP_PRO_MONTHLY_AMOUNT_CENTS` | Obrigatório; `9700` para R$ 97,00 mensais |
| `MP_PRO_ANNUAL_AMOUNT_CENTS` | Obrigatório; `97000` para R$ 970,00 anuais |
| `SITE_ADMIN_EMAILS` | Lista privada de contas administrativas; separada por vírgulas |
| `GOACM_PORTAL_URL` | Origem HTTPS do portal, usada no retorno do checkout |
| `GOACM_PORTAL_ORIGINS` | Origens do navegador autorizadas, separadas por vírgulas |
| `GOACM_LICENSE_SIGNING_PRIVATE_KEY` | Chave privada PEM RS256 para a ponte antiga de login |
| `GOACM_LICENSE_KEY_ID` | Identificador opcional da chave RS256 legada |
| `ENTITLEMENT_ED25519_PRIVATE_KEY` | Chave Ed25519 exclusiva do plugin 1.1.34; precisa corresponder à pública embutida no candidato |

`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, os preços e `SITE_ADMIN_EMAILS` ficam nos secrets de Edge Functions, não na Vercel. `MP_SELLER_ID` é opcional, salvo se habilitar a consulta detalhada de chargeback. O runtime Supabase injeta as credenciais do projeto; service role, chaves privadas e token do Mercado Pago ficam somente no servidor. A Vercel recebe apenas a URL e a chave pública `anon`/`publishable`.

O template seguro para desenvolvimento está em `supabase/functions/env.example`. Copie para `supabase/functions/.env` e preencha valores de teste localmente; o arquivo `.env` é ignorado pelo Git. Para produção, cadastre cada valor na área de secrets do Supabase. A documentação oficial permite cadastrar secrets pelo Dashboard ou CLI e informa que eles ficam disponíveis às Edge Functions sem novo deploy: [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets).

### Protocolo do plugin SketchUp

O pacote candidato 1.1.34 foi reconstruído a partir dos módulos `.rbe` recuperados. O cliente usa as funções `sketchup-auth`, `sketchup-refresh`, `register-device`, `check-subscription`, `sketchup-validate`, `sketchup-revoke` e `sketchup-locale`, enviando e-mail/senha no login, identificador da máquina e segredo persistido por dispositivo. A chave pública Ed25519 embutida no candidato corresponde à chave privada local usada pelo helper de licenças. O pacote é fonte Ruby legível e ainda não foi instalado nem assinado; mantenha a versão instalada intacta até publicar e validar o backend.

O cliente também chama `sketchup-projects`, `sketchup-publish`, `sketchup-project-create` e `sketchup-parts-batch`. Esses handlers não estão no diretório local de Edge Functions. A reconstrução desta etapa cobre somente login e licença; confirme a disponibilidade desses recursos no backend remoto antes de depender de sincronização/publicação de projetos. As ferramentas locais de modelagem foram preservadas.

## Funções

- `public-offers`: endpoint público somente de leitura que publica os valores em centavos usados pelo site e pelo checkout.
- `admin-overview`: dados do painel administrativo, permitido somente para usuário autenticado com e-mail confirmado presente em `SITE_ADMIN_EMAILS`.
- `account-summary`, `devices-list`, `devices-revoke`: dados do portal autenticado.
- `members-list`, `members-invite`, `members-remove`: equipe e convites Supabase Auth.
- `checkout-start`: cria assinatura mensal ou preferência anual com Pix.
- `billing-cancel`: cancela a renovação automática mensal.
- `mercadopago-webhook`: valida HMAC, busca o recurso na API do Mercado Pago, serializa cada pagamento no ledger e aplica aprovação/recusa/estorno sem deixar eventos atrasados reativarem licenças estornadas.
- `license-login`: ponte legada de login web que retorna JWT RS256; o plugin 1.1.34 usa as funções SketchUp com sessão Supabase e entitlement Ed25519.
- `sketchup-auth`, `sketchup-refresh`, `register-device`, `check-subscription`, `sketchup-validate`, `sketchup-revoke`, `sketchup-locale`: sessão e licença do plugin, com um computador por pessoa e entitlement Ed25519 limitado a 48 horas offline.
- `public-offers` publica sete dias de teste para o plano mensal; a primeira cobrança só ocorre depois que o Mercado Pago autorizar a assinatura e terminar o teste.

O portal publicado no Vercel inclui `portal/api/login.js`, uma ponte compatível com o contrato do servidor de desenvolvimento do plugin (`POST /api/login`). Ela encaminha o JSON para `license-login` e preserva a resposta de licença. A hospedagem precisa disponibilizar as variáveis públicas do projeto Supabase também no runtime dessa função.

`supabase/config.toml` desativa a validação JWT do gateway para o webhook e para `license-login`, `sketchup-auth` e `sketchup-refresh`; esses endpoints validam HMAC ou autenticam a sessão pelo Supabase Auth dentro da função. As demais funções exigem JWT no gateway e validam o usuário no backend.

`portal/api/login.js` e `license-login` mantêm a ponte legada de compatibilidade. O candidato 1.1.34 usa diretamente `sketchup-auth`, autentica e-mail/senha pelo Supabase Auth e recebe access token, refresh token, segredo do dispositivo e entitlement assinado Ed25519. A janela do SketchUp não foi usada nesta continuação; não houve envio de credenciais nem instalação do pacote.

### Contrato do plugin 1.1.34

- Login: `sketchup-auth` recebe e-mail, senha, identificador da máquina e nome; o servidor retorna sessão Supabase, segredo do dispositivo e entitlement Ed25519.
- Renovação: `sketchup-refresh` valida refresh token, identificador e segredo do computador.
- Validação: `sketchup-validate` e `check-subscription` exigem uma sessão e um computador ativo para a pessoa.
- Limite: um computador ativo por membro. A troca exige revogar o computador anterior no portal.
- Offline: entitlement assinado com validade máxima de 48 horas; o cliente verifica com a chave pública embutida.
- Erros de credencial e de limite retornam códigos tratados pelo cliente Ruby reconstruído.

## Mercado Pago

Configure no Mercado Pago os eventos `payment`, `subscription_preapproval`, `subscription_authorized_payment` e `topic_chargebacks_wh`. Para o plano anual, a preferência seleciona Pix como padrão e exclui cartão, boleto e outros meios de pagamento; a disponibilidade de Pix depende da configuração da conta Mercado Pago. O tipo `bank_transfer` corresponde ao Pix no Brasil, segundo a [lista oficial de meios de pagamento](https://www.mercadopago.com.br/developers/pt/docs/sales-processing/payment-methods).

Use credenciais de teste e URL de webhook de sandbox antes da produção. O preço mensal e anual é publicado pela função `public-offers` e aplicado também ao checkout. O fluxo não ativa licença com base na volta do navegador; somente o estado consultado na API e confirmado pelo webhook libera acesso.

## Regras que não devem ser codificadas no navegador

- Planos comuns: titular + até dois membros; conta administradora vitalícia: membros sem limite, garantidos pelo banco.
- Um computador ativo por membro. A migração `202610160003_one_device_per_member.sql` conserva o computador usado mais recentemente, revoga os excedentes e cria uma restrição única no banco; o portal mostra os dispositivos autorizados em relação às pessoas ativas.
- Preços, confirmação financeira, cancelamento e validade permanecem no backend.

## Pendências de publicação

- O checkout e a ativação ainda não podem operar até que o histórico/esquema remoto seja conferido, as migrações sejam aplicadas e as Edge Functions sejam publicadas no projeto Supabase de produção.
- O login ponta a ponta depende de publicar as funções, configurar o secret Ed25519 e validar uma conta de sandbox antes de aceitar pagamentos reais. As quatro rotas de projetos listadas acima permanecem fora da reconstrução de login/licença.
