import test from "node:test";
import assert from "node:assert/strict";
import worker,{listingType,parseFacts,gradeListing,searchPlan} from "../worker/evolution-search-worker.js";
const filters={
 brand:"Honda",model:"CG 160",version:"Titan",yearType:"model",
 yearFrom:"2022",yearTo:"2024",priceMax:"18000",kmMax:"40000",
 originCity:"São José do Rio Preto",uf:"SP",radiusKm:"150"
};
const listing="https://www.olx.com.br/autos-e-pecas/motos/honda/cg/2022/estado-sp/regiao-de-sao-jose-do-rio-preto";
const direct="https://sp.olx.com.br/regiao-de-sao-jose-do-rio-preto/autos-e-pecas/motos/honda-cg-160-titan-2022-1497739355";
const sample="Honda CG 160 Titan 2022\nPreço R$ 16.900\nQuilometragem: 30.000 km\nAno 2022/2022\nLocalização: São José do Rio Preto - SP";
test("OLX: catálogo não equivale a anúncio individual",()=>{
 assert.equal(listingType(listing),"catalog");
 assert.equal(listingType(direct),"individual-candidate");
 assert.equal(listingType("https://www.webmotors.com.br/comprar/honda/cg-160-titan/160cc/2022-2023/3098769"),"individual-candidate");
});
test("buscas contemplam o ano intermediário",()=>{
 const q=searchPlan(filters);
 assert.equal(q.length,3);
 assert.ok(q.some(x=>x.includes("2022")));
 assert.ok(q.some(x=>x.includes("2023")));
 assert.ok(q.some(x=>x.includes("2024")));
});
test("extração determinística identifica campos explicitados",()=>{
 const f=parseFacts(sample,"Honda CG 160 Titan",filters);
 assert.equal(f.price,16900);assert.equal(f.km,30000);
 assert.equal(f.yearMake,2022);assert.equal(f.yearModel,2022);
 assert.equal(f.city,"São José do Rio Preto");
});
test("prequalificado não é aprovação de compra",()=>{
 const fields=parseFacts(sample,"Honda CG 160 Titan",filters);
 const result=gradeListing({title:"Honda CG 160 Titan 2022",fields,extractionStatus:"extracted"},filters);
 assert.equal(result.bucket,"prequalified");
 assert.match(result.reasons.join(" "),/confirmar/i);
});
test("exclui versão e preço conflitantes",()=>{
 const fields=parseFacts(sample,"Honda CG 160 Titan",filters);
 assert.equal(gradeListing({title:"Honda CG 160 Fan",fields,extractionStatus:"extracted"},filters).bucket,"outside");
 assert.equal(gradeListing({title:"Honda CG 160 Titan",fields:{...fields,price:18990},extractionStatus:"extracted"},filters).bucket,"outside");
});
test("não supõe quilometragem, localização ou preço",()=>{
 const fields=parseFacts("Honda Titan 2022", "Honda CG 160 Titan",filters);
 assert.equal(fields.price,null);
 assert.equal(fields.km,null);
 assert.equal(fields.city,null);
 assert.equal(gradeListing({title:"Honda CG 160 Titan",fields,extractionStatus:"extracted"},filters).bucket,"pending");
});
test("não usa Tavily para solicitação sem autenticação",async()=>{
 const env={TAVILY_API_KEY:"SECRET_TEST",ALLOWED_UID:"test-user",FIREBASE_WEB_API_KEY:"PUBLIC_TEST"};
 const req=new Request("https://evolution-radar-search.tsvalencio.workers.dev/search",{
   method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io","Authorization":"Bearer "+"x".repeat(140),"Content-Type":"application/json"},body:JSON.stringify({filters})
 });
 const prev=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return Response.json({users:[]});};
 try{
  const res=await worker.fetch(req,env);
  assert.equal(res.status,403);
  assert.equal(calls.length,1);
  assert.ok(calls[0].includes("identitytoolkit.googleapis.com"));
 }finally{globalThis.fetch=prev;}
});
test("pesquisa + extração com índice separado e sem revelar chave",async()=>{
 const env={TAVILY_API_KEY:"SECRET_TEST",ALLOWED_UID:"test-user",FIREBASE_WEB_API_KEY:"PUBLIC_TEST"};
 const f={...filters,originCity:"São José do Rio Preto",priceMax:"17999"};
 const req=new Request("https://evolution-radar-search.tsvalencio.workers.dev/search",{
  method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io","Authorization":"Bearer "+"x".repeat(140),"Content-Type":"application/json"},
  body:JSON.stringify({filters:f})
 });
 const calls=[],prev=globalThis.fetch;
 globalThis.fetch=async (url,options)=>{
  const u=String(url);calls.push(u);
  if(u.includes("identitytoolkit.googleapis.com"))return Response.json({users:[{localId:"test-user",disabled:false}]});
  if(u.endsWith("/search"))return Response.json({results:[
   {title:"Honda CG 160 Titan 2022",url:direct,content:"moto anunciada"},
   {title:"Catálogo de motos",url:listing,content:"Fan Start Titan"}
  ]});
  if(u.endsWith("/extract"))return Response.json({results:[{url:direct,raw_content:sample}],failed_results:[]});
  return Response.json({error:"unexpected"},{status:404});
 };
 try{
  const res=await worker.fetch(req,env),raw=await res.text(),body=JSON.parse(raw);
  assert.equal(res.status,200);
  assert.equal(body.coverage.queriesAttempted,3);
  assert.equal(body.coverage.extractionSucceeded,1);
  assert.equal(body.items[0].assessment.bucket,"prequalified");
  assert.equal(body.items[0].fields.price,16900);
  assert.equal(body.items.find(x=>x.pageType==="catalog").assessment.bucket,"catalog");
  assert.equal(raw.includes("SECRET_TEST"),false);
  assert.equal(calls.filter(x=>x.endsWith("/search")).length,3);
  assert.equal(calls.filter(x=>x.endsWith("/extract")).length,1);
 }finally{globalThis.fetch=prev;}
});

