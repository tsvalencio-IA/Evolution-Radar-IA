# Diagnóstico com evidências

Abra `diagnostico.html` na mesma janela em que está autenticado no sistema ou use **Diagnosticar esta pesquisa**, ao lado da pesquisa automática. O link interno leva os filtros visíveis pelo fragmento da URL, que não é enviado ao servidor. Confira os campos e clique em **Executar diagnóstico**. Depois use **Copiar relatório** ou **Baixar relatório JSON**.

O script lê a sessão Firebase já existente, verifica a leitura de dados próprios e da base compartilhada, consulta `/health`, executa `/interpret` e `/search` separadamente e analisa o resultado devolvido. As chamadas consomem a franquia existente da IA/Tavily. Não cria usuários, não modifica regras, não grava histórico nem exclui dados. Tokens são usados somente em memória no cabeçalho das requisições autorizadas e não são incluídos no relatório; e-mail e UID também não são exportados.

Estados: **OK** para a verificação específica concluída; **FALHA** para resposta inválida ou erro; **BLOQUEADO** para falta de sessão, autorização ou limite; **PENDENTE** para algo não executado ou sem evidência suficiente. Um health online não equivale a inferência executada. Uma resposta em cache não comprova nova inferência/coleta nessa execução. HTTP 200 e URLs indexadas não comprovam disponibilidade de motos.

O Worker 2026-11-12.5 não devolve HTTP/conteúdo verificado de cada link. Por isso, existência dos anúncios fica pendente: uma URL pode abrir uma página removida, bloqueada ou com recomendações de outras motos. O diagnóstico lista lacunas de preço, KM, tipo de ano, cidade e UF por anúncio, sem preencher dados com os filtros. Não confunda os placeholders Honda / CG 160 / Titan do cadastro com valores extraídos.

Gravação, aprovação, suspensão e exclusão reais não são executadas por um diagnóstico somente de leitura. A presença da credencial administrativa no health não prova permissão nem sucesso de exclusão. Esses fluxos exigem validação separada com registros e contas de teste autorizados.

Este diagnóstico usa as rotas existentes e não exige atualizar o Worker, recriar Firebase, alterar chaves ou trocar integrações.
