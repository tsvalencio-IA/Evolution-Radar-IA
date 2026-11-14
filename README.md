# EVOLUTION RADAR IA
**Evolution Motos · Powered by thIAguinho Soluções Digitais**

Aplicativo Web responsivo/PWA para pesquisa de motocicletas em fontes indexadas, análise conservadora de páginas individuais, filtros regionais, histórico e avaliação de revenda.

## Candidata isolada para homologação — 14/11/2026

Esta branch é `homologacao/candidata-profissional-20261113`, baseada em `5c26c91a0f462559122fe4909aff7323814b3db2`. **Não publicar nem fazer merge sem nova autorização.** A entrega não alterou Pages, Worker ou Firebase de produção.

- [Relatório da implementação e limites](docs/homologacao-20261113/README.md)
- [Testes e evidências](docs/homologacao-20261113/validacao.md)
- [Arquivos alterados e motivos](docs/homologacao-20261113/arquivos.md)
- [Fontes, custos e dependências externas](docs/homologacao-20261113/fontes-e-custos.md)
- [Homologação e reversão](docs/homologacao-20261113/homologacao-e-reversao.md)

Os procedimentos de publicação abaixo são referências para uma implantação futura autorizada; não fazem parte da execução desta missão.

## Situação real (sem promessas indevidas)

- Funciona no navegador e pode guardar dados **localmente**, com backup JSON e exportação CSV.
- Filtros de **marca, modelo exato, versão, ano-modelo/fabricação, preço, KM, município, UF, raio e vendedor** aplicados aos registros salvos.
- Se falta dado obrigatório, o lead fica **pendente**. Se há incompatibilidade, **fora do filtro**. Se a página foi declarada conferida pelo usuário e os campos exigidos atendem, **página marcada como conferida pelo usuário**. Nenhum status equivale a disponibilidade ou compra aprovada.
- Gera links de **pesquisa externa** para OLX, Webmotors, Mercado Livre, NaPista e revendas. **Esses links não são anúncios**.
- Aceita anúncios inseridos pelo usuário, identifica URLs duplicadas, preserva data observada e link original.
- A simulação de revenda calcula resultados **apenas se todos os custos forem preenchidos**. Resultado estimado não é lucro líquido garantido.
- **Pesquisa candidata testada com fixtures:** até três buscas direcionadas, uma recuperação opcional, cinco páginas públicas e até cinco URLs de extração. A candidata distingue falhas, links removidos, bloqueios e contradições. Não foi publicada. Há aproximação entre sedes municipais; não há FIPE, roteamento ou garantia de anúncios ativos conectados.
- **Auditoria recebida de 13/11/2026:** arquivos publicados e health acessíveis; isso não valida todos os fluxos autenticados. Nesta missão, regras e APIs de equipe foram verificadas somente no emulador demo local, com configurações de produção preservadas.
- Repositório deve ser separado dos aplicativos existentes da oficina.

## Estrutura

- \`public/index.html\`: painel para PC e celular
- \`public/styles.css\`: interface claro/escuro e responsividade
- \`public/app.js\`: fluxos do painel
- \`public/core.mjs\`: regras determinísticas e testáveis
- \`public/firebase-client.js\`: login e sincronização sob demanda
- \`public/firebase-config.js\`: configuração pública existente do projeto Evolution Radar IA
- \`database.rules.json\`: regras privadas por UID
- \`firebase.json\`: hospedagem estática e regras de banco
- \`tests/core.test.mjs\`: testes de filtros, duplicidade e cenários

## Publicação no GitHub Pages, sem terminal

A hospedagem escolhida nesta fase é **GitHub Pages**. O Firebase continuará responsável pelo login (Authentication) e pelo banco de dados (Realtime Database). Nenhum deploy pelo Firebase Hosting é necessário.

1. Acesse `https://github.com/tsvalencio-IA/Evolution-Radar-IA/settings/pages` na conta com permissão de administrador.
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Clique em **Save**, se aparecer.
4. O arquivo `.github/workflows/pages.yml` publica a pasta `public/` a partir de `desenvolvimento/base-evolution-radar`, depois de executar os testes. Em caso de falha inicial por Pages ainda não habilitado, salve a configuração e reexecute a publicação pela interface **Actions**.
5. O endereço previsto após deploy confirmado é `https://tsvalencio-ia.github.io/Evolution-Radar-IA/`. Não declare o site publicado sem verificar a ação.
6. Para login com Firebase, se aparecer erro `auth/unauthorized-domain`, confira **Firebase Console → Authentication → Settings → Authorized domains** e autorize exclusivamente `tsvalencio-ia.github.io` para este projeto.
7. Teste login, gravação e recarregamento de registros. Confirme no Firebase que as regras restringem o acesso ao UID autenticado.

**Privacidade:** o site e seus arquivos estáticos são públicos; os dados precisam permanecer protegidos pelas regras do Realtime Database. O UID individual não deve ficar fixo no código.

