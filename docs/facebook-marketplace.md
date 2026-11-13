# Facebook Marketplace no Radar

Em Pesquisa, a seção **Facebook Marketplace** abre a busca nativa com marca, modelo, versão e ano exato quando fornecidos. Confirme no próprio Facebook a cidade, o raio e os filtros restantes. Um intervalo de anos não é enviado como se fosse um único filtro de texto. O link gerado não garante que o Facebook aplicará localização, raio, preço ou ano.

Copie o link individual completo (`https://www.facebook.com/marketplace/item/NUMERO/`) e use **Investigar anúncio no Radar**. O cadastro recebe fonte, link e evidência de link recebido; os campos da moto ficam vazios até conferência. Links de busca, login, perfil, grupo e redirecionamento não são aceitos como anúncio individual. Links mobile/desktop do mesmo item são normalizados para evitar duplicatas.

A pesquisa automática do Worker 2026-11-12.5 não coleta anúncios autenticados do Facebook. Adicionar a busca nativa e aceitar o link não cria essa integração. O diagnóstico registra essa lacuna como pendente. Nenhuma senha/cookie Facebook é pedido, copiado ou enviado ao Radar.

A Meta documenta pesquisa de Marketplace na Content Library, mas o acesso é controlado e exige vínculo com instituição acadêmica ou de pesquisa elegível; não é uma API comercial aberta para este aplicativo. Fontes oficiais consultadas em 13/11/2026:

- https://developers.facebook.com/docs/content-library-and-api/content-library
- https://developers.facebook.com/docs/content-library-and-api/get-access

Não há nova dependência de implantação do Worker para a busca nativa e o cadastro de links.
