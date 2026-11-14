import test from "node:test";
import assert from "node:assert/strict";
import {parseLocalIntent,mergeIntentFilters} from "../public/local-intent.mjs";
const old={brand:"Honda",model:"CG 160",version:"Fan",kmMax:"40000",priceMax:"",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50"};
for(const unit of ["20mil km","20 mil km","20.000 km","20 mil rodados","vinte mil km"])
test("F12: "+unit+" representa KM e não preço",()=>{
 const parsed=parseLocalIntent("Honda Fan 160 2024 em Campinas ate "+unit,old),f=mergeIntentFilters(old,parsed.filters);
 assert.deepEqual(parsed.warnings,[]);assert.equal(f.kmMax,"20000");assert.equal(f.priceMax,"");assert.equal(f.model,"CG 160");assert.equal(f.version,"Fan");assert.equal(f.originCity,"Campinas");
});
test("preço, mínimo/máximo KM e raio coexistem sem confundir unidades",()=>{
 const p=parseLocalIntent("Honda Fan 160 2024 em Campinas até R$ 18.000, entre 10 mil e 20 mil km, raio de 50 km");
 assert.deepEqual(p.warnings,[]);assert.equal(p.filters.priceMax,"18000");assert.equal(p.filters.kmMin,"10000");assert.equal(p.filters.kmMax,"20000");assert.equal(p.filters.radiusKm,"50");
});
test("caso real Suzuki DR160 em Ribeirão Preto",()=>{
 const p=parseLocalIntent("Suzuki DR160 ano-modelo 2026, preço de R$ 19.000 a R$ 23.000 em Ribeirão Preto SP, raio de 10 km");
 assert.deepEqual(p.warnings,[]);assert.equal(p.filters.model,"DR160");assert.equal(p.filters.originCity,"Ribeirão Preto");assert.equal(p.filters.priceMin,"19000");assert.equal(p.filters.priceMax,"23000");assert.equal(p.filters.radiusKm,"10");
});
test("alterações sucessivas preservam só limites apropriados e permitem remoção explícita",()=>{
 let f=mergeIntentFilters(old,parseLocalIntent("agora em Campinas até 20 mil km",old).filters);
 assert.equal(f.model,"CG 160");assert.equal(f.kmMax,"20000");
 f=mergeIntentFilters(f,parseLocalIntent("Suzuki DR160 2026 em Ribeirão Preto",f).filters);
 assert.equal(f.kmMax,"");assert.equal(f.priceMax,"");assert.equal(f.version,"");
 f=mergeIntentFilters({...f,priceMax:"23000"},parseLocalIntent("sem limite de preço",f).filters);
 assert.equal(f.priceMin,"");assert.equal(f.priceMax,"");
});
test("limites contraditórios exigem esclarecimento",()=>{
 assert.ok(parseLocalIntent("Honda Fan 160 até 20 mil km e até 30 mil km").warnings.length);
 assert.ok(parseLocalIntent("Honda Fan 160 entre 30 mil e 20 mil km").warnings.length);
 assert.ok(parseLocalIntent("Honda Fan e Titan 160").warnings.length);
});
test("valores com unidade não viram ano nem cilindrada",()=>{
 const price=parseLocalIntent("Honda Fan até R$ 2024 em Campinas");assert.equal(price.filters.priceMax,"2024");assert.equal(price.filters.yearFrom,undefined);assert.equal(price.filters.model,"");
 const km=parseLocalIntent("Honda Fan até 125 km em Campinas");assert.equal(km.filters.kmMax,"125");assert.equal(km.filters.model,"");
});
test("trocar apenas a marca não transporta o modelo da outra fabricante",()=>{
 const f=mergeIntentFilters(old,parseLocalIntent("agora Yamaha").filters);assert.equal(f.brand,"Yamaha");assert.equal(f.model,"");assert.equal(f.kmMax,"");
});
test("nome municipal com cor e condição se possível não viram filtros falsos",()=>{
 assert.deepEqual(parseLocalIntent("Honda Fan 160 2024 em Rio Branco AC até 20 mil km").warnings,[]);
 assert.deepEqual(parseLocalIntent("Honda Fan 160 2024 em Campinas se possível até 20 mil km").warnings,[]);
 const p=parseLocalIntent("Honda Fan 160 2024 em Bonito ms até 20 mil km");assert.equal(p.filters.uf,"MS");assert.deepEqual(p.warnings,[]);
});
