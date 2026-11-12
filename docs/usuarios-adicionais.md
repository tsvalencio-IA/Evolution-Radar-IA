# Criar usuário adicional — Evolution Radar IA

## Situação atual
- O Firebase Authentication permite criar contas com e-mail e senha sem fornecer a senha do administrador.
- O Worker da Cloudflare é privado: em produção, autoriza por padrão somente o UID em \`ALLOWED_UID\`.
- A partir desta atualização, UIDs adicionais podem ser autorizados no novo Secret opcional \`ALLOWED_UIDS\`; o UID do administrador continua autorizado em \`ALLOWED_UID\`.
- A autenticação no Firebase **não** autoriza automaticamente acesso ao Worker: as duas configurações são necessárias.
- O banco atual usa \`users/$uid/data\` e \`users/$uid/searchHistory\`, protegido pelas regras de acesso do próprio UID. Contas não compartilham os históricos por padrão.

## Procedimento (não envolve terminal, não altera dados do usuário atual)

1. Abra **https://console.firebase.google.com/project/evolution-radar-ia/authentication/users** e escolha **Add user / Adicionar usuário**.
2. Digite o e-mail do colaborador e uma senha inicial forte. Não coloque senhas nos arquivos do GitHub nem no ChatGPT. Conclua.
3. Na tabela de usuários do Firebase, copie apenas o **User UID** do novo usuário.
4. Se o Worker da Cloudflare ainda não tiver recebido o código com o suporte a \`ALLOWED_UIDS\`, publique primeiro o arquivo atualizado \`worker/evolution-search-worker.js\` do repositório. Depois teste a versão do Worker pelo endpoint \`/health\` (esse endpoint não garante por si só o direito de acesso de colaboradores).
5. No Worker existente **evolution-radar-search**, abra **Settings → Variables and Secrets → Add**. Crie um **Secret** chamado exatamente \`ALLOWED_UIDS\`, contendo o UID copiado. Para outros colaboradores, separe os UIDs por vírgula. **Não altere \`ALLOWED_UID\`**.
6. Salve a variável. Se a Cloudflare solicitar publicação/implantação, confirme.
7. O colaborador acessa **https://tsvalencio-ia.github.io/Evolution-Radar-IA/**, abre **Configurações**, entra com o novo e-mail/senha e testa sua pesquisa.
8. Se o Worker responder **403 Usuário não autorizado**, confira se o UID está no Secret \`ALLOWED_UIDS\` e se a versão do código com esse suporte foi publicada. Se a leitura/gravação no Firebase falhar, confira as regras efetivamente aplicadas, sem abrir leitura pública.

**Atenção:** esse procedimento cria uma conta independente, não um membro com acesso aos dados do proprietário. Para compartilhar pesquisas e leads entre funcionários é preciso projetar autorização por equipe/empresa e regras do banco apropriadas; não alterar \`.read\` ou \`.write\` para \`true\` como atalho.

**Cotas:** usuários adicionais compartilham as cotas gratuitas de Workers AI/Tavily da mesma conta e podem consumir créditos de pesquisa; adicione somente quem realmente precisa.
