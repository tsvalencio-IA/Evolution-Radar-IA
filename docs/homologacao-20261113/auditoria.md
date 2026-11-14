# Linha de base e escopo da candidata

Referência: `5c26c91a0f462559122fe4909aff7323814b3db2`, branch de publicação `desenvolvimento/base-evolution-radar`.
Branch isolada: `homologacao/candidata-profissional-20261113`.

A auditoria F12 de 13/11/2026 foi lida integralmente (378 linhas): 11 arquivos idênticos à branch publicada; Worker 2026-11-12.5; vínculo AI declarado conectado; cache v11; sem overflow na largura testada. Ela não executou pesquisa autenticada nem verificou a existência de motos. Os dois casos de `20mil km` / `20 mil km` foram reproduzidos no código original: preço máximo 20000 e KM herdado 40000. O terceiro caso explícito de preço e KM passou no relatório. Esse conjunto não comprova ausência de oportunidades na região.

Antes de implementar, `npm run check`: **116 testes, 116 aprovados, zero falhas**, sem consultas a Tavily, Workers AI ou dados de produção.

## Mapa das dependências e funcionalidades preservadas

| Área | Arquivos e fluxo atual |
|---|---|
| Painel e UX | index.html, styles.css e app.js; filtros, resultados, evidências, históricos, temas e ditado |
| Interpretação | local-intent.mjs → mergeIntentFilters → formulário → /search; /interpret é alternativa remota explícita |
| Pesquisa | Worker autenticado → 3 buscas Tavily + até 1 recuperação → até 5 URLs extraídas → classificação; search-engine.mjs reaplica filtros no cliente/histórico |
| Localização | br-municipios.mjs; resolução de municípios e aproximação entre sedes, sem roteamento rodoviário |
| Extração | listing-facts.mjs; somente campos explicitamente encontrados; preço parcelado não é preço total |
| Login e dados privados | firebase-client.js; Authentication + users/$uid/data e histórico legado |
| Equipe e auditoria | team-registration, team-client, team-admin, team-data e team-roles; aprovação, confirmação de e-mail, permissões, suspensão, revogação, cópias e auditoria |
| Exclusão de identidade | /admin/delete-user; exige credencial administrativa ausente no relatório; não será executada nesta missão |
| Oportunidades/finanças | core.mjs e app.js; deduplicação, importação/exportação, despesas, margem e simulação sem lucro presumido |
| Facebook | marketplaces.mjs; link HTTPS existente abre Facebook; cadastro de link individual, sem leitura da sessão/cookies |
| PWA/diagnóstico | manifest, sw.js, diagnostico.html, diagnostics.mjs e diagnostics-ui.js |
| Artefato Worker | scripts/build-worker.mjs mantém deploy/standalone equivalente aos módulos; prepará-lo não o implanta |

## Publicação e isolamento

`pages.yml` publica automaticamente apenas no push da branch de publicação; também permite disparo manual. A candidata acrescentará proteção explícita de branch no job para evitar publicação manual acidental. `validate.yml` executa checks em branches/PRs; `security-rules.yml` usa um emulador com projeto demo. Nenhum deles necessita alterar Firebase ou Worker de produção nesta missão. Nenhuma execução de deploy manual será disparada.

## Achados comprovados e hipóteses

- Comprovado: unidade KM é confundida com moeda; os limites antigos podem persistir incorretamente. Pedidos parciais não são tratados completamente na escolha entre interpretação local/remota.
- Comprovado: Facebook recebe somente termos textuais. Cidade/raio não são filtros nativos comprovados. Preservar HTTPS/app, orientar o ajuste real e preparar recebimento por compartilhamento conforme suporte do navegador.
- Comprovado: o teste autenticado anterior teve 3 buscas, 1 candidato, 5 catálogos e nenhuma extração concluída. Não é prova de inexistência de motos.
- Comprovado no código: ausência de verificação individual HTTP/soft-404, diagnóstico sem prova de disponibilidade, falhas de extração sem códigos por URL, ausência de campos mínimos de risco e de API veicular contratada.
- Hipóteses a testar com fixtures: conteúdo de recomendações em páginas removidas pode contaminar extração; dados contraditórios podem ser associados a uma única moto; latência/limite do fornecedor pode ser confundido com ausência de resultados.
- Limites externos: login Facebook permanece no aplicativo do usuário; não há credenciais contratadas de consulta veicular nesta missão. Inferência, cobertura real, compartilhamento físico no Android e permissões de exclusão não podem ser declarados validados por mocks.

## Método

Testes de regressão determinísticos, fixtures sanitizadas, emulador Firebase e navegador local isolado. A pesquisa, o login e os dados reais do cliente não são usados como fixtures. Relatórios privados e tokens não serão incluídos no repositório. A entrega será por PR sem merge, com plano de homologação e reversão.
