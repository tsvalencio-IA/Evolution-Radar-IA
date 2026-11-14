import test from "node:test";
import assert from "node:assert/strict";
import worker,{safeIntent} from "../worker/evolution-search-worker.js";
const origin="https://tsvalencio-ia.github.io";
const url="https://evolution-radar-search.tsvalencio.workers.dev/interpret";
const env={ALLOWED_UID:"test-user",FIREBASE_WEB_API_KEY:"PUBLIC_TEST",TAVILY_API_KEY:"SECRET_TEST"};
const req=(msg)=>new Request(url,{method:"POST",headers:{Origin:origin,Authorization:"Bearer "+"x".repeat(150),"Content-Type":"application/json"},body:JSON.stringify({message:msg})});
test("IA filtra campos e recusa valores inventados ou inválidos",()=>{
  assert.deepEqual(safeIntent({brand:"Yamaha",model:"Factor 125",yearFrom:2012,yearTo:2012,priceMax:8000,uf:"sp",outside:"ignore"}),{
    brand:"Yamaha",model:"Factor 125",uf:"SP",yearFrom:"2012",yearTo:"2012",priceMax:"8000"
  });
  assert.equal(safeIntent({priceMax:-4,uf:"invalido"}).priceMax,undefined);
});
test("IA exige token antes de chamar modelo",async()=>{
  const r=await worker.fetch(new Request(url,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({message:"Procure Honda Titan em Rio Preto"})}),{...env,AI:{run:async()=>{throw Error("não pode chamar");}}});
  assert.equal(r.status,401);
});
test("IA devolve erro claro se binding não publicado",async()=>{
  const prev=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({users:[{localId:"test-user",disabled:false}]});
  try{const res=await worker.fetch(req("Procure Yamaha Factor 2012 em Rio Preto"),env);assert.equal(res.status,503);assert.match((await res.json()).error,/Workers AI/);}finally{globalThis.fetch=prev;}
});
test("IA autenticada extrai intenção e não aciona Tavily",async()=>{
  const calls=[],prev=globalThis.fetch;
  globalThis.fetch=async u=>{calls.push(String(u));return Response.json({users:[{localId:"test-user",disabled:false}]});};
  const ai={run:async(model,opts)=>{assert.equal(model,"@cf/zai-org/glm-4.7-flash");assert.equal(opts.stream,false);return {response:'{"brand":"Yamaha","model":"Factor 125","yearFrom":"2012","yearTo":"2012","priceMax":8000,"originCity":"São José do Rio Preto","uf":"SP"}'};}};
  try{
    const res=await worker.fetch(req("Procure Factor 125 2012 até oito mil em Rio Preto"),{...env,AI:ai});
    const body=await res.json();
    assert.equal(res.status,200);assert.equal(body.filters.model,"Factor 125");assert.equal(body.filters.priceMax,"8000");
    assert.equal(calls.length,1);assert.match(calls[0],/identitytoolkit/);
  }finally{globalThis.fetch=prev;}
});


test("GLM retorna formato JSON por choices e raciocínio desativado",async()=>{
 const prev=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({users:[{localId:"test-user",disabled:false}]});
 const ai={run:async(model,options)=>{
   assert.equal(model,"@cf/zai-org/glm-4.7-flash");
   assert.equal(options.chat_template_kwargs.enable_thinking,false);
   assert.deepEqual(options.response_format,{type:"json_object"});
   return {choices:[{message:{content:'{"brand":"Kawasaki","model":"Ninja 400","yearFrom":"2021","yearTo":"2021","priceMax":30000,"originCity":"São José do Rio Preto","uf":"SP"}'}}]};
 }};
 try{
   const res=await worker.fetch(req("Procure Kawasaki Ninja 400 2021 até 30000 em São José do Rio Preto"),{...env,AI:ai});
   assert.equal(res.status,200);
   const body=await res.json();
   assert.equal(body.mode,"workers-ai");
   assert.equal(body.filters.brand,"Kawasaki");assert.equal(body.filters.model,"Ninja 400");
   assert.equal(body.filters.priceMax,"30000");
 }finally{globalThis.fetch=prev;}
});
test("IA com resposta vazia informa código preciso, sem vazar prompt",async()=>{
 const prev=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({users:[{localId:"test-user",disabled:false}]});
 const ai={run:async()=>({choices:[{message:{content:""}}]})};
 try{
   const res=await worker.fetch(req("Procure Kawasaki Ninja 300 2020"),{...env,AI:ai});
   assert.equal(res.status,502);
   const body=await res.json();
   assert.equal(body.code,"AI_EMPTY_RESPONSE");
   assert.equal(JSON.stringify(body).includes("Procure Kawasaki"),false);
 }finally{globalThis.fetch=prev;}
});

test("Worker preserva ano inicial sem inventar teto no pedido XRE a partir de 2020",async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({users:[{localId:"test-user",disabled:false}]});
  const ai={run:async()=>({response:JSON.stringify({brand:"Honda",model:"XRE 300",
    yearFrom:"2020",yearTo:"2020",originCity:"Campinas",uf:"SP"})})};
  try{
    const res=await worker.fetch(req("Honda XRE 300 a partir de 2020 em Campinas"),{...env,AI:ai});
    const data=await res.json();
    assert.equal(res.status,200,JSON.stringify(data));
    assert.equal(data.filters.model,"XRE 300");
    assert.equal(data.filters.yearFrom,"2020");
    assert.equal(data.filters.yearTo,undefined);
    assert.equal(data.filters.originCity,"Campinas");
  }finally{globalThis.fetch=previous;}
});

test("Worker rejeita modelo de IA divergente da XRE pedida, mesmo com ano correto",async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({users:[{localId:"test-user",disabled:false}]});
  const ai={run:async()=>({response:JSON.stringify({brand:"Honda",model:"CG 160",
    yearFrom:"2020",yearTo:"2020",originCity:"Campinas",uf:"SP"})})};
  try{
    const res=await worker.fetch(req("Procure Honda XRE 300 a partir de 2020 em Campinas"),{...env,AI:ai});
    const data=await res.json();
    assert.equal(res.status,422,JSON.stringify(data));
    assert.equal(data.code,"INTENT_NEEDS_CLARIFICATION");
    assert.equal(JSON.stringify(data).includes("CG 160"),false);
  }finally{globalThis.fetch=previous;}
});
