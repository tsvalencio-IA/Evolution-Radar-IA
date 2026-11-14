# Homologação sem atingir produção

## Preparar

1. Revisar o diff do PR e manter o PR **sem merge**. A branch `desenvolvimento/base-evolution-radar` publica produção: não usá-la para experimentos.
2. Em checkout da candidata, executar `npm run check`. O pacote não instala dependências de produção novas.
3. Para integração, usar somente emulador/demo: `firebase emulators:exec --only database --project demo-evolution-radar "node --test --test-concurrency=1 tests/integration/*.mjs"`. As ferramentas de teste são as mesmas do workflow de segurança; não publicar regras no console.
4. Para interface local sem contas reais, executar `node tests/browser/prepare-preview.mjs /workspace/scratch/radar-candidate-qa`. O diretório deve ser externo ao repositório. No ambiente gerenciado, iniciar com `sites-preview start /workspace/scratch/radar-candidate-qa` e abrir a URL retornada. O gerador copia o aplicativo, substitui transportes somente na cópia e exibe uma faixa permanente de fixtures.

O harness não deve ser publicado como aplicativo. Não copiar arquivos `qa-*` para `public/` do repositório. Ele bloqueia requisições externas e permite testar perfis, atraso, formulário e respostas de busca. Sua autenticação é simulada; a autorização efetiva é testada separadamente no emulador.

## Critérios de conferência

- Repetir as duas frases F12 e verificar `kmMax=20000`, preço vazio, CG 160 Fan 2024, Campinas/SP. Depois repetir preço+KM, Suzuki e Yamaha descritos no relatório de validação.
- Mudar somente cidade e depois marca/modelo; conferir campos visíveis e histórico reaberto. Testar ambiguidades sem nova consulta.
- Conferir categorias compatível preliminar, pendente, fora e removido. Abrir evidências; não confundir presença de página com venda ativa.
- Receber `receber.html?text=` com link de teste completo; revisar sem cadastro automático; cancelar não deve criar lead. Cadastro Facebook começa com dados veiculares vazios.
- Testar ocorrência sem metadados: deve impedir salvar e explicar dentro do diálogo. Com fonte/protocolo/data/escopo de teste: eliminada. Editar sem alterar evidência não deve duplicar revisão.
- Conferir cadastro, edição, arquivamento, histórico, backup JSON/CSV, importação sem sobrescrever, finanças, claro/escuro e recarregamento. Usar apenas registros de teste no ambiente apropriado.
- Testar permissão somente leitura, suspensão durante consulta, troca de conta e logout. Nenhuma resposta atrasada deve reaparecer como pesquisa autorizada.
- Conferir 320/390/768/1024 px, formulário expandido e ambos os temas. Medidas no Chrome não substituem Safari/iPhone físico.

## Pendências que exigem ambiente/aparelho autorizado

Para validar o seletor nativo de compartilhamento, atualização de PWA instalado, abertura do aplicativo Facebook, autenticação real e respostas reais de anúncios, será necessário um ambiente de homologação explicitamente autorizado com configurações e contas de teste separadas. Não usar a produção para concluir esses testes sem autorização. Nenhum preview externo foi publicado nesta missão. Conferir também download/importação no aparelho: a captura automática do evento de download do iframe não concluiu no navegador remoto de QA.

Qualquer teste real com Tavily/IA deve ter um orçamento previamente definido; a base de fixtures não prova disponibilidade regional de motos. Consulta veicular exige fornecedor, contrato, finalidade e credenciais de servidor autorizados. A credencial de exclusão administrativa não é requisito para testar pesquisa, mas é necessária para homologar exclusão definitiva de identidade.

## Reversão

Nesta entrega não há mudança de produção para reverter: pode-se fechar o PR ou abandonar a branch sem afetar o site. Para repetir a linha de base, abrir checkout separado do commit `5c26c91a0f462559122fe4909aff7323814b3db2`.

Se a publicação for autorizada posteriormente, registrar antes o SHA e versão ativos do Pages/Worker e obter backup exportado. Aplicar atualização de frontend e Worker como versões coordenadas em homologação; a compatibilidade conservadora com respostas antigas mantém links não conferidos como pendentes. Em caso de regressão, restaurar o artefato/versão anterior de frontend e Worker. Não reverter banco apagando registros: campos novos são aditivos, dados legados devem permanecer preservados e eventual migração exige decisão separada. Cache deve mudar de versão em uma reversão futura para evitar arquivos de versões misturadas.
