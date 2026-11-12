import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import worker from "../worker/evolution-search-worker.js";

const owner="7eMEMOUcjAgKi69r1m7rD59d12H3",uid="member-1234567890123456",email="membro@example.test";
const workerUrl="https://evolution-radar-search.tsvalencio.workers.dev";
const bearer="x".repeat(150);
const rsa=generateKeyPairSync("rsa",{modulusLength:2048});
const service=JSON.stringify({project_id:"evolution-radar-ia",client_email:"test@evolution-radar-ia.iam.gserviceaccount.com",
  private_key:rsa.privateKey.export({type:"pkcs8",format:"pem"}),token_uri:"https://oauth2.googleapis.com/token"});
const env={FIREBASE_WEB_API_KEY:"TEST_KEY",ALLOWED_UID:owner,
  FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:service};
const request=(payload={},token=bearer)=>new Request(workerUrl+"/admin/delete-user",{
  method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io",
  Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({uid,email,confirmation:"EXCLUIR",...payload})
});
async function mocked(handler){
  const previous=globalThis.fetch,calls=[];
  globalThis.fetch=async (input,opts={})=>{
    const uri=String(input),body=opts.body?String(opts.body):"";
    calls.push({uri,method:opts.method||"GET",body});
    if(uri.includes("identitytoolkit.googleapis.com/v1/accounts:lookup?key="))
      return Response.json({users:[{localId:owner,disabled:false}]});
    if(uri.includes("oauth2.googleapis.com/token"))return Response.json({access_token:"oauth-token"});
    if(uri.includes("projects/evolution-radar-ia/accounts:lookup"))
      return Response.json({users:[{localId:uid,email}]});
    if(uri.includes("projects/evolution-radar-ia/accounts:delete"))return Response.json({});
    if(uri.includes("registrationRequests/"+uid)&&(!opts.method||opts.method==="GET"))
      return Response.json({name:"Membro",email,sponsorUid:owner,status:"approved"});
    if(uri.includes("/members/"+uid)&&(!opts.method||opts.method==="GET"))
      return Response.json({status:"approved",name:"Membro",email});
    if(uri.includes("firebaseio.com/"))return Response.json({ok:true});
    return handler?.(uri,opts)||new Response("unexpected request "+uri,{status:500});
  };
  return {calls,restore:()=>{globalThis.fetch=previous;}};
}
test("exclusão administrativa real remove Authentication e perfis, audita",async()=>{
  const f=await mocked();
  try{
    const res=await worker.fetch(request(),env);
    const body=await res.json();
    assert.equal(res.status,200);assert.equal(body.deleted,true);
    assert.ok(f.calls.some(x=>x.uri.includes("accounts:delete")&&JSON.parse(x.body).localId===uid));
    assert.ok(f.calls.some(x=>x.method==="DELETE"&&x.uri.includes("members/"+uid)));
    assert.ok(f.calls.some(x=>x.method==="DELETE"&&x.uri.includes("registrationRequests/"+uid)));
    assert.ok(f.calls.some(x=>x.method==="POST"&&x.uri.includes("adminAudit")));
    assert.ok(f.calls.some(x=>x.uri.includes("accounts:lookup")));
  }finally{f.restore();}
});
test("sem credencial administrativa retorna erro e nunca finge excluir",async()=>{
  const f=await mocked();
  try{
    const res=await worker.fetch(request(),{ALLOWED_UID:owner,FIREBASE_WEB_API_KEY:"TEST_KEY"});
    assert.equal(res.status,503);
    assert.equal((await res.json()).code,"ADMIN_CREDENTIALS_MISSING");
    assert.ok(!f.calls.some(x=>x.uri.includes("accounts:delete")));
  }finally{f.restore();}
});
test("admin não pode excluir sua própria conta",async()=>{
  const f=await mocked();
  try{
    const res=await worker.fetch(request({uid:owner}),env);
    assert.equal(res.status,403);
    assert.ok(!f.calls.some(x=>x.uri.includes("accounts:delete")));
  }finally{f.restore();}
});
test("confirmação e-mail é obrigatória e nunca exclui outra conta",async()=>{
  const f=await mocked();
  try{
    for(const payload of [{confirmation:"APAGAR"},{uid:"invalid uid"},{email:"incorreto@example.test"}]){
      const res=await worker.fetch(request(payload),env);
      assert.ok(res.status>=400);
    }
    assert.ok(!f.calls.some(x=>x.uri.includes("accounts:delete")));
  }finally{f.restore();}
});
test("membro autenticado não pode chamar rota administrativa",async()=>{
  const f=await mocked();
  const old=f.restore;
  globalThis.fetch=async (input,opts)=>{
    if(String(input).includes("identitytoolkit.googleapis.com/v1/accounts:lookup?key="))
      return Response.json({users:[{localId:uid,disabled:false,emailVerified:true}]});
    return Response.json(null);
  };
  try{
    const res=await worker.fetch(request(),env);
    assert.equal(res.status,403);
  }finally{old();}
});
test("health declara se exclusão administrativa está habilitada",async()=>{
 const result=await worker.fetch(new Request(workerUrl+"/health"),env);
 assert.equal((await result.json()).accountDeletionConfigured,true);
});
