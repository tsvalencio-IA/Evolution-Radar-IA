import test from "node:test";
import assert from "node:assert/strict";
import {searchQuery,marketplaceName,normalizeWebLeads} from "../public/search-engine.mjs";
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
