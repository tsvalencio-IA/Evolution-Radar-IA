import test from "node:test";
import assert from "node:assert/strict";
import {searchQuery,marketplaceName,normalizeWebLeads,classifySearchPage} from "../public/search-engine.mjs";
test("consulta preserva marca, versão e município",()=>{
  const q=searchQuery({brand:"Honda",model:"CG 160",version:"Titan",yearFrom:"2022",yearTo:"2024",originCity:"São José do Rio Preto",uf:"SP"});
  for(const part of ["Honda","CG 160","Titan","2022","2024","São José do Rio Preto","SP"])assert.ok(q.includes(part));
});
test("não confundir domínio falso com plataforma",()=>{
 assert.equal(marketplaceName("https://olx.com.br.evil.example/moto"),"");
 assert.equal(marketplaceName("https://sp.olx.com.br/ads/12345678"),"OLX");
});
test("deduplicar links indexados e nunca promover a verificados",()=>{
 const items=normalizeWebLeads([{title:"Honda CG 160 Titan",url:"https://sp.olx.com.br/motos/12345678?utm_source=google",content:"R$ 15.800"},{title:"Moto duplicada",url:"https://sp.olx.com.br/motos/12345678"},{title:"Fake",url:"https://desconhecido.example/lista"}]);
 assert.equal(items.length,1);assert.equal(items[0].evidence,"index");assert.equal(items[0].source,"OLX");
});

test("catálogos não viram leads individuais",()=>{
  const urls=[
    "https://www.olx.com.br/autos-e-pecas/motos/honda/cg/2022/estado-sp/regiao-de-sao-jose-do-rio-preto",
    "https://www.webmotors.com.br/motos/sp-sao-paulo/honda/cg-160-titan/de.2024/ate.2024",
    "https://lista.mercadolivre.com.br/honda-titan-usadas-2022"
  ];
  for(const url of urls)assert.equal(classifySearchPage(url),"catalog",url);
});
test("links com formato individual continuam apenas candidatos",()=>{
  assert.equal(classifySearchPage("https://sp.olx.com.br/autos-e-pecas/motos/honda-cg-160-titan-2022-1497739355"),"individual-candidate");
  assert.equal(classifySearchPage("https://www.webmotors.com.br/comprar/honda/cg-160-titan/160cc/2022-2023/3098769"),"individual-candidate");
  const x=normalizeWebLeads([{title:"Honda CG 160 Titan",url:"https://sp.olx.com.br/autos-e-pecas/motos/honda-cg-160-titan-2022-1497739355"}])[0];
  assert.equal(x.pageType,"individual-candidate");
  assert.equal(x.evidence,"index");
});
test("URLs desconhecidas não são declaradas individuais",()=>{
  assert.equal(classifySearchPage("https://napista.com.br/motos"),"catalog");
  assert.equal(classifySearchPage("https://example.com/moto"),"unknown");
});
