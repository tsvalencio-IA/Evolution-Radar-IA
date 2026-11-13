import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runDiagnostics,inspectSearchEvidence,formatDiagnosticReport} from "../public/diagnostics.mjs";
const filters={brand:"Yamaha",model:"Factor 125",yearType:"model",yearFrom:"2012",yearTo:"2012",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50"};
const privateToken="private-token-never-export-"+"x".repeat(130);
const url="https://sp.olx.com.br/regiao-de-sao-jose-do-rio-preto/autos-e-pecas/motos/yamaha-factor-1550857572";
const candidate={url,title:"Yamaha Factor 125 2012",extractionStatus:"extracted",fields:{brand:"Yamaha",model:"Factor 125",yearModel:2012,price:8900,km:10000,city:"Bady Bassitt",uf:"SP"},assessment:{bucket:"prequalified"}};
const health={service:"Evolution Radar IA",status:"online",version:"2026-11-12.5",aiBinding:"connected",accountDeletionConfigured:false};
const base={filters,workerUrl:"https://worker.test",getSession:async()=>({authenticated:true,isOwner:true,emailVerified:true,getIdToken:async()=>privateToken})};
const responses=(extra={})=>({health,interpret:{mode:"workers-ai",filters:{brand:"Yamaha",model:"Factor 125"},cache:false},search:{source:"Tavily",cache:false,checkedAt:new Date().toISOString(),coverage:{queriesAttempted:3,queriesSucceeded:3,extractionSucceeded:1,extractionFailures:0},items:[candidate]},...extra});
const transport=(data,calls=[])=>async(input,options)=>{const path=new URL(input).pathname.slice(1);calls.push({path,options});return Response.json(data[path],{status:data[path]?.errorStatus||200});};

test("diagnóstico executa IA e busca reais separadamente; não chama rotas de escrita nem exporta token",async()=>{
  const calls=[];const report=await runDiagnostics({...base,fetchImpl:transport(responses(),calls),readDatabase:async()=>[{id:"shared",label:"Base",status:"ok",note:"Leitura autorizada"}]});
  assert.deepEqual(calls.map(x=>x.path),["health","interpret","search"]);
  assert.equal(calls[0].options.method,"GET");assert.equal(calls[1].options.headers.Authorization,"Bearer "+privateToken);
  assert.equal(report.checks.find(x=>x.id==="inference").status,"ok");
  assert.equal(report.checks.find(x=>x.id==="availability").status,"pending");
  assert.equal(report.checks.find(x=>x.id==="writes").status,"pending");
  assert.equal(report.checks.find(x=>x.id==="account-deletion").status,"pending");
  assert.ok(report.summary.pending>0);assert.doesNotMatch(report.conclusion,/pronto/i);
  assert.equal(JSON.stringify(report).includes(privateToken),false);assert.equal(formatDiagnosticReport(report).includes(privateToken),false);
});
test("sem sessão não chama IA nem busca protegida e não pede senha no relatório",async()=>{
  const calls=[];const report=await runDiagnostics({...base,getSession:async()=>({authenticated:false}),fetchImpl:transport(responses(),calls)});
  assert.deepEqual(calls.map(x=>x.path),["health"]);
  assert.equal(report.checks.find(x=>x.id==="session").status,"blocked");
  assert.equal(report.checks.find(x=>x.id==="search").status,"pending");
});
test("health online e binding conectado não mascaram IA com falha nem resposta vazia da pesquisa",async()=>{
  const report=await runDiagnostics({...base,fetchImpl:transport(responses({interpret:{errorStatus:502,code:"AI_EMPTY_RESPONSE"},search:{items:[]}}))});
  assert.equal(report.checks.find(x=>x.id==="ai-binding").status,"ok");
  assert.equal(report.checks.find(x=>x.id==="inference").status,"fail");
  assert.equal(report.checks.find(x=>x.id==="qualified").status,"pending");
  assert.ok(report.summary.fail>0);
});
test("cache e data antiga não são nova inferência nem nova coleta comprovada",async()=>{
  const data=responses();data.interpret.cache=true;data.search.cache=true;data.search.checkedAt="2026-11-11T23:53:00Z";
  const report=await runDiagnostics({...base,fetchImpl:transport(data),now:()=>Date.parse("2026-11-13T11:00:00Z")});
  for(const id of ["inference","search-provider","freshness"])assert.equal(report.checks.find(x=>x.id===id).status,"pending");
});
test("anúncio somente indexado e campos ausentes não viram oportunidade comprovada",()=>{
  const evidence=inspectSearchEvidence({items:[{...candidate,title:"Factor 125i ED 2015",fields:{},extractionStatus:"failed",assessment:{bucket:"pending"}}]},filters);
  assert.equal(evidence.compatible,0);assert.equal(evidence.incomplete,1);
  assert.equal(evidence.listings[0].pageAvailability,"not-verified");
  assert.deepEqual(evidence.listings[0].titleYears,["2015"]);
  assert.deepEqual(evidence.listings[0].missing,["price","km","yearModel","city","uf"]);
});
test("indisponibilidade explicitamente informada é falha; não qualifica campos de recomendações",async()=>{
  const data=responses();data.search.items=[{...candidate,url:candidate.url+"?utm_source=test",pageStatus:"unavailable"}];
  const report=await runDiagnostics({...base,fetchImpl:transport(data)});
  assert.equal(report.evidence.unavailable,1);assert.equal(report.evidence.compatible,0);
  assert.equal(report.evidence.listings[0].category,"excluded");
  assert.equal(report.checks.find(x=>x.id==="availability").status,"fail");
});
test("HTTP 200 com conteúdo inesperado não confirma health nem pesquisa",async()=>{
  const report=await runDiagnostics({...base,fetchImpl:transport(responses({health:{html:"pagina"},search:{anything:true}}))});
  assert.equal(report.checks.find(x=>x.id==="health").status,"fail");
  assert.equal(report.checks.find(x=>x.id==="search").status,"fail");
});
test("erros arbitrários não vazam mensagens privadas no relatório",async()=>{
  const report=await runDiagnostics({...base,getSession:async()=>{throw Error(privateToken+" private@example.test");},fetchImpl:transport(responses())});
  assert.equal(JSON.stringify(report).includes(privateToken),false);assert.equal(JSON.stringify(report).includes("private@example.test"),false);
});
test("tela e transportes do diagnóstico não incluem APIs de escrita, aprovação ou exclusão",()=>{
  const ui=readFileSync(new URL("../public/diagnostics-ui.js",import.meta.url),"utf8");
  assert.doesNotMatch(ui,/api\.(?:set|update|push|remove)\(/);
  const html=readFileSync(new URL("../public/diagnostico.html",import.meta.url),"utf8");
  assert.match(html,/Executar diagnóstico/);assert.match(html,/Copiar relatório/);
  assert.doesNotMatch(html,/type="password"/);
});

test("diagnóstico informa códigos sanitizados sem revelar erros brutos de terceiros",()=>{
 const failing={...candidate,extractionStatus:"failed",extractionFailureCode:"EXTRACT_ACCESS_REPORTED",
  fields:{price:null,km:null,yearMake:null,yearModel:null,city:null,uf:null},assessment:{bucket:"pending"}};
 const info=inspectSearchEvidence({source:"Tavily",items:[failing],coverage:{
  extractionAttempted:1,extractionSucceeded:0,extractionFailures:1,
  extractionFailureReasons:{EXTRACT_ACCESS_REPORTED:1,INVALID_MESSAGE:"segredo"}
 }},filters);
 assert.equal(info.listings[0].extractionFailureCode,"EXTRACT_ACCESS_REPORTED");
 assert.deepEqual(info.extractionFailureReasons,{EXTRACT_ACCESS_REPORTED:1});
 assert.equal(info.compatible,0);
});
