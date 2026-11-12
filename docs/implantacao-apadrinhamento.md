# Apadrinhamento — implantação controlada do Evolution Radar IA

## Situação
- Código do cadastro/autorização em `feature/apadrinhamento-base-compartilhada`. **Não confundir testes na branch com publicação na conta Firebase ou Cloudflare.**
- Alterações de regras são verificadas por Firebase Emulator (sem tocar no banco de produção).
- Sem migração ou exclusão automática de dados antigos.
- O plugin Firebase no ChatGPT é opcional. Se a conexão falhar, não indica falha no projeto do Firebase.

## Ordem segura de publicação

1. **Verificar a branch**: `Verificar Evolution Radar IA` e `Validar regras Firebase - apadrinhamento` devem estar verdes.
2. **Copiar as regras atuais do Firebase** para backup antes de mudar. Abrir Firebase Console > Build > Realtime Database > Rules. Conferir o projeto `evolution-radar-ia`. Usar o conteúdo COMPLETO de `database.rules.json` desta branch, publicar e conferir erros. **Não adicionar `.read: true` nem `.write: true`.** O nó `users/$uid` antigo permanece acessível somente ao próprio UID.
3. **Atualizar UMA VEZ o Worker existente** `evolution-radar-search`, mantendo bindings e variáveis antigas, com `worker/evolution-search-worker.js` desta branch. Publicar o código na Cloudflare. O UID do administrador continua liberado por `ALLOWED_UID`. A verificação dos demais UIDs passa a consultar o Firebase com o próprio token de autenticação, exigindo status `approved`, `search: true` e e-mail verificado. Não precisa adicionar novos UIDs em Secrets.
4. **Só após regras e Worker publicados**, aprovar/mesclar esta branch para `main`. O GitHub Actions publica o site. Testar login administrativo antes de convidar pessoas.
5. **Teste com conta nova**: no site > Configurações > Criar conta, registrar com e-mail novo, confirmar e-mail e entrar. Deve exibir pendente e negar busca. Na conta do padrinho > Administração > Solicitações, aprovar. A conta aprovada deve conseguir visualizar, pesquisar e cadastrar, mas **não editar nem arquivar** sem permissão adicional. Suspender e verificar que não lê mais dados da equipe.
6. **Cópia dos dados antigos**: no painel Administração, os dois botões de migração são opcionais, exigem confirmação e NÃO apagam os dados originais. Registros e pesquisas antigas ainda ficam disponíveis no caminho privado do administrador.

## Regras e modelo

- `registrationRequests/$uid`: solicitação de cadastro do próprio usuário; aprovação só pelo padrinho.
- `workspaces/evolution-motos/members/$uid`: registro de autorização e permissões por membro, escrito somente pelo padrinho.
- `workspaces/evolution-motos/leads/$leadId`: base de oportunidades compartilhadas; arquivamento não é exclusão física.
- `workspaces/evolution-motos/searchHistory/$id`: pesquisas compartilhadas, gravadas com autor e horário.
- `workspaces/evolution-motos/adminAudit`: auditoria de decisões, escrita e lida apenas pelo padrinho.
- Histórico e leads anteriores em `users/$uid` são preservados. A cópia é opt-in, nunca substitui os originais.

## Limitações explícitas

- **Revogar acesso** impede que o usuário acesse a base, mas **não exclui fisicamente** o registro do Firebase Authentication; para excluir contas definitivamente de outra pessoa, é necessário usar operações administrativas seguras, não apenas o JavaScript do navegador.
- O primeiro administrador é definido por um UID já existente. Nunca dar a colaboradores a permissão de alterar esse UID.
- Não foi realizado teste real com contas de produção até que o administrador publique as regras e o Worker.
- A cota do Workers AI e da Tavily será compartilhada pelos membros aprovados. O padrinho deve limitar a permissão de pesquisa conforme necessário.

## Diagnóstico

- `/health` no Worker confirma a implantação, mas não comprova autorização de novo membro ou inferência da IA.
- Se o novo usuário receber `403`, verificar e-mail confirmado, status e `permissions.search`.
- Se a UI não listar solicitações ou mostrar `permission_denied`, verificar as regras do Firebase publicadas e o UID do padrinho — NÃO abrir permissões globalmente.
- Para falha de conexão do plugin ChatGPT: escolher **Agora não**. A aplicação e a publicação pelo GitHub continuam independentes do plugin.
