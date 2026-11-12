import test from "node:test";
import assert from "node:assert/strict";
import {resolveMunicipality,municipalityFromLocationText,assessMunicipalityRadius,municipalityDistanceKm} from "../public/br-municipios.mjs";
import {classifyDiscoveryForFilters} from "../public/search-engine.mjs";
import {parseFacts,gradeListing} from "../worker/evolution-search-worker.js";
import {evaluateLead} from "../public/core.mjs";

const filters={brand:"Honda",model:"CG 125",version:"Titan",yearType:"model",yearFrom:"2022",yearTo:"2024",priceMin:"4000",priceMax:"15000",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50"};
const near="Bady Bassitt",far="Sete Barras";
const sample=(city,uf)=>"Honda CG 125 Titan 2023\\nPreço: R$ 10.500\\nKM: 18.000 km\\nAno 2023/2023\\nLocalização: "+city+" - "+uf;
test("base cobre sedes municipais verificáveis, acentos e UFs",()=>{
 const rio=resolveMunicipality("São José do Rio Preto","SP");
 assert.ok(rio);assert.equal(resolveMunicipality("Sao Jose do Rio Preto","sp").name,rio.name);
 assert.ok(municipalityDistanceKm(rio,resolveMunicipality(near,"SP"))<50);
 assert.ok(municipalityDistanceKm(rio,resolveMunicipality(far,"SP"))>50);
 assert.equal(resolveMunicipality("Município que não existe","SP"),null);
});
test("não cria cidade usando o nome da origem na consulta",()=>{
 assert.equal(municipalityFromLocationText("Honda CG Titan - São José do Rio Preto. R$ 10.000"),null);
 assert.equal(municipalityFromLocationText("Localização: "+near+" - SP").name,near);
 const fields=parseFacts("Honda CG 125 Titan 2023 sem endereço", "Honda CG 125 Titan",filters);
 assert.equal(fields.city,null);assert.equal(fields.uf,null);
});
test("50 km de Rio Preto aceitam cidade próxima e excluem Sete Barras",()=>{
 assert.equal(assessMunicipalityRadius(filters,near,"SP").status,"inside");
 assert.equal(assessMunicipalityRadius(filters,far,"SP").status,"outside");
 const good=parseFacts(sample(near,"SP"),"Honda CG 125 Titan",filters);
 const bad=parseFacts(sample(far,"SP"),"Honda CG 125 Titan",filters);
 assert.equal(good.city,near);
 assert.equal(bad.city,far);
 assert.equal(gradeListing({title:"Honda CG 125 Titan",fields:good,extractionStatus:"extracted"},filters).bucket,"prequalified");
 assert.equal(gradeListing({title:"Honda CG 125 Titan",fields:bad,extractionStatus:"extracted"},filters).bucket,"outside");
});
test("rejeita cilindrada diferente e não inventa oferta compatível",()=>{
 const fields=parseFacts(sample(near,"SP"),"Honda CG 125 Titan",filters);
 assert.equal(gradeListing({title:"Honda CG 250 Titan",fields,extractionStatus:"extracted"},filters).bucket,"outside");
});
test("interface oculta catálogos, localizações desconhecidas e anúncios fora do raio",()=>{
 const make=(city,uf,title="Honda CG 125 Titan 2023")=>({title,pageType:"individual-candidate",fields:{city,uf,price:10500,km:18000,yearModel:2023}});
 assert.equal(classifyDiscoveryForFilters(make(near,"SP"),filters).category,"in-area");
 assert.equal(classifyDiscoveryForFilters(make(far,"SP"),filters).category,"out-of-area");
 assert.equal(classifyDiscoveryForFilters(make(null,null),filters).category,"location-unverified");
 assert.equal(classifyDiscoveryForFilters(make(near,"SP","Honda CG 250 2023"),filters).category,"model-unverified");
 assert.equal(classifyDiscoveryForFilters({...make(near,"SP"),pageType:"catalog"},filters).category,"catalog");
 assert.equal(classifyDiscoveryForFilters(make(near,"SP"),{...filters,priceMax:"9000"}).category,"outside-filters");
});
test("histórico mantém registro mas não promove município distante",()=>{
 const lead={id:"antigo",brand:"Honda",model:"CG 125",version:"Titan",yearModel:2023,price:10500,km:18000,city:far,uf:"SP",source:"OLX",url:"https://olx.com.br/anuncio/123",evidence:"page",distanceVerified:false};
 assert.equal(evaluateLead(lead,filters).bucket,"outside");
 const nearby={...lead,city:near};
 assert.equal(evaluateLead(nearby,filters).bucket,"pending");
});
