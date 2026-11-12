# Pesquisa regional — avaliação conservadora

**Implementação**: PR #9 da branch `correcao/raio-verificavel-20261112`.

- Dados de latitudes e longitudes municipais: 5.571 municípios, projeto público [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros), licença MIT integral no arquivo `public/br-municipios.mjs`.
- Raio: distância geográfica aproximada **em linha reta entre sedes municipais**, calculada por Haversine. NÃO é a distância de estrada, nem distância entre o vendedor e o endereço real do comprador. A interface a identifica como aproximada.
- Uma pesquisa São José do Rio Preto/SP com 50 km **não deve apresentar como compatíveis** municípios distantes como Sete Barras/SP ou a cidade de São Paulo. Bady Bassitt/SP fica dentro do raio aproximado.
- Só um campo explícito de localização na página individual pode fornecer cidade/UF automaticamente. Não copiar a cidade do próprio filtro, não usar catálogos como anúncio e não transformar ausência de dado em certeza.
- O resultado principal exibe apenas URLs individuais com município reconhecido dentro do raio aproximado, modelo/marca/versão e demais campos sem conflito conhecido. Fontes sem localização e catálogos ficam recolhidos para investigação, sem exclusão do histórico.
- O cálculo financeiro e as rotinas aprovadas, usuários, regras Firebase e dados não são modificados.
- Para validar o **endereço exato do anúncio** e raio rodoviário, é necessária geocodificação de endereço e roteamento verificáveis com fonte e permissão de uso; essa capacidade NÃO foi integrada e não deve ser anunciada como concluída.
- A atualização do frontend só está ativa no GitHub Pages após o workflow de publicação verde. A validação geográfica no Worker só está ativa depois de publicar a revisão da Cloudflare. Verificar a versão implantada e testar com dados reais e conta de teste.
