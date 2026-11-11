# Evolution Radar IA — pesquisa online gratuita (sem terminal)

## Status atual

- GitHub Pages publica a interface.
- Firebase Authentication mantém o login, e Realtime Database guarda os registros.
- O **adaptador de busca está preparado**. Ainda depende da criação de uma conta **Tavily Free** e de um **Cloudflare Worker Free**. Antes disso a interface NÃO faz pesquisas online; ela comunica que o conector está pendente.
- Nenhum resultado da Tavily é considerado anúncio individual verificado; títulos/trechos são apenas **resultados indexados**.

## Uma única configuração inicial pelo navegador

**1. Tavily**

Acesse https://app.tavily.com/ e crie conta no nível **Researcher Free**. A oferta informada pelo fornecedor é 1.000 créditos mensais, sem exigir cartão; confirme a cota atual no painel. Crie uma API key. **Não envie nem copie essa chave para esta conversa ou para arquivos GitHub.**

**2. Cloudflare Workers**

Acesse https://dash.cloudflare.com/ e entre/crie conta gratuita. Em **Workers & Pages**, escolha **Create application** e crie um Worker (nome sugerido: `evolution-radar-search`). No editor do Worker, substitua o código de exemplo pelo conteúdo integral do arquivo:

https://github.com/tsvalencio-IA/Evolution-Radar-IA/blob/desenvolvimento/base-evolution-radar/worker/evolution-search-worker.js

Depois de salvar/deploy, em **Settings → Variables and Secrets**, configure três itens:

| Variável | Tipo | Valor |
|---|---|---|
| `TAVILY_API_KEY` | **Secret** | Sua chave Tavily, somente no painel Cloudflare |
| `ALLOWED_UID` | **Secret** | UID do usuário autorizado a fazer buscas |
| `FIREBASE_WEB_API_KEY` | Texto (configuração pública) | Web API Key do aplicativo Evolution Radar IA |

Clique **Deploy** para salvar as variáveis. **Não habilite plano pago** nem configure faturamento.

O Worker exige token Firebase válido, compara UID autorizado, atende apenas a origem `https://tsvalencio-ia.github.io` e limita o resultado a domínios conhecidos. A API externa consome créditos; o navegador não recebe a chave.

**3. Conectar o site ao Worker**

Copie apenas a URL pública HTTPS do Worker — ela não é uma senha. Informe-a nesta conversa; a integração atualiza somente:

`public/search-config.js`

Isso dispara o GitHub Actions que publica a interface. Não é necessário qualquer terminal.

## Testar o funcionamento

1. Abra https://tsvalencio-ia.github.io/Evolution-Radar-IA/ e entre com sua conta Firebase.
2. Em **Pesquisa**, preencha marca, modelo, cidade e UF (demais filtros conforme interesse).
3. Clique **Pesquisar motos agora**.
4. Compare títulos, URLs e trechos nas fontes de anúncio. Clique **Abrir página de origem** para conferir.
5. Se for útil, clique **Registrar como lead**. A ficha será preenchida apenas com fonte, URL e informação indexada. A evidência permanece "índice", e preço/ano/KM exigem checagem.

## Limitações reais

- O Google e os marketplaces não fornecem ao Evolution Radar IA acesso irrestrito a anúncios. A Tavily busca páginas indexadas, que podem estar antigas ou indisponíveis.
- O texto da pesquisa inclui modelo, versão, ano e cidade; isso não é garantia de aplicação dos limites de preço, KM ou raio. Nenhum lead pode ser aprovado sem verificação da página individual e dos filtros.
- A conexão não coleta dados privados nem contorna CAPTCHA, login ou proteções.
- A chave deve continuar em Secret no Worker; **não colocar a chave no JavaScript do Pages ou no GitHub**.
- As cotas gratuitas podem acabar e interromper as pesquisas. A ação do Worker retorna erro explícito, não simula sucesso.
- Antes do uso comercial contínuo, verificar a adequação da hospedagem GitHub Pages aos termos aplicáveis.
