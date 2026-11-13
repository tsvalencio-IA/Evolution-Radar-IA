# Evolution Radar IA — revisão candidata 2026-11-13.2 (NÃO PUBLICADA)

**Base preservada:** commit `5c26c91a0f462559122fe4909aff7323814b3db2`, branch `desenvolvimento/base-evolution-radar`.
**Desenvolvimento isolado:** `correcao/auditoria-filtros-extracao-20261113`; PR #16 (rascunho).
**Atenção:** a branch base publica o GitHub Pages automaticamente em todo push; nunca fazer merge ou push nessa branch sem autorização expressa.

## Motivo

Auditoria F12: dois pedidos com "até 20mil km" geraram `priceMax=20000`, não `kmMax=20000`, e mantiveram limite antigo de 40.000 km. Diagnóstico autenticado com Yamaha Factor 125 2012: 2 anúncios individuais, 2 falhas de extração, zero páginas extraídas. Facebook abriu busca externa sem cidade/raio aplicados como parâmetros nativos.

## Correções nesta branch

- Regra de unidades: `20 mil km`, `20mil km`, `20.000 km` e `20 mil rodados` são quilometragem, não valores em reais. Pesquisas completas novas não herdam limites de preço/KM anteriores silenciosamente; ajustes parciais preservam o contexto.
- Interpretação local adicional de `Suzuki DR160`.
- Worker: códigos de falha **sanitizados** por anúncio, separando acesso restrito, erro informado, timeout, conteúdo vazio e ausência de detalhes. Contadores agora usam extrações com conteúdo efetivo, sem confundir resposta vazia com sucesso.
- Tavily Extract: tentativa `advanced` **opcional**, desativada por padrão. Só pode ocorrer se um operador configurar `TAVILY_ADVANCED_RETRY=true` em ambiente autorizado; máximo de uma URL de recuperação por pesquisa. Esse modo pode consumir créditos adicionais e não garante acesso a páginas bloqueadas. **Não habilitar sem autorização de consumo.**
- Diagnóstico e interface: mostram o código de falha sem exibir mensagens brutas potencialmente sensíveis e sem supor remoção do anúncio.
- Android/PWA: manifesto declara `share_target` para receber link individual público compartilhado a partir do Facebook em plataformas compatíveis. O link validado preenche apenas o campo existente; **não salva nada automaticamente**. O botão que abre o Facebook na sessão normal não foi substituído. O recurso depende de o PWA estar instalado e de o Android/navegador oferecer o alvo de compartilhamento.
- Sinais comerciais de risco: quando o **texto extraído** declara explicitamente leilão, sinistro, recuperação de furto/roubo, chassi remarcado ou restrição, o candidato é excluído **preliminarmente por declaração do anúncio**, com motivo rastreável. Alegaçōes como "sem leilão" NÃO provam histórico limpo. Ausência de palavras também NÃO prova histórico limpo. Não há integração com registros oficiais de histórico veicular.

## Testar antes de qualquer publicação

1. Conferir status do PR #16 e executar `npm run check`; corrigir qualquer falha, inclusive testes de regressão existentes.
2. Testar no navegador PC e Android as consultas completas e parciais; confirmar que "até 20 mil km" não altera preço.
3. Verificar semântica de localização e raio; raio ainda equivale à aproximação entre sedes municipais, não km de percurso rodoviário.
4. Testar em **Android com PWA instalado**: compartilhar link `https://www.facebook.com/marketplace/item/123456789012345/` (exemplo de formato, não oferta real) para o Radar. Deve preencher campo, não gravar e não abrir cadastro sem consentimento.
5. Validar URLs válidas, URLs de catálogo e URLs de Facebook não suportadas; a importação automática autenticada do Marketplace não foi implementada.
6. Em ambiente Cloudflare **isolado**, testar com credenciais autorizadas: Tavily básico, `failed_results`, respostas vazias, recuperação avançada opcional com orçamento aprovado, erros 403/429 e retorno do diagnóstico. Confirmar **versão candidata 2026-11-13.2**, não confundir com produção `2026-11-12.5`.
7. Validar autenticação, histórico, permissões, administração, orçamento de revenda, modo claro/escuro, PWA e ausência de rolagem horizontal; usar contas de teste, nunca dados pessoais reais para operações destrutivas.
8. Não declarar leilão ausente ou documentação livre sem fonte oficial autorizada; consulta Senatran/Serpro ou equivalente requer integração/acesso e cobertura a validar.
9. Antes de rollout, efetuar backup auditável, homologação separada, permissão explícita e plano de reversão. Worker Cloudflare é publicado separadamente do GitHub Pages.

## Limitações

O GitHub Actions prova regressão automatizada, **não** disponibilidade real de anúncios, exatidão de preços e KM, acesso ao Facebook ou cobertura de histórico oficial. Se uma página bloquear a extração, o status continua pendente, nunca fabricado. Dados de produção e segredos Cloudflare/Firebase não foram alterados nesta branch.