test("consulta regional não restringe OLX a SP nem exclui Fan ou Start",()=>{
 const q=searchPlan({...filters,brand:"Honda",model:"CG 125",version:"Fan",originCity:"Goiânia",uf:"GO",yearFrom:"2012",yearTo:"2024"});
 assert.ok(q.some(x=>x.includes("site:olx.com.br")));
 assert.equal(q.some(x=>x.includes("site:sp.olx.com.br")),false);
 assert.equal(q.some(x=>x.includes("-Fan")||x.includes("-Start")),false);
 assert.ok(q.some(x=>x.includes("2018")));
});
test("health comprova versão do Worker sem consumir Tavily ou dados do usuário",async()=>{
 const res=await worker.fetch(new Request("https://evolution-radar-search.tsvalencio.workers.dev/health"),{});
 assert.equal(res.status,200);
 const payload=await res.json();
 assert.equal(payload.service,"Evolution Radar IA");
 assert.ok(payload.capabilities.includes("interpret"));
 assert.equal(typeof payload.version,"string");
});

test("busca de recuperação não fica presa a SP quando região é GO",async()=>{
 const inputs={...filters,brand:"Honda",model:"CG 125",version:"Fan",originCity:"Goiânia",uf:"GO",yearFrom:"2011",yearTo:"2012"};
 const env={TAVILY_API_KEY:"SECRET_TEST",ALLOWED_UID:"test-user",FIREBASE_WEB_API_KEY:"PUBLIC_TEST"};
 const req=new Request("https://evolution-radar-search.tsvalencio.workers.dev/search",{
   method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io",Authorization:"Bearer "+"x".repeat(140),"Content-Type":"application/json"},
   body:JSON.stringify({filters:inputs})
 });
 const calls=[],prev=globalThis.fetch;
 globalThis.fetch=async (url,options)=>{
   const u=String(url);
   if(u.includes("identitytoolkit.googleapis.com"))return Response.json({users:[{localId:"test-user",disabled:false}]});
   if(u.endsWith("/search")){
     calls.push(JSON.parse(options.body).query);
     return Response.json({results:[{title:"Catálogo Honda CG 125",url:"https://www.olx.com.br/autos-e-pecas/motos",content:"Lista de motos"}]});
   }
   return Response.json({error:"unexpected"},{status:404});
 };
 try{
   const res=await worker.fetch(req,env),body=await res.json();
   assert.equal(res.status,200);
   assert.equal(body.coverage.queriesAttempted,4);
   assert.equal(calls.length,4);
   assert.ok(calls[3].includes("site:olx.com.br"));
   assert.ok(calls.every(q=>!q.includes("site:sp.olx.com.br")));
 }finally{globalThis.fetch=prev;}
});


