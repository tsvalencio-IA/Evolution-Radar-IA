import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/evolution-search-worker.js";
import {workspaceConfig} from "../public/workspace-config.js";
const url="https://evolution-radar-search.tsvalencio.workers.dev/interpret";
const req=()=>new Request(url,{method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io",Authorization:"Bearer "+"x".repeat(150),"Content-Type":"application/json"},body:JSON.stringify({message:"Procure Yamaha Factor 125 2012 em São José do Rio Preto SP"})});
const ai={run:async()=>({response:'{"brand":"Yamaha","model":"Factor 125","yearFrom":"2012","yearTo":"2012"}'})};
const env={ALLOWED_UID:workspaceConfig.ownerUid,FIREBASE_WEB_API_KEY:"PUBLIC_TEST",TAVILY_API_KEY:"KEY",AI:ai};
async function simulate(id,membership,fn,verified=true){
 const prev=globalThis.fetch,calls=[];
 globalThis.fetch=async (url)=>{
  const u=String(url);calls.push(u);
  if(u.includes("identitytoolkit.googleapis.com"))return Response.json({users:[{localId:id,disabled:false,emailVerified:verified}]});
  if(u.includes("/workspaces/evolution-motos/members/"))return Response.json(membership);
  throw Error("unexpected fetch "+u);
 };
 try{return await fn(calls);}finally{globalThis.fetch=prev;}
}
test("padrinho continua autorizado sem consultar associação",async()=>{
 await simulate(workspaceConfig.ownerUid,null,async calls=>{
  const res=await worker.fetch(req(),env);assert.equal(res.status,200);
  assert.equal(calls.length,1);
 });
});
test("cadastro aprovado tem pesquisa liberada automaticamente",async()=>{
 await simulate("new-member",{status:"approved",permissions:{search:true,view:true}},async calls=>{
  const res=await worker.fetch(req(),env);assert.equal(res.status,200);
  assert.ok(calls.some(u=>u.includes("members/new-member.json")));
 });
});
for(const [status,perms] of [["pending",{search:true}],["suspended",{search:true}],["revoked",{search:true}],["approved",{search:false}]]){
 test("bloqueia membro "+status+" com autorização "+JSON.stringify(perms),async()=>{
  await simulate("new-member",{status,permissions:perms},async()=>{
   const res=await worker.fetch(req(),{...env,ALLOWED_UIDS:"new-member"});
   assert.equal(res.status,403);
  });
 });
}
test("anônimo e membro não cadastrado ficam bloqueados",async()=>{
 await simulate("unknown",null,async()=>{
  const res=await worker.fetch(req(),env);assert.equal(res.status,403);
 });
});

test("membro aprovado sem e-mail verificado continua bloqueado",async()=>{
 await simulate("not-verified",{status:"approved",permissions:{search:true,view:true}},async()=>{
  const res=await worker.fetch(req(),env);
  assert.equal(res.status,403);
 },false);
});
