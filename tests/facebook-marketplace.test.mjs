import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {facebookListingUrl,facebookMarketplaceSearch} from "../public/marketplaces.mjs";
import {canonicalUrl,sourceSearches,isListingOrSearchUrl} from "../public/core.mjs";
import {classifySearchPage,normalizeWebLeads} from "../public/search-engine.mjs";
const filters={brand:"Yamaha",model:"Factor 125",yearFrom:"2012",yearTo:"2012",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50"};
test("busca nativa leva termos da moto e mantém localização/raio como não aplicados",()=>{
 const source=facebookMarketplaceSearch(filters),url=new URL(source.url);
 assert.equal(url.hostname,"www.facebook.com");assert.equal(url.pathname,"/marketplace/search/");
 assert.equal(url.searchParams.get("query"),"Yamaha Factor 125 2012");
 assert.equal(url.searchParams.has("radius"),false);assert.equal(source.radiusKm,"50");
 assert.equal(source.automaticImport,false);assert.equal(source.mode,"external-session");
 assert.ok(sourceSearches(filters).some(x=>x.name==="Facebook Marketplace"));
});
test("normaliza links individuais mobile e desktop sem duplicatas de rastreamento",()=>{
 const expected="https://www.facebook.com/marketplace/item/123456789012345/";
 for(const host of ["m.facebook.com","www.facebook.com","web.facebook.com","facebook.com"]){
  assert.equal(facebookListingUrl("https://"+host+"/marketplace/item/123456789012345/?ref=search&referral_code=test"),expected);
  assert.equal(canonicalUrl("https://"+host+"/marketplace/item/123456789012345/?ref=search"),expected);
 }
 assert.equal(isListingOrSearchUrl(expected),false);
 assert.equal(isListingOrSearchUrl("https://www.facebook.com/marketplace/search/?query=Factor"),true);
});
test("não aceita domínio falso, login, perfil, grupo nem redirecionador como anúncio",()=>{
 for(const url of ["https://facebook.com.evil.example/marketplace/item/123456789012345/","https://www.facebook.com/login/","https://www.facebook.com/groups/1234","https://www.facebook.com/share/abc","https://www.facebook.com/l.php?u=https://example.test","https://secret@www.facebook.com/marketplace/item/123456789012345/"])
  assert.equal(facebookListingUrl(url),"",url);
 assert.equal(normalizeWebLeads([{title:"Yamaha Factor",url:"https://www.facebook.com/groups/1234"}]).length,0);
});
test("link Facebook recebido não vira página conferida ou localização comprovada",()=>{
 const url="https://www.facebook.com/marketplace/item/123456789012345/";
 assert.equal(classifySearchPage(url),"individual-candidate");
 const item=normalizeWebLeads([{url,title:"Yamaha Factor 125 2012"}])[0];
 assert.equal(item.evidence,"index");assert.equal(item.assessment.bucket,"pending");assert.equal(item.fields.city,null);
});
test("cadastro Facebook preenche somente fonte/link e mantém os dados da moto em branco",()=>{
 const app=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
 assert.match(app,/source:"Facebook Marketplace",url,evidence:"provided"/);
 assert.match(app,/brand:"",model:"",version:"",city:"",uf:"",yearMake:"",yearModel:"",price:"",km:""/);
});
