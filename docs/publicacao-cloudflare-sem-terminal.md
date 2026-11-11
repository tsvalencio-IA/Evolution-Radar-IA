# Evolution Radar IA — implantação automática pela Cloudflare (sem terminal)

## O que já está pronto no GitHub

- O site continua hospedado no GitHub Pages; nenhuma mudança no Firebase ou no banco.
- O Worker existente tem nome `evolution-radar-search`.
- O arquivo `wrangler.toml` na raiz aponta para `worker/evolution-search-worker.js`.
- O código realiza pesquisas focadas por ano/fonte, tenta recuperar anúncios individuais e extrai até cinco páginas por rodada.
- Os resultados aparecem como **pré-qualificados, pendentes, fora dos filtros ou catálogo**. Isso nunca significa moto disponível ou compra aprovada.
- O código não contém as chaves Tavily nem senhas. Os segredos já foram informados como configurados pelo administrador na Cloudflare.

## Única autorização que exige ação do proprietário (pelo celular)

Esta etapa deve ocorrer **no Worker já existente**, sem criar outro:

1. Abra https://dash.cloudflare.com/ e entre em **Workers & Pages**.
2. Selecione `evolution-radar-search` → **Settings → Builds**.
3. Toque **Connect** em Git Repository, escolha **GitHub**, autorize a aplicação **Cloudflare Workers & Pages** se solicitado.
4. Selecione somente o repositório `tsvalencio-IA/Evolution-Radar-IA` (não autorize todos os repositórios se não for necessário).
5. Selecione a branch `desenvolvimento/base-evolution-radar`. **Não use `main`**: o código atualizado está na branch de desenvolvimento.
6. **Root directory:** raiz do repositório, `/` ou `.`. O `wrangler.toml` já está nessa raiz.
7. **Build command:** deixe em branco. **Deploy command:** `npx wrangler deploy`, quando necessário.
8. Confira que o destino é o **Worker existente** `evolution-radar-search`, sem ativar plano pago.
9. Salve. Quando a Cloudflare oferecer **Deploy/Retry build**, execute para publicar o código da branch. Se o primeiro deploy não iniciar, é possível criar um novo commit inofensivo no GitHub para disparar a integração.
10. Confira no painel da Cloudflare que o deploy de produção foi concluído e que **TAVILY_API_KEY, ALLOWED_UID, FIREBASE_WEB_API_KEY** ainda estão presentes em **Settings → Variables and Secrets** (não revelar os valores).

**Não copie a chave da Tavily em códigos nem mensagens. Não execute comandos no seu dispositivo.**

## Custos e limites

Cloudflare Workers Builds tem cota gratuita de minutos de build; Tavily Researcher tem créditos gratuitos mensais. Cada consulta pode consumir **até quatro buscas básicas e até cinco extrações básicas**. Não habilite Pay-as-you-go. A aplicação armazena cache temporário por filtro numa instância do Worker para reduzir repetições, mas isso não equivale a banco de cache persistente.

## Teste

- Acesse `https://evolution-radar-search.tsvalencio.workers.dev/` no navegador: `{"error":"Endpoint inexistente"}` é esperado porque o endpoint usa `POST /search`.
- No site https://tsvalencio-ia.github.io/Evolution-Radar-IA/, após GitHub Pages publicar a branch mais nova, entre com Firebase e execute a busca Honda CG 160 Titan.
- A pesquisa só é considerada validada quando a API responder 200 e fornecer `coverage`, `queries`, `items` e avaliações com evidências.
- O sistema não confirma automaticamente preço, KM, disponibilidade ou raio se a fonte não fornecer dados inequívocos.
- Se GitHub Actions ficar em `Queued`, a versão do site poderá continuar antiga até a publicação terminar. Isso é independente da implantação do Worker na Cloudflare.

## Fontes

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://docs.tavily.com/documentation/api-reference/endpoint/extract
