import test from "node:test";
import assert from "node:assert/strict";
import {parseFacts,gradeListing} from "../worker/evolution-search-worker.js";
import worker from "../worker/evolution-search-worker.js";
import {normalizeWebLeads,classifyDiscoveryForFilters,partitionDiscovery} from "../public/search-engine.mjs";
import {resolveMunicipality,municipalityFromLocationText} from "../public/br-municipios.mjs";
import {manageMember} from "../public/team-admin.js";
import {workspaceConfig} from "../public/workspace-config.js";

const filters={brand:"Yamaha",model:"Factor 125",version:"",yearType:"model",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50"};
const url="https://sp.olx.com.br/regiao-de-sao-jose-do-rio-preto/autos-e-pecas/motos/moto-factor-125i-2018-flex-1536339057";
// Estrutura de campos observada na página individual OLX. Sem descrição do vendedor.
const olx="## Detalhes\nModelo\n[Factor 125i Ed](https://www.olx.com.br/)\nMarca\n[Yamaha](https://www.olx.com.br/)\nAno\n2018\nQuilometragem\n59000\n## Localização\n\nJardim Nazareth São José do Rio Preto, SP, 15054000";
test("localização OLX em várias linhas reconhece cidade após bairro e não usa cidade pesquisada",()=>{
  const facts=parseFacts(olx,"Moto Factor 125i 2018 FLEX",filters);
  assert.equal(facts.city,"São José do Rio Preto");assert.equal(facts.uf,"SP");
  assert.equal(facts.brand,"Yamaha");assert.equal(facts.model,"Factor 125i Ed");
  assert.equal(facts.km,59000);assert.equal(facts.yearAdvertised,2018);
  assert.equal(facts.yearMake,null);assert.equal(facts.yearModel,null);assert.equal(facts.price,null);
  assert.equal(municipalityFromLocationText("Entrega em São José do Rio Preto, SP"),null);
  assert.equal(municipalityFromLocationText("Localização: Sete Barras - SP").name,"Sete Barras");
  assert.equal(municipalityFromLocationText("Cidade: Campinas - SP\nLocalização: Sete Barras - SP"),null);
  assert.equal(resolveMunicipality("Bonito"),null);
});
test("marca comprovada nos detalhes dispensa marca repetida no título e preserva pendências",()=>{
  const item={title:"Moto Factor 125i 2018 FLEX",url,fields:parseFacts(olx,"",filters),extractionStatus:"extracted"};
  item.assessment=gradeListing(item,filters);
  assert.equal(item.assessment.bucket,"prequalified");
  const normalized=normalizeWebLeads([item])[0];
  assert.equal(classifyDiscoveryForFilters(normalized,filters).category,"in-area");
  assert.equal(normalized.fields.brand,"Yamaha");
  assert.equal(gradeListing(item,{...filters,yearFrom:"2018",yearTo:"2018"}).bucket,"pending");
});
test("modelo por palavras completas aceita ordem do título sem confundir 125 com 1250",()=>{
  const base={url,fields:{city:"Bady Bassitt",uf:"SP"},pageType:"individual-candidate"};
  assert.equal(classifyDiscoveryForFilters({...base,title:"Yamaha YBR 125 Factor"},filters).category,"in-area");
  assert.equal(classifyDiscoveryForFilters({...base,title:"Yamaha Factor 1250"},filters).category,"model-unverified");
});
test("anúncio incompleto continua investigável, fora do grupo regional; catálogo e fora do raio ficam excluídos",()=>{
  const base={title:"Yamaha Factor 125",url,pageType:"individual-candidate",assessment:{bucket:"pending"}};
  const unknown={...base,fields:{city:null,uf:null}};
  const outside={...base,fields:{city:"Sete Barras",uf:"SP"}};
  const catalog={...base,pageType:"catalog"};
  const near={...base,fields:{city:"Bady Bassitt",uf:"SP"}};
  const result=partitionDiscovery([unknown,outside,catalog,near],filters);
  assert.deepEqual(result.matched.map(x=>x.item),[near]);
  assert.deepEqual(result.unresolved.map(x=>x.item),[unknown]);
  assert.deepEqual(result.excluded.map(x=>x.item),[outside,catalog]);
  assert.equal(partitionDiscovery([{...unknown,fields:{price:20000}}],{...filters,priceMax:"10000"}).unresolved.length,0);
});
test("simulação de parcelas não vira preço total; recomendações não contaminam cidade nem KM",()=>{
  const text="# Yamaha Factor 125\nR$ 8.900\nFinancie em 48x R$ 277,99 com entrada de R$ 2.310,00\n"+olx+
    "\nAnúncios relacionados\nHonda Titan\nR$ 19.000\nQuilometragem: 1000\nLocalização: Sete Barras - SP";
  const facts=parseFacts(text,"Yamaha Factor",filters);
  assert.equal(facts.price,8900);assert.equal(facts.city,filters.originCity);assert.equal(facts.km,59000);
});
test("cache separa ano de fabricação de ano modelo na mesma pesquisa",async()=>{
  const previous=globalThis.fetch;let searches=0;
  globalThis.fetch=async input=>{
    const uri=String(input);
    if(uri.includes("identitytoolkit"))return Response.json({users:[{localId:"recovery-owner"}]});
    if(uri.endsWith("/search")){searches++;return Response.json({results:[{url,title:"Yamaha Factor 125"}]});}
    if(uri.endsWith("/extract"))return Response.json({results:[{url,raw_content:"Ano 2011/2012\nLocalização: Bady Bassitt - SP"}]});
    throw Error("Unexpected request");
  };
  const env={ALLOWED_UID:"recovery-owner",FIREBASE_WEB_API_KEY:"test",TAVILY_API_KEY:"test"};
  const query=yearType=>new Request("https://worker.test/search",{method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io",Authorization:"Bearer "+"x".repeat(140),"Content-Type":"application/json"},body:JSON.stringify({filters:{...filters,yearFrom:"2012",yearTo:"2012",priceMax:"98765",yearType}})});
  try{
    const first=await (await worker.fetch(query("model"),env)).json();
    const second=await (await worker.fetch(query("make"),env)).json();
    assert.equal(first.items[0].assessment.bucket,"pending");
    assert.equal(second.items[0].assessment.bucket,"outside");
    assert.equal(second.cache,false);assert.equal(searches,6);
  }finally{globalThis.fetch=previous;}
});
test("editar nome ou permissões não reativa colaborador suspenso ou revogado",async()=>{
  for(const status of ["suspended","revoked"]){
    for(const action of ["rename","permissions"]){
      let updated;
      const api={ref:(_db,path="")=>path,get:async path=>({val:()=>path.startsWith("registrationRequests/")?{name:"Colaborador",email:"test@example.test"}:{name:"Colaborador",status,permissions:{view:true}}}),
        serverTimestamp:()=>1234,push:()=>({key:"audit-test"}),update:async(_ref,value)=>{updated=value;}};
      const uid="test-collaborator-123";
      await manageMember({db:{},api,user:{uid:workspaceConfig.ownerUid},uid,action,name:"Nome atualizado",permissions:{view:true,search:true}});
      assert.equal(updated["workspaces/"+workspaceConfig.id+"/members/"+uid].status,status);
    }
  }
});
