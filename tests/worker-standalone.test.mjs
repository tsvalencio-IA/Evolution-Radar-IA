import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import original,{parseFacts as parseOriginal,gradeListing as gradeOriginal} from "../worker/evolution-search-worker.js";
import standalone,{parseFacts as parseStandalone,gradeListing as gradeStandalone} from "../deploy/evolution-radar-search-standalone.js";

const file=readFileSync(new URL("../deploy/evolution-radar-search-standalone.js",import.meta.url),"utf8");
test("Worker de colar na Cloudflare é um módulo independente sem imports de arquivos locais",()=>{
 assert.doesNotMatch(file,/^\s*import\s/m);
 assert.match(file,/const MUNICIPIOS=/);
 assert.match(file,/export default\s*\{/);
 assert.match(file,/2026-11-13\.rc1/);
});
test("Arquivo único mantém exatamente o mesmo health e capacidades do Worker original",async()=>{
 const req=new Request("https://evolution-radar-search.tsvalencio.workers.dev/health");
 const [a,b]=await Promise.all([original.fetch(req,{}),standalone.fetch(req,{})]);
 assert.equal(a.status,200);assert.equal(b.status,200);
 assert.deepEqual(await a.json(),await b.json());
});
test("Arquivo único preserva a classificação geográfica e modelo original",()=>{
 const filters={brand:"Honda",model:"CG 125",version:"Titan",yearType:"model",
   yearFrom:"2022",yearTo:"2024",originCity:"São José do Rio Preto",uf:"SP",radiusKm:"50"};
 const content="Honda CG 125 Titan 2023\nPreço: R$ 10.500\nAno: 2023/2023\nLocalização: Sete Barras - SP";
 const fieldsA=parseOriginal(content,"Honda CG 125 Titan",filters);
 const fieldsB=parseStandalone(content,"Honda CG 125 Titan",filters);
 assert.deepEqual(fieldsB,fieldsA);
 assert.deepEqual(gradeStandalone({title:"Honda CG 125 Titan",fields:fieldsB,extractionStatus:"extracted"},filters),
 gradeOriginal({title:"Honda CG 125 Titan",fields:fieldsA,extractionStatus:"extracted"},filters));
 assert.equal(gradeStandalone({title:"Honda CG 125 Titan",fields:fieldsB,extractionStatus:"extracted"},filters).bucket,"outside");
});
test("Arquivo único mantém a rota de exclusão fechada sem login e sem credenciais",async()=>{
 const request=new Request("https://evolution-radar-search.tsvalencio.workers.dev/admin/delete-user",{
  method:"POST",headers:{Origin:"https://tsvalencio-ia.github.io","Content-Type":"application/json"},
  body:JSON.stringify({uid:"member-1234567890123456",email:"teste@example.test",confirmation:"EXCLUIR"})});
 const result=await standalone.fetch(request,{ALLOWED_UID:"owner",FIREBASE_WEB_API_KEY:"public"});
 assert.equal(result.status,401);
});
