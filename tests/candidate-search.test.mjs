import test from "node:test";
import assert from "node:assert/strict";
import {collectCandidates,inspectPublicPage,SEARCH_BUDGET,planQueries} from "../worker/search-pipeline.mjs";
import {gradeListing} from "../worker/evolution-search-worker.js";
import {parseStructuredListing,detectPageState} from "../public/page-evidence.mjs";
import {parseListingFacts} from "../public/listing-facts.mjs";
const f={brand:"Yamaha",model:"Factor 125",yearType:"model",yearFrom:"2012",yearTo:"2012",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50",sellerType:"all"};
const url="https://sp.olx.com.br/regiao-de-sao-jose-do-rio-preto/autos-e-pecas/motos/yamaha-factor-1550857572";
const product={"@type":"Motorcycle",url,brand:{name:"Yamaha"},model:"Factor 125",productionDate:"2012",vehicleModelDate:"2012",mileageFromOdometer:{value:19000,unitCode:"KMT"},offers:{price:8900,priceCurrency:"BRL"},address:{addressLocality:"Bady Bassitt",addressRegion:"SP"}};
const html=(data=product)=>'<h1>Yamaha Factor 125 ano 2012 à venda</h1><script type="application/ld+json">'+JSON.stringify(data)+'</script>';
const removed='<h1>A página não foi encontrada...</h1><h2>Similares a este anúncio</h2><div>Yamaha Factor 2012</div><div>Preço: R$ 8.900</div><div>Localização: Bady Bassitt - SP</div>';
function fixture({page=html(),pageStatus=200,rawContent="",many=1,failExtract=false,failSearch=false}={}){
 const calls=[];
 const fetchImpl=async(input,options={})=>{
  const target=String(input);calls.push({target,body:options.body?JSON.parse(options.body):null});
  if(target.endsWith("/search"))return failSearch?Response.json({error:"secret-never-export"},{status:429}):Response.json({results:Array.from({length:many},(_,i)=>({url:i?url.replace("1550857572",String(1550857572+i)):url,title:"Yamaha Factor 125 2012",content:"Índice apenas"}))});
  if(target.endsWith("/extract"))return Response.json({results:failExtract?[]:(rawContent?[{url,raw_content:rawContent}]:[]),failed_results:failExtract?[{url,error:"secret-never-export"}]:[]});
  return new Response(page,{status:pageStatus,headers:{"Content-Type":"text/html"}});
 };return {fetchImpl,calls};
}
test("página pública e JSON-LD identificam a moto certa sem consumir extração desnecessária",async()=>{
 const t=fixture(),data=await collectCandidates(f,{TAVILY_API_KEY:"secret-never-export"},{...t,grade:gradeListing});
 assert.equal(data.items[0].fields.price,8900);assert.equal(data.items[0].fields.km,19000);
 assert.equal(data.items[0].assessment.bucket,"prequalified");assert.equal(data.items[0].availability.httpStatus,200);
 assert.equal(data.coverage.queriesAttempted,3);assert.equal(data.coverage.tavilyExtractionUrls,0);
 assert.equal(JSON.stringify(data).includes("secret-never-export"),false);
});
test("soft-404 e HTTP 404 não extraem recomendações como se fossem a moto removida",async()=>{
 for(const pageStatus of [200,404]){
  const t=fixture({page:removed,pageStatus}),data=await collectCandidates(f,{}, {...t,grade:gradeListing});
  assert.equal(data.items[0].assessment.bucket,"unavailable");assert.equal(data.items[0].fields.price,null);
  assert.equal(data.coverage.tavilyExtractionUrls,0);assert.equal(data.coverage.unavailable,1);
 }
 assert.equal(parseListingFacts(removed,f).price,null);
});
test("bloqueio público não é removido e não é contornado com extração",async()=>{
 const t=fixture({page:"Access denied",pageStatus:403}),data=await collectCandidates(f,{}, {...t,grade:gradeListing});
 assert.equal(data.items[0].availability.status,"blocked");assert.equal(data.items[0].assessment.bucket,"pending");
 assert.equal(data.coverage.tavilyExtractionUrls,0);
});
test("JSON-LD de recomendações e de outro anúncio não é usado",()=>{
 assert.equal(parseStructuredListing(html({"@type":"ItemList",itemListElement:[product]}),url,f).price,null);
 assert.equal(parseStructuredListing(html({...product,url:url.replace("1550857572","1550857573")}),url,f).price,null);
 assert.equal(detectPageState(removed).status,"unavailable");
});
test("contradição entre HTML e extração permanece pendente com campos nulos",async()=>{
 const t=fixture({page:'<h1>Yamaha Factor 125 à venda</h1>\nMarca: Yamaha\nModelo: Factor 125\nPreço: R$ 8.500',rawContent:'Marca: Yamaha\nModelo: Factor 125\nPreço: R$ 8.900\nAno-modelo: 2012\nQuilometragem: 19000\nLocalização: Bady Bassitt - SP'});
 const data=await collectCandidates(f,{}, {...t,grade:gradeListing});
 assert.equal(data.items[0].fields.price,null);assert.ok(data.items[0].fieldEvidence.conflicts.includes("price"));
 assert.equal(data.items[0].assessment.bucket,"pending");
});
test("falhas parciais da Tavily são sanitizadas e não viram ausência de motos",async()=>{
 const t=fixture({page:'<h1>Yamaha Factor 125 à venda</h1>',failExtract:true}),data=await collectCandidates(f,{}, {...t,grade:gradeListing});
 assert.equal(data.items[0].extractionError,"TAVILY_EXTRACT_URL_FAILED");
 assert.ok(data.coverage.errors.some(x=>x.stage==="extract"));assert.equal(JSON.stringify(data).includes("secret-never-export"),false);
});
test("quantidade de buscas, páginas públicas e URLs de extração nunca excede o orçamento",async()=>{
 const t=fixture({page:'<h1>Yamaha Factor 125 à venda</h1>',many:25,failExtract:true}),data=await collectCandidates(f,{}, {...t,grade:gradeListing});
 assert.ok(data.coverage.queriesAttempted<=SEARCH_BUDGET.searches);assert.ok(data.coverage.publicPagesAttempted<=5);assert.ok(data.coverage.tavilyExtractionUrls<=5);
 assert.ok(t.calls.filter(x=>x.target.endsWith("/search")).length<=4);
});
test("limite da Tavily interrompe coleta e retorna código sem dados privados",async()=>{
 const t=fixture({failSearch:true});await assert.rejects(()=>collectCandidates(f,{}, {...t,grade:gradeListing}),e=>e.code==="TAVILY_RATE_LIMIT");
 assert.equal(t.calls.some(x=>x.target.endsWith("/extract")),false);
});
test("timeout, redirecionamento e URL não permitida não são página disponível",async()=>{
 const timeout=await inspectPublicPage(url,{timeoutMs:5,fetchImpl:(_u,options)=>new Promise((_,reject)=>options.signal.addEventListener("abort",()=>reject(new DOMException("Timeout","AbortError"))))});
 assert.equal(timeout.availability.reason,"PAGE_TIMEOUT");
 let called=0;const redir=await inspectPublicPage(url,{fetchImpl:async()=>{called++;return new Response(null,{status:302,headers:{Location:"http://169.254.169.254/"}})}});
 assert.equal(called,1);assert.equal(redir.availability.status,"unverified");
 assert.equal((await inspectPublicPage("http://127.0.0.1/",{fetchImpl:()=>{throw Error("never");}})).availability.reason,"URL_NOT_ALLOWED");
});
test("plano regional contempla municípios próximos sem afirmar distância por estrada",()=>{
 const plans=planQueries(f);assert.equal(plans.length,3);assert.ok(plans.some(x=>x.includes("Bady Bassitt")||x.includes("Mirassol")));
});
test("distâncias de entrega e raio não são quilometragem do hodômetro",()=>{
 assert.equal(parseListingFacts("Yamaha Factor 125 2012\nEntrega em raio de 50 km\nA 10 km do centro",f).km,null);
 assert.equal(parseListingFacts("Yamaha Factor 125 2012\n19000 km rodados",f).km,19000);
});
test("contradições entre dois objetos JSON-LD primários não são resolvidas pelo preço do HTML",async()=>{
 const page=html({"@graph":[product,{...product,offers:{price:7900,priceCurrency:"BRL"}}]})+"\nPreço: R$ 8.900";
 const t=fixture({page}),data=await collectCandidates(f,{}, {...t,grade:gradeListing});
 assert.equal(data.items[0].fields.price,null);assert.ok(data.items[0].fieldEvidence.conflicts.includes("price"));assert.equal(data.items[0].assessment.bucket,"pending");
});
test("título antigo do índice não substitui identidade ausente na página",()=>{
 const item={title:"Yamaha Factor 125 2012",fields:{price:8900,km:19000,yearModel:2012,city:"Bady Bassitt",uf:"SP"},extractionStatus:"extracted",availability:{status:"available"}};
 assert.equal(gradeListing(item,f).bucket,"pending");
});
