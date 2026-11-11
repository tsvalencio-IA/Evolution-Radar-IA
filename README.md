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
