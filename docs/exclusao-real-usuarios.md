# Exclusão real de usuários — Evolution Radar IA

## O que foi implementado

Painel Administração > Colaboradores/Solicitações > **Excluir usuário**.

- Funciona para usuário aprovado, suspenso, revogado ou solicitação pendente.
- Protege o UID do administrador.
- Exige confirmação dupla do operador: caixa de confirmação e palavra **EXCLUIR**.
- Chama o endpoint do Cloudflare Worker \`POST /admin/delete-user\` com o Firebase ID token do administrador.
- O Worker verifica: identidade do administrador, cadastro vinculado ao padrinho, correspondência entre UID e e-mail no Firebase Authentication e credencial administrativa do serviço.
- Bloqueia o usuário (revoga o vínculo), exclui a conta **de verdade** no Firebase Authentication via API administrativa, remove \`registrationRequests/$uid\` e \`workspaces/evolution-motos/members/$uid\`, e grava uma entrada em \`adminAudit\`.
- **Não exclui** oportunidades, histórico coletivo, auditoria anterior nem dados antigos em \`users/$uid\`. Esses dados não pertencem à exclusão da identidade e exigem política própria de retenção.
- Se a exclusão do Auth falhar, não mostra sucesso. Se o Auth for removido mas a limpeza administrativa falhar, retorna \`PARTIAL_DELETE\` e não informa exclusão completa.
- Não há exclusão por acesso do navegador diretamente ao Auth de terceiros.

## Ativação obrigatória no servidor

**A UI nova sem o Worker atualizado NÃO realiza exclusão real. Não habilitar a função em produção sem concluir todos os passos.**

1. No Google Cloud / Firebase, criar ou selecionar uma **conta de serviço dedicada a essa finalidade**, no projeto \`evolution-radar-ia\`.
2. Conceder somente a função IAM **Firebase Authentication Admin** (\`roles/firebaseauth.admin\`), necessária para \`firebaseauth.users.get\` e \`firebaseauth.users.delete\`. Não conceder Editor do projeto ou Admin global.
3. Criar uma chave JSON dessa conta de serviço, pelo ambiente protegido do Google Cloud. **Não anexar, enviar por chat, colocar em GitHub, imprimir no console nem copiar para o JavaScript do site.**
4. Cloudflare > Workers & Pages > \`evolution-radar-search\` > **Settings > Variables and Secrets > Add**. Criar uma variável do tipo **Secret**, nome exato \`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON\`; conteúdo: **todo o JSON** da chave da conta de serviço.
5. Preservar \`TAVILY_API_KEY\`, \`FIREBASE_WEB_API_KEY\`, \`ALLOWED_UID\`, binding \`AI\`, domínio e rotas existentes.
6. Publicar o código **completo** de \`worker/evolution-search-worker.js\` da branch integrada pelo painel **Edit code > Deploy**. O Worker precisa publicar a versão \`2026-11-12.2\`.
7. Conferir \`https://evolution-radar-search.tsvalencio.workers.dev/health\`. A resposta deve ter \`version: "2026-11-12.2"\` e \`accountDeletionConfigured: true\`. **Essa checagem não executa exclusão** nem garante permissão IAM; o teste real exige conta descartável.
8. Testar com **conta descartável criada somente para teste**: cadastro, aprovação, exclusão pelo painel; confirmar que saiu do Firebase Authentication, que o perfil desapareceu do painel e que não prejudicou os dados coletivos.

## Diagnóstico

- \`ADMIN_CREDENTIALS_MISSING\`: Secret ainda não criado/publicado.
- \`ADMIN_CREDENTIALS_INVALID\`: JSON de serviço mal formatado ou referente a outro projeto.
- \`ADMIN_OAUTH_FAILED\`: credencial inválida, revogada ou bloqueada.
- \`FIREBASE_AUTH_LOOKUP_403\` ou \`FIREBASE_AUTH_DELETE_403\`: permissão IAM insuficiente.
- \`MEMBER_NOT_FOUND\`: conta não vinculada ao padrinho, e-mail incompatível ou cadastro já removido.
- \`ACCOUNT_MISMATCH\`: UID ou e-mail do Firebase Authentication não corresponde ao cadastro selecionado.
- \`PARTIAL_DELETE\`: Auth excluído mas limpeza dos nós administrativos ou auditoria não concluída.
- \`OWNER_PROTECTED\`: tentativa de excluir o administrador, bloqueada.

**Segurança:** não use credenciais de serviço no GitHub, nem marque \`.read\` ou \`.write\` como \`true\`. A alteração **não exige novas regras do Realtime Database**; utiliza as atuais já implementadas no apadrinhamento.
