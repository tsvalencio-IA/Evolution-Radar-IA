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

test("fala completa em português preenche modelo, cidade, UF e preço",()=>{
 const x=parseLocalIntent("Procure Yamaha Factor 125, ano 2012, até oito mil, em São José do Rio Preto");
 assert.deepEqual(x.warnings,[]);
 assert.deepEqual({brand:x.filters.brand,model:x.filters.model,version:x.filters.version,
   yearFrom:x.filters.yearFrom,yearTo:x.filters.yearTo,priceMax:x.filters.priceMax,
   originCity:x.filters.originCity,uf:x.filters.uf},{
   brand:"Yamaha",model:"125",version:"Factor",yearFrom:"2012",yearTo:"2012",
   priceMax:"8000",originCity:"São José do Rio Preto",uf:"SP"
 });
});
test("consulta de particular com raio e capital inequívoca",()=>{
 const x=parseLocalIntent("Honda CG 160 Fan 2022 até 18000 em Goiânia raio de 150 km particular");
 assert.deepEqual(x.warnings,[]);
 assert.equal(x.filters.brand,"Honda");
 assert.equal(x.filters.model,"CG 160");
 assert.equal(x.filters.version,"Fan");
 assert.equal(x.filters.priceMax,"18000");
 assert.equal(x.filters.originCity,"Goiânia");
 assert.equal(x.filters.uf,"GO");
 assert.equal(x.filters.radiusKm,"150");
 assert.equal(x.filters.sellerType,"particular");
});
test("abreviação Rio Preto somente quando explicitamente em SP ou já selecionada",()=>{
 const x=parseLocalIntent("Factor 125 2012 até R$ 8.000 em Rio Preto", {originCity:"São José do Rio Preto",uf:"SP"});
 assert.equal(x.filters.originCity,"São José do Rio Preto");
 assert.equal(x.filters.uf,"SP");
 const unknown=parseLocalIntent("Factor 125 2012 em Rio Preto");
 assert.equal(unknown.filters.originCity,undefined);
});
test("UF divergente de cidade reconhecida não é pesquisada silenciosamente",()=>{
 const x=parseLocalIntent("CG 160 em Goiânia, estado SP");
 assert.ok(x.warnings.some(w=>w.includes("não corresponde")));
});


test("Kawasaki nova limpa limites antigos de Yamaha sem apagar localização",()=>{
 const prev={brand:"Yamaha",model:"125",version:"Factor",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"150",
   priceMin:"4500",priceMax:"18000",yearFrom:"2012",yearTo:"2024",kmMax:"300000",sellerType:"particular"};
 const f=mergeIntentFilters(prev,{brand:"Kawasaki",model:"Ninja 400",yearFrom:"2021",yearTo:"2021",priceMax:"30000"});
 assert.equal(f.brand,"Kawasaki");assert.equal(f.model,"Ninja 400");assert.equal(f.version,"");
 assert.equal(f.priceMin,"");assert.equal(f.priceMax,"30000");assert.equal(f.kmMax,"");
 assert.equal(f.yearFrom,"2021");assert.equal(f.yearTo,"2021");
 assert.equal(f.sellerType,"all");assert.equal(f.originCity,"São José do Rio Preto");assert.equal(f.uf,"SP");
 assert.equal(f.radiusKm,"150");
});
