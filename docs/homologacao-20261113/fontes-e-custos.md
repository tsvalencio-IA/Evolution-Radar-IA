# Fontes, integrações e custos

Consulta documental realizada em 13/14 de novembro de 2026. Somente documentação pública; nenhuma conta de fornecedor foi contratada ou consultada.

## Facebook

Não foi localizado um contrato oficial de deep link do aplicativo Marketplace que assegure cidade e raio para este caso. Portanto o código mantém a abertura HTTPS que já funcionava e o parâmetro textual `query`; não inventa IDs municipais ou parâmetros nativos. O painel exibe e permite copiar cidade, raio, anos, preço e KM para conferência no aplicativo. Não houve teste em aparelho Android com a conta pessoal do cliente.

A Meta documenta consultas de Marketplace no Content Library, porém o acesso requer instituição acadêmica ou de pesquisa elegível e aprovação. Isso não equivale a uma API comercial liberada pela sessão pessoal do Facebook. Nenhuma elegibilidade foi presumida e nenhum conector desse produto foi ativado.

- [Meta: guia de Marketplace](https://developers.facebook.com/docs/content-library-and-api/content-library-api/guides/fb-marketplace/)
- [Meta: acesso e elegibilidade](https://developers.facebook.com/docs/content-library-and-api/get-access)
- [Chrome: receber compartilhamentos em PWA instalado](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)

O compartilhamento foi implementado conforme o contrato GET de título/texto/URL e testado como navegação no receiver. A aparição no seletor nativo depende de instalação, navegador e SO; falta homologação no aparelho. Links curtos `/share/...`, de login ou redirecionamento não são convertidos por adivinhação: abrir no Facebook e copiar o endereço individual. No iPhone, o campo de colar link permanece disponível. Receber não salva nem autentica um anúncio; texto compartilhado é anotação não conferida.

## Dados veiculares

| Fonte | Cobertura documentada | Acesso/custo e limite |
|---|---|---|
| Consulta Online SENATRAN / Serpro | Dados e indicadores de veículo, restrições, roubo/furto e tipo de remarcação; cada campo possui classificação própria | Requer necessidade demonstrada, credenciamento/TAAD, contratação Serpro e GCC conforme documentação. Tarifa vigente e custo total não foram confirmados; não utilizar valores antigos como orçamento |
| Assertiva Veículos | Consulta base/protocolo e complementares: BIN estadual/federal, roubo/furto, gravame, histórico de leilão e indícios de sinistro | OAuth2 e contratação/autorização do produto. Preço comercial e cobertura da conta não disponíveis nesta missão; indício de sinistro não é laudo conclusivo |

- [Serpro: contratação](https://centraldeajuda.serpro.gov.br/consultasenatran/comofunciona/)
- [Serpro: campos de veículo](https://centraldeajuda.serpro.gov.br/consultasenatran/veiculo/)
- [Serpro: tabela de preços a confirmar](https://centraldeajuda.serpro.gov.br/consultasenatran/precos/)
- [Assertiva: documentação oficial](https://integracao.assertivasolucoes.com.br/v3/portal/veiculos)

Não se presume cobertura completa de leilões ou de toda a vida do veículo em nenhuma base. Indicador atual de restrição não prova histórico integral. A escolha de fornecedor, finalidade, base de tratamento, autorizações, retenção e responsabilidades precisa ser avaliada na contratação. Não armazenar CPF, endereço ou documentos de proprietários nas oportunidades. O adaptador retorna somente condições, escopo, protocolo, fonte e data; seus campos de autorização não substituem avaliação de conformidade.

`queryVehicleRisk` define o contrato `adapter.query({vehicle, authorization})`. Sem adaptador, retorna `not-configured` com todos os riscos desconhecidos. Não há endpoint, segredo ou chamada externa fictícia embutida. O teste do contrato usa fornecedor local de teste. A implementação real do adaptador, mapeamento de resposta, credenciais de servidor e contrato específico dependem da escolha autorizada; não basta inserir uma chave no frontend.

## Pesquisa, mapas e exclusão de contas

- [Tavily Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract): verificar resultados e falhas por URL; HTTP 200 não garante extração completa. O Radar usa orçamento de tentativas, sem promessa de franquia ilimitada.
- Distância entre sedes usa a base municipal já incorporada, sem nova API cartográfica ou cobrança. Não é rota, endereço do anúncio ou localização do vendedor. Uma rota paga não foi contratada. É possível registrar distância conferida manualmente com fonte e data.
- A credencial administrativa de exclusão definitiva continua pendente segundo a auditoria recebida. O botão conserva a proteção existente. Não foram criados/apagados usuários reais nem alteradas credenciais.

**Custo adicional realizado nesta missão: nenhum serviço contratado e nenhuma consulta real cobrável desses fornecedores.** A operação futura continua sujeita às quotas/custos já existentes de Cloudflare, Tavily e Firebase. Custos de consulta veicular ou roteamento devem ser orçados e aprovados separadamente.
