import test from "node:test";
import assert from "node:assert/strict";
import {assessAdvertisedRisks,REPORTED_RISK_REASONS} from "../public/risk-evidence.mjs";
import {gradeListing} from "../worker/evolution-search-worker.js";

test("a ausência de leilão no anúncio NUNCA significa histórico limpo",()=>{
 const risk=assessAdvertisedRisks("Yamaha Factor 125 2012 - ótimo estado");
 assert.equal(risk.auction,"unknown");
 assert.equal(risk.accident,"unknown");
 assert.equal(risk.restriction,"unknown");
});
test("negação declarada por vendedor não é certidão limpa nem motivo para excluir",()=>{
 const risk=assessAdvertisedRisks("Sem passagem por leilão. Sem sinistro. Sem bloqueio judicial.");
 assert.equal(risk.auction,"seller-denied");
 assert.equal(risk.accident,"seller-denied");
 assert.equal(risk.restriction,"seller-denied");
 assert.equal(assessAdvertisedRisks("Sem passagem por leilão").auction,"seller-denied");
});
test("afirmação explícita de passagem por leilão fica separada da negação",()=>{
 const r=assessAdvertisedRisks("Moto com passagem por leilão. Ótimo estado. Sem sinistro.");
 assert.equal(r.auction,"declared-present");
 assert.equal(r.accident,"seller-denied");
 assert.equal(assessAdvertisedRisks("Passagem por leilão: não.").auction,"seller-denied");
 assert.equal(assessAdvertisedRisks("Passagem por leilão: SIM").auction,"declared-present");
 assert.equal(assessAdvertisedRisks("Chassi remarcado; recuperado de furto").chassisRemark,"declared-present");
 assert.equal(assessAdvertisedRisks("Chassi remarcado; recuperado de furto").theftRecovery,"declared-present");
});
test("declaração positiva conhecida exclui preliminarmente com motivo rastreável",()=>{
 const f={brand:"Yamaha",model:"125",version:"Factor",yearType:"model",yearFrom:"2012",yearTo:"2012",
  originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50"};
 const risks=assessAdvertisedRisks("Moto de leilão");
 const result=gradeListing({title:"Yamaha Factor 125 2012",riskDeclarations:risks,
  fields:{},extractionStatus:"extracted"},f);
 assert.equal(result.bucket,"outside");
 assert.ok(result.reasons.includes(REPORTED_RISK_REASONS.auction));
 const without=gradeListing({title:"Yamaha Factor 125 2012",riskDeclarations:assessAdvertisedRisks("Sem leilão"),
  fields:{},extractionStatus:"extracted"},f);
 assert.equal(without.bucket,"pending");
});
