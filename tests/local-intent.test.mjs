import test from "node:test";
import assert from "node:assert/strict";
import {parseLocalIntent,mergeIntentFilters} from "../public/local-intent.mjs";

test("identifica Honda CG Titan ano exato e preserva cidade quando não citada",()=>{
 const x=parseLocalIntent("Procure Honda CG 125 Titan 2002 em Rio Preto");
 const f=mergeIntentFilters({brand:"Yamaha",model:"125",version:"Factor",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"100",yearFrom:"2012",yearTo:"2024"},x.filters);
 assert.deepEqual(x.warnings,[]);assert.equal(f.brand,"Honda");assert.equal(f.model,"CG 125");assert.equal(f.version,"Titan");assert.equal(f.yearFrom,"2002");assert.equal(f.yearTo,"2002");assert.equal(f.originCity,"São José do Rio Preto");assert.equal(f.radiusKm,"100");
});
test("não confunde Titan com Fan e bloqueia busca ambígua",()=>{
 const x=parseLocalIntent("Moto Titan fan 125 2002");assert.ok(x.warnings.some(w=>w.includes("versões diferentes")));
});
test("Factor 125 2012 e preço máximo explícito",()=>{
 const x=parseLocalIntent("Procure Yamaha Factor 125 ano 2012 até R$ 8.000");
 assert.equal(x.filters.brand,"Yamaha");assert.equal(x.filters.model,"125");assert.equal(x.filters.version,"Factor");assert.equal(x.filters.yearFrom,"2012");assert.equal(x.filters.priceMax,"8000");
});
test("não adivinha modelo ou cidade, nem adiciona preço sem evidência",()=>{
 const x=parseLocalIntent("Quero uma moto barata na minha região");assert.equal(x.filters.model,undefined);assert.equal(x.filters.originCity,undefined);assert.equal(x.filters.priceMax,undefined);
});
test("permite intervalos e troca de versão sem manter versão anterior",()=>{
 const x=parseLocalIntent("Honda CG 160 de 2022 a 2024");
 const f=mergeIntentFilters({brand:"Yamaha",model:"125",version:"Factor",uf:"SP"},x.filters);
 assert.equal(f.version,"");assert.equal(f.yearFrom,"2022");assert.equal(f.yearTo,"2024");
});
