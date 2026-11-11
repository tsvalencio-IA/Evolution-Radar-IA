# EVOLUTION RADAR IA
**Evolution Motos · Powered by thIAguinho Soluções Digitais**

Aplicativo Web responsivo/PWA para **pesquisa assistida**, registro de evidências de anúncios de motocicletas, filtros regionais e análise de compra e revenda.

## Situação real (sem promessas indevidas)

- Funciona no navegador e pode guardar dados **localmente**, com backup JSON e exportação CSV.
- Filtros de **marca, modelo exato, versão, ano-modelo/fabricação, preço, KM, município, UF, raio e vendedor** aplicados aos registros salvos.
- Se falta dado obrigatório, o lead fica **pendente**. Se há incompatibilidade, **fora do filtro**. Se a página foi declarada conferida pelo usuário e os campos exigidos atendem, **página marcada como conferida pelo usuário**. Nenhum status equivale a disponibilidade ou compra aprovada.
- Gera links de **pesquisa externa** para OLX, Webmotors, Mercado Livre, NaPista e revendas. **Esses links não são anúncios**.
- Aceita anúncios inseridos pelo usuário, identifica URLs duplicadas, preserva data observada e link original.
- A simulação de revenda calcula resultados **apenas se todos os custos forem preenchidos**. Resultado estimado não é lucro líquido garantido.
- **Não há crawler, scraper, API de marketplaces, pesquisa de anúncios automática, FIPE conectada ou cálculo automático de distância.** Essas funções dependem de fontes/API reais e permissões e não foram simuladas.
- **Firebase ainda não está configurado**. Não há qualquer banco criado nem deploy efetivado por este repositório.
- Repositório deve ser separado dos aplicativos existentes da oficina.

## Estrutura

- \`public/index.html\`: painel para PC e celular
- \`public/styles.css\`: interface claro/escuro e responsividade
- \`public/app.js\`: fluxos do painel
- \`public/core.mjs\`: regras determinísticas e testáveis
- \`public/firebase-client.js\`: login e sincronização sob demanda
- \`public/firebase-config.js\`: configuração pública pendente
- \`database.rules.json\`: regras privadas por UID
- \`firebase.json\`: hospedagem estática e regras de banco
- \`tests/core.test.mjs\`: testes de filtros, duplicidade e cenários

## Testar sem Firebase, custo R$ 0

Servir a pasta \`public\` por um servidor estático local ou Firebase Hosting. Exemplo em um PC com Node:

\`\`\`sh
npx --yes http-server public -p 8080 -c-1
\`\`\`

Abra \`http://localhost:8080\`. Sem configuração do Firebase, os registros são gravados em **localStorage no navegador atual**. Utilize **Configurações → Baixar JSON** para backup. Limpar dados do navegador pode apagá-los; não é banco online.

Execute \`npm test\` para os testes automáticos. Não há dependências NPM do aplicativo.

## Ligar Firebase gratuito (projeto separado)

1. Criar projeto exclusivo **Evolution Radar IA** no Firebase Console, no plano **Spark (gratuito)**. **Não habilitar plano Blaze nem cobrança sem aprovação explícita.**
2. Ativar **Authentication → Email/Password**. Criar manualmente o usuário privado que utilizará o painel.
3. Criar **Realtime Database**, com a região escolhida de forma consciente. **Não utilizar regras de teste públicas.**
4. Copiar a configuração do aplicativo Web para \`public/firebase-config.js\`, com \`apiKey\`, \`authDomain\`, \`databaseURL\`, \`projectId\` e \`appId\`. Essa configuração é pública; **nunca** incluir credenciais de administrador, senha ou service account. A proteção dos dados depende de Authentication e \`database.rules.json\`.
5. Aplicar \`database.rules.json\` na aba **Rules** do Realtime Database antes de criar dados.
6. Para disponibilizar o PWA, usar **Firebase Hosting**. Se utilizar Firebase CLI:
   \`\`\`sh
   npx firebase-tools login
   npx firebase-tools use --add
   npx firebase-tools deploy --only hosting,database
   \`\`\`
   Verifique no Console que o projeto correto foi selecionado. Esses comandos exigem autorização na conta e quotas disponíveis no Spark.
7. Abrir o domínio \`*.web.app\`, fazer login e testar criação/edição, backup, outro aparelho e regras de isolamento por usuário.

**Migração local → Firebase:** antes de fazer login, baixe um backup JSON da aba Configurações. Depois de entrar na conta Firebase, importe esse backup. O sistema **não sobrescreve automaticamente dados remotos com dados locais**.

## Limitações e próximas integrações

A cobertura de sites como OLX e Webmotors não pode ser assegurada por instruções de IA, pesquisa Google ou hospedagem Firebase. Para busca automatizada precisamos de conectores **permitidos, com endpoints reais verificáveis**, limites e testes de integridade. Não implantar coleta que contorne CAPTCHA, login ou bloqueios.

A ordenação pelo raio exige distância verificada por uma fonte de mapa. Caso contrário o lead é exibido como **pendente**, nunca como elegível à força.

FIPE somente quando valor, mês e versão forem comprovados por fonte confiável; valores anunciados não equivalem a venda concluída.

## Segurança e manutenção

- Salvar preferencialmente dados de anúncios comerciais, **não documentos pessoais de vendedores**.
- Cada usuário autenticado pode ler/gravar exclusivamente \`/users/$uid\`; não há cadastro público na interface.
- Se um usuário trabalha desconectado, **não** recebe sincronização automática; localStorage é por navegador e não deve ser tratado como backup durável.
- GitHub Actions verifica sintaxe e testes. Não publica automaticamente e não consome uma chave Firebase.
- Verificar custos/quotas Firebase periodicamente; 'plano gratuito' não significa recursos ilimitados.