test("Worker rejeita páginas de imóveis e celulares antes de consumir Tavily Extract",async()=>{
 const f={...filters,priceMax:"16666",yearTo:"2024"};
 const env={TAVILY_API_KEY:"SECRET_TEST",ALLOWED_UID:"test-user",FIREBASE_WEB_API_KEY:"PUBLIC_TEST"};
 const req=new Request("https://evolution-radar-search.tsvalencio.workers.dev/search",{
  method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io",Authorization:"Bearer "+"x".repeat(140),"Content-Type":"application/json"},
  body:JSON.stringify({filters:f})
 });
 const prev=globalThis.fetch,calls=[];
 globalThis.fetch=async (url)=>{
  const u=String(url);calls.push(u);
  if(u.includes("identitytoolkit.googleapis.com"))return Response.json({users:[{localId:"test-user",disabled:false}]});
  if(u.endsWith("/search"))return Response.json({results:[
    {title:"Casas à venda - SP",url:"https://sp.olx.com.br/imoveis/casas"},
    {title:"Celulares Motorola",url:"https://sp.olx.com.br/celulares"},
    {title:"Motos Honda CG 160",url:"https://sp.olx.com.br/autos-e-pecas/motos/honda"}
  ]});
  return Response.json({error:"unexpected"},{status:404});
 };
 try{
   const res=await worker.fetch(req,env),body=await res.json();
   assert.equal(res.status,200);
   assert.equal(body.items.length,1);
   assert.match(body.items[0].title,/Motos Honda/);
   assert.equal(calls.some(x=>x.endsWith("/extract")),false);
 }finally{globalThis.fetch=prev;}
});

test("códigos de falha de extração não expõem texto externo nem fingem indisponibilidade",async()=>{
 const {classifyExtractionFailure}=await import("../worker/evolution-search-worker.js");
 assert.equal(classifyExtractionFailure("403 Forbidden /token=SEGREDO"),"EXTRACT_ACCESS_REPORTED");
 assert.equal(classifyExtractionFailure("Timeout after 10 seconds"),"EXTRACT_TIMEOUT_REPORTED");
 assert.equal(classifyExtractionFailure(""),"EXTRACT_NO_DETAILS");
 const env={TAVILY_API_KEY:"SECRET_TEST",ALLOWED_UID:"test-user",FIREBASE_WEB_API_KEY:"PUBLIC_TEST"};
 const f={...filters,priceMax:"17651"};
 const req=new Request("https://evolution-radar-search.tsvalencio.workers.dev/search",{
  method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io",Authorization:"Bearer "+"x".repeat(140),"Content-Type":"application/json"},
  body:JSON.stringify({filters:f})
 });
 const prev=globalThis.fetch;
 globalThis.fetch=async url=>{
  const u=String(url);
  if(u.includes("identitytoolkit.googleapis.com"))return Response.json({users:[{localId:"test-user",disabled:false}]});
  if(u.endsWith("/search"))return Response.json({results:[{title:"Honda CG 160 Titan 2022",url:direct}]});
  if(u.endsWith("/extract"))return Response.json({results:[],failed_results:[{url:direct,error:"403 Forbidden token=SECRET_TEST"}]});
  return Response.json({error:"unexpected"},{status:404});
 };
 try{
  const res=await worker.fetch(req,env),raw=await res.text(),data=JSON.parse(raw);
  assert.equal(res.status,200);
  assert.equal(data.coverage.extractionAttempted,1);
  assert.equal(data.coverage.extractionSucceeded,0);
  assert.equal(data.coverage.extractionFailures,1);
  assert.equal(data.coverage.extractionFailureReasons.EXTRACT_ACCESS_REPORTED,1);
  assert.equal(data.items[0].extractionFailureCode,"EXTRACT_ACCESS_REPORTED");
  assert.equal(data.items[0].assessment.bucket,"pending");
  assert.equal(raw.includes("SECRET_TEST"),false);
  assert.equal(raw.includes("Forbidden"),false);
 }finally{globalThis.fetch=prev;}
});
test("resposta vazia da extração conta como falha, não sucesso",async()=>{
 const env={TAVILY_API_KEY:"SECRET_TEST",ALLOWED_UID:"test-user",FIREBASE_WEB_API_KEY:"PUBLIC_TEST"};
 const f={...filters,priceMax:"17652"};
 const req=new Request("https://evolution-radar-search.tsvalencio.workers.dev/search",{
  method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io",Authorization:"Bearer "+"x".repeat(140),"Content-Type":"application/json"},body:JSON.stringify({filters:f})
 });
 const prev=globalThis.fetch;
 globalThis.fetch=async url=>{
  const u=String(url);
  if(u.includes("identitytoolkit.googleapis.com"))return Response.json({users:[{localId:"test-user",disabled:false}]});
  if(u.endsWith("/search"))return Response.json({results:[{title:"Honda CG 160 Titan 2022",url:direct}]});
  if(u.endsWith("/extract"))return Response.json({results:[{url:direct,raw_content:""}],failed_results:[]});
  return Response.json({error:"unexpected"},{status:404});
 };
 try{
  const res=await worker.fetch(req,env),data=await res.json();
  assert.equal(data.coverage.extractionSucceeded,0);
  assert.equal(data.coverage.extractionFailures,1);
  assert.equal(data.items[0].extractionFailureCode,"EXTRACT_EMPTY_CONTENT");
 }finally{globalThis.fetch=prev;}
});
