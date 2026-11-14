# Candidata para homologação — Evolution Radar IA

Branch: `homologacao/candidata-profissional-20261113`.
Base: `5c26c91a0f462559122fe4909aff7323814b3db2` da branch que publica produção, `desenvolvimento/base-evolution-radar`.

Esta entrega é código e PR para revisão. Não autoriza merge, publicação do Pages, deploy do Worker nem alteração de dados, regras, usuários ou credenciais de produção. Nenhuma dessas ações foi executada nesta missão. Não há serviço pago contratado nem chamadas reais a Tavily, Workers AI ou APIs veiculares durante os testes da candidata.

## Resultado implementado

| Problema | Comportamento da candidata |
|---|---|
| `20mil km`, `20 mil km`, `20.000 km`, `20 mil rodados` | KM máximo 20000; não cria preço máximo; substitui o limite anterior |
| Preço, KM mínimo/máximo e raio na mesma frase | Unidades separadas e limites visíveis correspondentes ao pedido enviado |
| Mudança de marca/modelo | Limpa versão, anos e limites da outra moto; preserva localização; marca isolada não herda modelo incompatível |
| Pedidos parciais | Usa a pesquisa atual somente quando os campos são compatíveis; ambiguidades interrompem a consulta e pedem esclarecimento |
| IA remota confundindo unidades | A rota reaplica as quantidades, cidade e versão identificadas deterministicamente |
| Páginas removidas com recomendações | HTTP 404/410 e soft-404 ficam indisponíveis; dados de recomendações não são usados |
| Bloqueio, rede, timeout, redirecionamento | Estados próprios, sem contorno de bloqueio; disponibilidade não comprovada permanece pendente |
| Dados estruturados e contradições | JSON-LD só do identificador individual correto; ignora ItemList; conflitos anulam o campo e impedem pré-qualificação |
| Identidade do veículo | Título antigo do índice não substitui dados ausentes na página individual |
| Consumo e duplicidades | Deduplicação por plataforma/ID, orçamento por coleta, cache e compartilhamento de consultas simultâneas |
| Facebook | Preserva o link HTTPS existente; mostra/copía contexto completo; orienta conferir filtros nativos; mantém cadastro individual |
| Compartilhamento | Manifest e receiver GET recebem link completo e texto como pendência de sessão; revisão obrigatória antes do cadastro |
| Riscos veiculares | Oito condições com ocorrência, ausência no escopo e desconhecido; exige fonte/protocolo/data/escopo; separa eliminadas e pendentes |
| Localização | Separa declaração, município resolvido, estimativa entre sedes e distância conferida com tipo/fonte/data |
| Sessão e auditoria | Impede resposta antiga após troca/revogação de acesso; protege gravações enfileiradas; trilha de risco compartilhada conserva autor e antes/depois |
| Cache/PWA | Cache v12-rc1 inclui módulos novos; não intercepta APIs nem armazena parâmetros do compartilhamento nas chaves do cache |

O modelo legado de Factor (`model: 125`, `version: Factor`) foi preservado para evitar migração de registros. A pesquisa equivalente `Factor 125` também continua aceita nos mecanismos existentes.

## Limites concretos de consumo

Por coleta: no máximo **4 buscas básicas**, **5 páginas públicas**, **5 URLs de extração Tavily** e **45 segundos** de pipeline. Extração só ocorre quando necessária e não é usada para contornar bloqueio público. Cache de resultados: 10 minutos no mesmo isolate. Coletas iguais simultâneas compartilham trabalho, sempre após autenticação. Limite adicional: 6 coletas novas por usuário a cada 5 minutos no mesmo isolate; interpretações remotas têm orçamento separado.

Esses limites em memória não são uma cota global entre todos os isolates da Cloudflare. Sem armazenamento/limitação distribuída contratada, a franquia efetiva deve continuar sendo controlada no fornecedor. As contagens representam tentativas e URLs, não uma fatura de créditos. Não foi consultado saldo da conta do cliente nem habilitado pagamento por uso. O timeout da IA limita a espera; não garante cancelamento de processamento já iniciado pelo provedor.

## Evidências e funcionalidades preservadas

Leia [auditoria e linha de base](auditoria.md), [validação e limites da evidência](validacao.md), [fontes e dependências externas](fontes-e-custos.md) e [roteiro de homologação/reversão](homologacao-e-reversao.md).

Autenticação, confirmação de e-mail, aprovação, perfis/permissões, administração, histórico, leads, importação/exportação, despesas/margem, ditado quando suportado, fontes externas, tema e instalação permanecem na arquitetura existente. Não houve troca de Firebase, banco, SDK ou serviços. `database.rules.json`, configuração Firebase e configuração/credenciais do Worker não foram alterados.

A investigação de riscos é independente do status de página conferida. Legados continuam desconhecidos quanto a riscos. O filtro opcional exige comprovação para qualificar registros; ocorrência documentada é eliminatória. Ausência só vale no escopo da fonte e na data registrada. Não existe consulta automática veicular conectada nesta entrega.

Na base compartilhada, a trilha de risco guarda até 20 revisões com autor, data e antes/depois, preservadas na transação. Não é um registro criptograficamente imutável; mantém o modelo de permissões existente. O sistema não certifica a autenticidade de documentos que o usuário informa manualmente.
