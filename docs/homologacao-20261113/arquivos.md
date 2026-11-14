# Arquivos alterados e motivo técnico

Comparação completa com a base `5c26c91a0f462559122fe4909aff7323814b3db2`. Nenhum arquivo de funcionalidade foi excluído.

| Arquivo | Motivo |
|---|---|
| `.github/workflows/pages.yml` | Restringe também o job manual à branch que publica produção. |
| `.gitignore` | Evita incluir dependências e logs locais nos commits. |
| `README.md` | Registra estado da candidata e remove descrições de implantação/histórico desatualizadas. |
| `deploy/evolution-radar-search-standalone.js` | Artefato gerado da candidata; não foi implantado. |
| `docs/homologacao-20261113/README.md` | Documenta auditoria, implementação, evidências, fontes/custos ou roteiro de homologação e reversão. |
| `docs/homologacao-20261113/arquivos.md` | Documenta auditoria, implementação, evidências, fontes/custos ou roteiro de homologação e reversão. |
| `docs/homologacao-20261113/auditoria.md` | Documenta auditoria, implementação, evidências, fontes/custos ou roteiro de homologação e reversão. |
| `docs/homologacao-20261113/candidata-f12.jpg` | Evidência visual do navegador local, com faixa de fixtures e sem dados reais. |
| `docs/homologacao-20261113/fontes-e-custos.md` | Documenta auditoria, implementação, evidências, fontes/custos ou roteiro de homologação e reversão. |
| `docs/homologacao-20261113/homologacao-e-reversao.md` | Documenta auditoria, implementação, evidências, fontes/custos ou roteiro de homologação e reversão. |
| `docs/homologacao-20261113/validacao.md` | Documenta auditoria, implementação, evidências, fontes/custos ou roteiro de homologação e reversão. |
| `public/app.js` | Aplica filtros tipados, guarda contra respostas de sessão antiga e integra evidências, compartilhamento e riscos. |
| `public/br-municipios.mjs` | Reconhece nomes municipais e identifica municípios próximos dentro do raio aproximado. |
| `public/core.mjs` | Preserva campos novos em leads/exportação; classifica riscos e separa rota de raio municipal. |
| `public/diagnostics.mjs` | Mostra disponibilidade, conflitos, contagens e limites efetivamente informados. |
| `public/geography.mjs` | Distingue município declarado/resolvido, estimativa e distância conferida com fonte/data. |
| `public/icon-192.png` | Ícone derivado do SVG original, nos tamanhos de instalação 192/512. |
| `public/icon-512.png` | Ícone derivado do SVG original, nos tamanhos de instalação 192/512. |
| `public/index.html` | Expõe KM mínimo, investigação documentada, origem/distância e recebimento de compartilhamento. |
| `public/intent-quantities.mjs` | Separa preço, hodômetro e raio por unidade, com limites mínimos/máximos e ambiguidades. |
| `public/listing-facts.mjs` | Extrai só conteúdo principal e identidade observada; distância de entrega não é hodômetro. |
| `public/local-intent.mjs` | Corrige modelos, alterações parciais, anos, cidades/UF e mesclagem dos filtros. |
| `public/manifest.webmanifest` | Adiciona share target GET e ícones PNG para instalação compatível. |
| `public/page-evidence.mjs` | Detecta disponibilidade/soft-404, valida JSON-LD por identificador e conserva conflitos. |
| `public/receber.html` | Tela de recebimento sem acesso a banco ou sessão Facebook. |
| `public/receive-share.js` | Recebe GET, limpa query e encaminha à revisão. |
| `public/search-engine.mjs` | Normaliza evidências e reaplica classificação sem promover links desconhecidos. |
| `public/share-target.mjs` | Valida links compartilhados e conserva pendência temporária; não cria lead. |
| `public/styles.css` | Mantém campos, rótulos e detalhes fluidos em telas estreitas. |
| `public/sw.js` | Versiona o cache, inclui módulos novos e evita cache de APIs/parâmetros compartilhados. |
| `public/team-data.js` | Preserva auditoria de riscos dentro da transação, sem duplicar alterações equivalentes. |
| `public/vehicle-risk.mjs` | Define estados e contrato independente de fornecedor, sem consulta real configurada. |
| `scripts/build-worker.mjs` | Inclui dependências novas no Worker único com equivalência verificada. |
| `tests/browser/prepare-preview.mjs` | Gera/serve cópia isolada de QA com transportes locais e identificação permanente de teste. |
| `tests/browser/qa-client.fixture.mjs` | Gera/serve cópia isolada de QA com transportes locais e identificação permanente de teste. |
| `tests/browser/qa-transport.fixture.mjs` | Gera/serve cópia isolada de QA com transportes locais e identificação permanente de teste. |
| `tests/candidate-intent.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/candidate-risk-share.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/candidate-search.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/candidate-worker.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/core.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/diagnostics.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/geo-radius.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/integration/rules-emulator.mjs` | Verifica regras e APIs no emulador explícito em loopback; inclui trilha de risco e permissões. |
| `tests/integration/team-api.mjs` | Verifica regras e APIs no emulador explícito em loopback; inclui trilha de risco e permissões. |
| `tests/recovery-regressions.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/service-worker.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/worker-search.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `tests/worker-standalone.test.mjs` | Regressão executada para os contratos de filtros, evidências, riscos, cache, autenticação ou compartilhamento. |
| `worker/evolution-search-worker.js` | Conserva autenticação, limita requisições e coordena interpretação/coleta conservadora. |
| `worker/request-guard.mjs` | Limita espera e orçamento temporário por usuário sem repetição automática. |
| `worker/search-pipeline.mjs` | Implementa descoberta regional, deduplicação, inspeção pública e extração com orçamento. |
