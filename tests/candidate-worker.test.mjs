import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/evolution-search-worker.js";
const url="https://sp.olx.com.br/autos-e-pecas/motos/fixture-9937700001";
const filters={brand:"Honda",model:"CG 160",version:"Fan",yearFrom:"2024",yearTo:"2024",yearType:"model",originCity:"Campinas",uf:"SP",kmMax:"20000"};
const payload={"@type":"Motorcycle",url,brand:{name:"Honda"},model:"CG 160",vehicleConfiguration:"Fan",vehicleModelDate:"2024",mileageFromOdometer:{value:10000,unitCode:"KMT"},offers:{price:19000,priceCurrency:"BRL"},address:{addressLocality:"Campinas",addressRegion:"SP"}};
const request=(path,body)=>new Request("https://worker.test"+path,{method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io",Authorization:"Bearer "+"x".repeat(140),"Content-Type":"application/json"},body:JSON.stringify(body)});
const env=uid=>({ALLOWED_UID:uid,FIREBASE_WEB_API_KEY:"public-fixture",TAVILY_API_KEY:"secret-fixture"});
test("consultas simultâneas compartilham coleta; cache sempre revalida autenticação",async()=>{
 const previous=globalThis.fetch;let searchCalls=0,authCalls=0,authorized=true;
 globalThis.fetch=async input=>{const uri=String(input);if(uri.includes("identitytoolkit")){authCalls++;return Response.json({users:authorized?[{localId:"coalesce-owner"}]:[]});}
 if(uri.endsWith("/search")){searchCalls++;await new Promise(resolve=>setTimeout(resolve,5));return Response.json({results:[{url,title:"Honda CG 160 Fan 2024"}]});}
 return new Response('<h1>Honda CG 160 Fan à venda</h1><script type="application/ld+json">'+JSON.stringify(payload)+'</script>',{headers:{"Content-Type":"text/html"}});};
 try{
  const results=await Promise.all([worker.fetch(request('/search',{filters}),env("coalesce-owner")),worker.fetch(request('/search',{filters}),env("coalesce-owner"))]);
  const [a,b]=await Promise.all(results.map(x=>x.json()));assert.equal(searchCalls,3);assert.equal(authCalls,2);assert.ok(a.coalesced||b.coalesced);
  const cache=await (await worker.fetch(request('/search',{filters}),env("coalesce-owner"))).json();assert.equal(cache.cache,true);assert.equal(searchCalls,3);assert.equal(authCalls,3);
  authorized=false;const denied=await worker.fetch(request('/search',{filters}),env("coalesce-owner"));assert.equal(denied.status,403);assert.equal(searchCalls,3);
 }finally{globalThis.fetch=previous;}
});
test("limite temporário recusa sétima coleta distinta no mesmo isolate",async()=>{
 const previous=globalThis.fetch;let searches=0;
 globalThis.fetch=async input=>{const uri=String(input);if(uri.includes('identitytoolkit'))return Response.json({users:[{localId:"limited-owner"}]});if(uri.endsWith('/search')){searches++;return Response.json({results:[]});}throw Error('Unexpected');};
 try{for(let n=1;n<=6;n++){const r=await worker.fetch(request('/search',{filters:{...filters,priceMax:String(30000+n)}}),env('limited-owner'));assert.equal(r.status,200);}const count=searches;
  const r=await worker.fetch(request('/search',{filters:{...filters,priceMax:'39999'}}),env('limited-owner'));assert.equal(r.status,429);assert.equal((await r.json()).code,'SEARCH_REQUEST_LIMIT');assert.equal(searches,count);
 }finally{globalThis.fetch=previous;}
});
test("rota de IA corrige preço falso, KM e cidade usando unidades expressas",async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>Response.json({users:[{localId:'intent-contract-owner'}]});
 const configuration={...env('intent-contract-owner'),AI:{run:async()=>({response:JSON.stringify({brand:'Honda',model:'CG 160',version:'Titan',priceMax:20000,kmMax:40000,originCity:'São Paulo',uf:'SP'})})}};
 try{const r=await worker.fetch(request('/interpret',{message:'Honda Fan 160 2024 em Campinas até 20 mil km'}),configuration);const data=await r.json();assert.equal(r.status,200);assert.equal(data.filters.kmMax,'20000');assert.equal(data.filters.priceMax,undefined);assert.equal(data.filters.originCity,'Campinas');assert.equal(data.filters.version,'Fan');}
 finally{globalThis.fetch=previous;}
});
test("corpo grande sem Content-Length e município inválido não consomem Tavily",async()=>{
 const previous=globalThis.fetch;let called=0;globalThis.fetch=async()=>{called++;return Response.json({users:[{localId:'body-owner'}]});};
 try{assert.equal((await worker.fetch(request('/search',{x:'x'.repeat(5000)}),env('body-owner'))).status,413);assert.equal((await worker.fetch(request('/search',{filters:{...filters,originCity:'Cidade inventada'}}),env('body-owner'))).status,400);assert.equal(called,2);}
 finally{globalThis.fetch=previous;}
});