**Condições de uso:** o GitHub Pages não é destinado a hospedar operações comerciais ou SaaS. Este deploy serve à validação técnica; para uso comercial contínuo, verifique a adequação aos termos do GitHub.

## Configuração já informada pelo administrador

- Firebase Web: `evolution-radar-ia`.
- Realtime Database: `https://evolution-radar-ia-default-rtdb.firebaseio.com/`.
- Login e-mail/senha: usuário cadastrado segundo o administrador.
- Regras de segurança: administrador informou publicação; ainda exigem teste real.
- Não ativar cobrança, Blaze, Cloud Shell ou serviço pago para testar o painel.

**Migração local → Firebase:** antes de fazer login, baixe um backup JSON da aba Configurações. Depois de entrar na conta Firebase, importe esse backup. O sistema **não sobrescreve automaticamente dados remotos com dados locais**.

## Pesquisa externa e implantação do Worker

- `public/search-config.js` identifica a URL pública de `evolution-radar-search.tsvalencio.workers.dev`.
- `worker/evolution-search-worker.js`: mecanismo externo autenticado; consulta Tavily e separa catálogos de URLs individuais.
- `wrangler.toml`: integração do **Worker existente** com GitHub Builds sem terminal no computador/celular.
- [`docs/publicacao-cloudflare-sem-terminal.md`](docs/publicacao-cloudflare-sem-terminal.md): autorização inicial da conta Cloudflare para publicar via GitHub.
- Os resultados extraídos são **pré-qualificados**, **pendentes** ou **fora do filtro**. Nunca equivalem a moto ativa ou compra autorizada.
- No modo gratuito: até 3 buscas básicas mais 1 recuperação opcional; extração de até 5 URLs. Isso consome créditos da Tavily; sem Pay-as-you-go.
- O raio automático é aproximado entre sedes municipais e é rotulado assim. Distância rodoviária conferida é informação separada e exige fonte/data.

## Assistente próprio (sem API OpenAI)

- A interface contém um pedido em linguagem natural e ditado por microfone quando o navegador oferece reconhecimento de fala.
- O Worker interpreta o texto com `@cf/zai-org/glm-4.7-flash` em Workers AI, protegido pelo mesmo token Firebase e UID já autorizados. O navegador nunca recebe uma chave de IA.
- O modelo **não pesquisa anúncios diretamente**; ele devolve filtros. A Tavily continua sendo o motor de pesquisa, com os limites e as verificações anteriores.
- Ao concluir cada pesquisa com êxito, o aplicativo tenta registrar filtros, fonte, data, cobertura, resultados e autor em `workspaces/evolution-motos/searchHistory`, preservando o histórico legado privado de `users/$uid/searchHistory`. Se a gravação falhar, a interface avisa explicitamente.
- A nova rota `/interpret` precisa ser publicada no Worker Cloudflare existente com o binding `[ai] binding = "AI"`. A inclusão no GitHub não comprova que a Cloudflare já recebeu o deploy.
- Cloudflare Workers AI tem franquia gratuita diária e pode limitar o uso; nenhuma cobrança ou plano pago é necessário para os testes básicos, mas não há garantia de disponibilidade. O Worker retorna erro transparente se a IA estiver indisponível.
- O histórico exibe as últimas 50 pesquisas e seu backup JSON inclui essas 50 entradas recentes. Reabrir uma pesquisa não gasta crédito de busca.

## Limitações e próximas integrações

A cobertura de sites como OLX e Webmotors não pode ser assegurada por instruções de IA, pesquisa Google ou hospedagem Firebase. Para busca automatizada precisamos de conectores **permitidos, com endpoints reais verificáveis**, limites e testes de integridade. Não implantar coleta que contorne CAPTCHA, login ou bloqueios.

A localização desconhecida permanece pendente. A aproximação entre sedes não é distância por estrada nem endereço comprovado do vendedor. Registros manuais preservam a distinção entre evidência de página e confirmação geográfica.

FIPE somente quando valor, mês e versão forem comprovados por fonte confiável; valores anunciados não equivalem a venda concluída.

## Segurança e manutenção

- Salvar preferencialmente dados de anúncios comerciais, **não documentos pessoais de vendedores**.
- Dados privados permanecem sob `users/$uid`. A base de equipe exige aprovação, e-mail confirmado e permissões, conforme as regras existentes. Há solicitação pública de cadastro; ela não concede acesso automático à pesquisa ou aos registros compartilhados.
- Se um usuário trabalha desconectado, **não** recebe sincronização automática; localStorage é por navegador e não deve ser tratado como backup durável.
- GitHub Actions verifica sintaxe/testes e publica a pasta `public` no Pages. O Worker pode ser publicado automaticamente ao conectar o Worker existente ao repositório pela Cloudflare Builds; nenhuma chave administrativa está nos arquivos.
- Verificar custos/quotas Firebase periodicamente; 'plano gratuito' não significa recursos ilimitados.
