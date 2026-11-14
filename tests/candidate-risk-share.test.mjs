import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RISK_TYPES,normalizeRiskReport,assessVehicleRisk,queryVehicleRisk} from "../public/vehicle-risk.mjs";
import {parseSharedListing,readPendingShare,SHARE_KEY} from "../public/share-target.mjs";
import {sanitizeLead,evaluateLead,csvExport} from "../public/core.mjs";
import {describeGeography} from "../public/geography.mjs";
import {consumeRequestBudget,withDeadline} from "../worker/request-guard.mjs";
const evidence={source:"Fonte de teste",reference:"protocolo-fixture",scope:"Somente base e data da consulta de teste",checkedAt:"2026-11-13T12:00:00Z"};
const url="https://www.facebook.com/marketplace/item/1234567890123/";
const lead={id:"fixture",brand:"Yamaha",model:"Factor 125",url,source:"Facebook Marketplace",city:"São José do Rio Preto",uf:"SP",evidence:"page"};
test("silêncio do anúncio, falso booleano e metadados incompletos continuam desconhecidos",()=>{
  for(const input of [{},{items:{auction:{status:"absence-in-scope"}}},{auction:false},{description:"sem leilão"}]){
    const r=assessVehicleRisk(input);assert.equal(r.bucket,"pending");assert.equal(r.unknown.length,8);
  }
});
test("ocorrência só elimina com fonte, referência, data e escopo",()=>{
  const report={items:{auction:{...evidence,status:"occurrence"}}};
  assert.deepEqual(assessVehicleRisk(report).eliminated,["auction"]);
  assert.equal(evaluateLead({...lead,riskReport:report},{}).bucket,"outside");
  assert.equal(assessVehicleRisk({items:{auction:{...report.items.auction,reference:""}}}).bucket,"pending");
});
test("ausência documentada é limitada ao escopo e às condições efetivamente consultadas",()=>{
  const partial={items:{auction:{...evidence,status:"absence-in-scope"}}};
  assert.equal(assessVehicleRisk(partial).bucket,"pending");
  const all={items:Object.fromEntries(Object.keys(RISK_TYPES).map(k=>[k,{...evidence,status:"absence-in-scope"}]))};
  assert.equal(assessVehicleRisk(all).bucket,"absence-in-scope");
  assert.equal(normalizeRiskReport(all).items.damage.scope,evidence.scope);
});
test("exigência de investigação deixa desconhecidos pendentes sem apagar registros anteriores",()=>{
  assert.equal(evaluateLead(lead,{}).bucket,"compatible");
  assert.equal(evaluateLead(lead,{requireRiskEvidence:true}).bucket,"pending");
});
test("sanitização e exportação preservam riscos, escopo e distância separada",()=>{
  const input={...lead,riskReport:{items:{damage:{...evidence,status:"occurrence"}}},distanceEvidence:{kind:"route",source:"Mapa de teste",checkedAt:evidence.checkedAt}};
  const safe=sanitizeLead(JSON.parse(JSON.stringify(input)));
  assert.equal(safe.riskReport.items.damage.status,"occurrence");assert.equal(safe.distanceEvidence.kind,"route");
  assert.match(csvExport([safe]),/protocolo-fixture/);
  assert.equal(sanitizeLead(lead).riskReport.items.auction.status,"unknown");
});
test("adaptador desconectado não consulta e fornecedor de teste exige finalidade autorizada",async()=>{
  assert.equal((await queryVehicleRisk()).status,"not-configured");let calls=0;
  const adapter={query:async()=>{calls++;return {items:{auction:{...evidence,status:"occurrence"}}};}};
  await assert.rejects(()=>queryVehicleRisk({adapter,vehicle:{plate:"TEST123"}}),{code:"RISK_AUTHORIZATION_REQUIRED"});
  assert.equal(calls,0);
  const result=await queryVehicleRisk({adapter,vehicle:{plate:"TEST123"},authorization:{authorized:true,purpose:"Homologação com fixture"}});
  assert.equal(result.report.items.auction.status,"occurrence");assert.equal(calls,1);assert.equal(JSON.stringify(result).includes("TEST123"),false);
});
test("erros do adaptador não expõem resposta privada",async()=>{
  await assert.rejects(()=>queryVehicleRisk({adapter:{query:async()=>{throw Error("TOKEN_SECRETO")}},vehicle:{plate:"TEST123"},authorization:{authorized:true,purpose:"Teste"}}),error=>error.code==="RISK_PROVIDER_FAILED"&&!error.message.includes("TOKEN_SECRETO"));
});
test("recebe URL em title, text ou url e remove rastreadores",()=>{
  for(const params of [{url:url+"?ref=sharing"},{text:"Confira esta moto "+url},{title:url}])assert.equal(parseSharedListing(params).url,url);
  assert.equal(parseSharedListing({url,text:url}).ok,true);
});
test("compartilhamento rejeita login, redirecionamento, domínio falso, JavaScript e múltiplas motos",()=>{
  for(const value of ["https://www.facebook.com/login", "https://www.facebook.com/share/abc", "https://facebook.com.evil.test/marketplace/item/123456/", "javascript:alert(1)",url+" https://www.facebook.com/marketplace/item/987654321/"]){assert.equal(parseSharedListing({url:value}).ok,false,value);}
});
test("compartilhamento expira na sessão sem gravação de oportunidade",()=>{
  let record=JSON.stringify({url,receivedAt:"2026-11-13T12:00:00Z"});const storage={getItem:key=>key===SHARE_KEY?record:null,removeItem:()=>{record=null;}};
  assert.equal(readPendingShare(storage,Date.parse("2026-11-13T12:30:00Z")).url,url);
  assert.equal(readPendingShare(storage,Date.parse("2026-11-13T14:00:00Z")),null);assert.equal(record,null);
});
test("manifest registra recebimento GET no próprio escopo e receiver não tem escrita no Firebase",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../public/manifest.webmanifest",import.meta.url)));
  assert.equal(manifest.share_target.method,"GET");assert.equal(manifest.share_target.action,"./receber.html");
  const receiver=readFileSync(new URL("../public/receive-share.js",import.meta.url),"utf8");assert.doesNotMatch(receiver,/fetch\(|firebase|saveLead|cookie/);assert.match(receiver,/history\.replaceState/);
});
test("geografia distingue declaração, município, estimativa e rota conferida com fonte",()=>{
  const filters={originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50"};
  const x=describeGeography({...lead,city:"Bady Bassitt",distanceKm:25,distanceVerified:true,distanceEvidence:{kind:"route",source:"Mapa de teste",checkedAt:evidence.checkedAt}},filters);
  assert.equal(x.declared.city,"Bady Bassitt");assert.equal(x.municipality.city,"Bady Bassitt");assert.ok(x.estimated.km>0&&x.estimated.km<25);assert.equal(x.verified.km,25);assert.equal(x.verified.kind,"route");
  const legacy=describeGeography({...lead,distanceKm:12,distanceVerified:true},filters);assert.equal(legacy.verified,null);assert.equal(legacy.legacyDeclaration,true);
  assert.equal(describeGeography({...lead,city:"Cidade inexistente"},filters).municipality,null);
});
test("orçamento por usuário expira, separa usuários e recusa novas chamadas excedentes",()=>{
  const memory=new Map();for(let i=0;i<6;i++)assert.equal(consumeRequestBudget(memory,"u1",{now:100}),true);
  assert.equal(consumeRequestBudget(memory,"u1",{now:101}),false);assert.equal(consumeRequestBudget(memory,"u2",{now:101}),true);assert.equal(consumeRequestBudget(memory,"u1",{now:300101}),true);
});
test("deadline limita espera sem repetição automática",async()=>{
  let calls=0;await assert.rejects(()=>withDeadline(()=>{calls++;return new Promise(()=>{});},5,"FIXTURE_TIMEOUT"),{code:"FIXTURE_TIMEOUT"});assert.equal(calls,1);
});
