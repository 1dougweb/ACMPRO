# Portal ACMPRO

Site público de vendas e portal de clientes ACMPRO em React/Vite. A página de vendas fica na rota inicial; a área de licença fica em `/app`. O usuário entra com Supabase Auth; as informações de conta, licença, equipe e dispositivos são consultadas pelas Edge Functions do projeto Supabase. A função serverless `api/login.js` faz a ponte de compatibilidade do login do plugin para a ativação no Supabase.

## Desenvolvimento local

```powershell
npm install
npm run dev
```

Por padrão, o Vite usa o mock local em desenvolvimento. Para apontar para um projeto Supabase de desenvolvimento, copie `.env.example` para `.env.local` e preencha:

```dotenv
VITE_API=supabase
VITE_SUPABASE_URL=<endereco-do-projeto>
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

O mock serve apenas para visualizar a interface. Não use seus dados no processo comercial.

## Publicação na Vercel

Configure `portal/` como diretório raiz do projeto. O `vercel.json` seleciona Vite, executa `npm run build`, publica `dist/` e reescreve as rotas do React Router. A função `api/login.js` permanece disponível como rota serverless independente.

Cadastre estas variáveis no ambiente **Production** da Vercel antes do primeiro deploy:

```dotenv
VITE_API=supabase
VITE_SUPABASE_URL=<URL-publica-do-projeto-de-licenca-do-plugin>
VITE_SUPABASE_ANON_KEY=<chave-anon-ou-publishable-do-mesmo-projeto>
```

O portal compara o projeto configurado com o projeto fixado no plugin e bloqueia login/cadastro se forem diferentes. O arquivo `.env` local é ignorado pelo Git; use a tela de variáveis da Vercel para configurar a produção. A chave anon/publishable é pública e pode aparecer no bundle do navegador; nunca cadastre `service_role`, tokens do Mercado Pago ou chaves privadas na Vercel. Se habilitar Preview Deployments, configure valores de teste conscientemente; sem as variáveis, a compra permanece desativada.

A função serverless de compatibilidade também lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em runtime. No Supabase, configure `ACM360_PORTAL_URL` e `ACM360_PORTAL_ORIGINS` com a origem final do portal.

A pessoa usa no plugin o mesmo e-mail e senha cadastrados no portal. Depois da confirmação do e-mail e da aprovação do pagamento pelo Mercado Pago, a ponte implementa `POST /api/login` com `{ "email", "password", "machineId", "machineName" }` e devolve token RS256, usuário, plano e validade no formato do servidor de desenvolvimento. Como a versão instalada do cliente está compilada, confirme que ela usa o mesmo endereço-base e valide a chave pública RS256 antes da produção.

Para schema, funções, configurações do Mercado Pago e limites de licença, consulte `supabase/README.md` e `MIGRACAO.md`.
