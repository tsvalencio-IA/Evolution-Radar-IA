import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/evolution-search-worker.js";

const url="https://evolution-radar-search.tsvalencio.workers.dev/interpret";
const basic={ALLOWED_UID:"owner-user",FIREBASE_WEB_API_KEY:"PUBLIC_TEST"};
const authHeaders={Origin:"https://tsvalencio-ia.github.io","Content-Type":"application/json",Authorization:"Bearer "+"x".repeat(150)};
const req=()=>new Request(url,{method:"POST",headers:authHeaders,body:JSON.stringify({message:"Procure uma Kawasaki Ninja 400 ano 2021 em São José do Rio Preto SP"})});
const AI={run:async()=>({response:'{"brand":"Kawasaki","model":"Ninja 400","yearFrom":"2021","yearTo":"2021","originCity":"São José do Rio Preto","uf":"SP"}'})};
async function withUser(localId,fn){
  const original=globalThis.fetch;
  globalThis.fetch=async url=>String(url).includes("identitytoolkit.googleapis.com")?Response.json({users:[{localId,disabled:false,emailVerified:true}]}):Response.json(null);
  try{return await fn();}finally{globalThis.fetch=original;}
}

test("proprietário permanece autorizado sem variável adicional",async()=>{
  await withUser("owner-user",async()=>{
    const res=await worker.fetch(req(),{...basic,AI});
    assert.equal(res.status,200);
    assert.equal((await res.json()).filters.brand,"Kawasaki");
  });
});
test("usuário adicional, autorizado por lista de secrets, pode interpretar",async()=>{
  await withUser("second-user",async()=>{
    const res=await worker.fetch(req(),{...basic,ALLOWED_UIDS:"third-user, second-user",AI});
    assert.equal(res.status,200);
    assert.equal((await res.json()).filters.model,"Ninja 400");
  });
});
test("outro usuário autenticado continua bloqueado",async()=>{
  await withUser("intruder",async()=>{
    const res=await worker.fetch(req(),{...basic,ALLOWED_UIDS:"second-user",AI});
    assert.equal(res.status,403);
    assert.match((await res.json()).error,/autorizado/);
  });
});
test("sem lista adicional, segundo usuário não é autorizado",async()=>{
  await withUser("second-user",async()=>{
    const res=await worker.fetch(req(),{...basic,AI});
    assert.equal(res.status,403);
  });
});
