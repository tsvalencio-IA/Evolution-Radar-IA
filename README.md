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
- **Firebase Web e Realtime Database configurados no código** para `evolution-radar-ia`. O administrador informou que já criou o usuário E-mail/Senha e publicou as regras no Console. O aplicativo ainda **não foi publicado nem testado com login real**.
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
4. **Concluído no código:** aplicativo Web com `databaseURL` no arquivo `public/firebase-config.js`. Esses identificadores são públicos; **não** incluir senha, service account ou UID pessoal em código público.
5. **Informado como concluído pelo administrador:** publicação das regras no Console. Verifique as regras no servidor; não as sobrescreva involuntariamente em deploys.
6. Para disponibilizar o aplicativo no Firebase Hosting, usando o Console do projeto e o Cloud Shell (já autenticado):

   ```sh
   git clone --branch desenvolvimento/base-evolution-radar --single-branch https://github.com/tsvalencio-IA/Evolution-Radar-IA.git
   cd Evolution-Radar-IA
   npm run check
   firebase deploy --only hosting --project evolution-radar-ia
   ```

   O site está na branch de desenvolvimento, e a `main` permanece sem o aplicativo. **Não execute `firebase deploy` sem `--only hosting`**, pois isso pode sobrescrever as regras definidas no Console. Não copie senhas no terminal.
7. Abrir o domínio \`*.web.app\`, fazer login e testar criação/edição, backup, outro aparelho e regras de isolamento por usuário.

**Migração local → Firebase:** antes de fazer login, baixe um backup JSON da aba Configurações. Depois de entrar na conta Firebase, importe esse backup. O sistema **não sobrescreve automaticamente dados remotos com dados locais**.

## Limitações e próximas integrações

A cobertura de sites como OLX e Webmotors não pode ser assegurada por instruções de IA, pesquisa Google ou hospedagem Firebase. Para busca automatizada precisamos de conectores **permitidos, com endpoints reais verificáveis**, limites e testes de integridade. Não implantar coleta que contorne CAPTCHA, login ou bloqueios.

A ordenação pelo raio exige distância verificada por uma fonte de mapa. Caso contrário o lead é exibido como **pendente**, nunca como elegível à força.

FIPE somente quando valor, mês e versão forem comprovados por fonte confiável; valores anunciados não equivalem a venda concluída.

## Segurança e manutenção

- Salvar preferencialmente dados de anúncios comerciais, **não documentos pessoais de vendedores**.
- Cada usuário autenticado só pode ler/gravar seu caminho `users/$uid`, de acordo com o arquivo de regras, desde que as mesmas regras estejam efetivamente publicadas no Firebase. Não há cadastro público na interface.
- Se um usuário trabalha desconectado, **não** recebe sincronização automática; localStorage é por navegador e não deve ser tratado como backup durável.
- GitHub Actions verifica sintaxe e testes. Não publica automaticamente e não consome uma chave Firebase.
- Verificar custos/quotas Firebase periodicamente; 'plano gratuito' não significa recursos ilimitados.
