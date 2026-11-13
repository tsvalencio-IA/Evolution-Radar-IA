import {firebaseConfig} from "./firebase-config.js";
import {workspaceConfig} from "./workspace-config.js";
import {searchWorkerUrl} from "./search-config.js";
import {runDiagnostics,diagnosticFilters,formatDiagnosticReport} from "./diagnostics.mjs";
const $=s=>document.querySelector(s),labels={ok:"OK",fail:"FALHA",pending:"PENDENTE",blocked:"BLOQUEADO"};
let latest=null,runtime=null;
try{document.documentElement.dataset.theme=localStorage.getItem("evolution-radar-ia-theme")||"dark";}catch{}
try{
  if(location.hash.length>1){const filters=diagnosticFilters(JSON.parse(decodeURIComponent(location.hash.slice(1))));
    for(const [key,value] of Object.entries(filters)){const field=$("#diagnosticForm").elements.namedItem(key);if(field)field.value=value;}}
}catch{}
function timed(task,ms=15000){
  let timer;return Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=Error("Tempo limite");e.name="AbortError";reject(e);},ms)})]).finally(()=>clearTimeout(timer));
}
async function firebaseRuntime(){
  if(runtime)return runtime;
  const base="https://www.gstatic.com/firebasejs/11.10.0/";
  const [apps,authSDK,dbSDK]=await timed(Promise.all([import(base+"firebase-app.js"),import(base+"firebase-auth.js"),import(base+"firebase-database.js")]));
  const app=apps.getApps().find(x=>x.options.projectId===firebaseConfig.projectId)||apps.initializeApp(firebaseConfig);
  const auth=authSDK.getAuth(app);await timed(auth.authStateReady());
  runtime={auth,db:dbSDK.getDatabase(app),api:dbSDK};return runtime;
}
async function getSession(){
  const {auth}=await firebaseRuntime(),user=auth.currentUser;
  if(!user)return {authenticated:false};
  return {authenticated:true,isOwner:user.uid===workspaceConfig.ownerUid,emailVerified:user.emailVerified===true,
    getIdToken:()=>timed(user.getIdToken())};
}
async function readDatabase(session){
  const {auth,db,api}=await firebaseRuntime(),user=auth.currentUser;
  const rows=[];
  const check=async(id,label,path,query=false)=>{
    try{
      const target=api.ref(db,path),snapshot=await timed(api.get(query?api.query(target,api.orderByKey(),api.limitToFirst(1)):target));
      rows.push({id,label,status:"ok",note:snapshot.exists()?"Leitura autorizada; conteúdo privado omitido.":"Leitura autorizada; caminho sem registros. Isso não é falha de conexão."});
    }catch(error){const denied=/permission.denied/i.test(error?.code||"");rows.push({id,label,status:denied?"blocked":"fail",note:denied?"Leitura negada pelas regras Firebase.":"Leitura não concluída (conexão ou tempo limite).",next:"Conferir a permissão deste usuário para este caminho; não abrir as regras publicamente."});}
  };
  await check("personal-read","Firebase: dados próprios","users/"+user.uid+"/data/schemaVersion");
  if(!session.isOwner)await check("membership-read","Firebase: vínculo da equipe","workspaces/"+workspaceConfig.id+"/members/"+user.uid+"/status");
  await check("shared-read","Firebase: base compartilhada","workspaces/"+workspaceConfig.id+"/leads",true);
  return rows;
}
async function inspectBrowser(){
  const cachesList="caches" in window?(await caches.keys()).filter(x=>x.startsWith("evolution-radar-ia-static-")).slice(0,8):[];
  return {viewportWidth:document.documentElement.clientWidth,contentWidth:document.documentElement.scrollWidth,
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    online:navigator.onLine,serviceWorkerControlled:!!navigator.serviceWorker?.controller,caches:cachesList};
}
async function checkAssets(){
  const files=["app.js","search-engine.mjs","listing-facts.mjs","br-municipios.mjs","team-client.js","diagnostics.mjs"];
  return Promise.all(files.map(async file=>{
    try{const result=await timed(fetch(new URL(file,import.meta.url),{cache:"no-store"}));return {file,status:result.status};}
    catch{return {file,status:0};}
  }));
}
function render(report){
  latest=report;$("#diagnosticChecks").replaceChildren();
  for(const check of report.checks){
    const article=document.createElement("article");article.className="diagnostic-check";
    const title=document.createElement("h3"),badge=document.createElement("span");
    badge.className="diagnostic-status";badge.dataset.status=check.status;badge.textContent=labels[check.status];
    title.append(badge,document.createTextNode(check.label));article.append(title);
    const note=document.createElement("p");note.textContent=check.note;article.append(note);
    if(check.next){const next=document.createElement("p");next.textContent="Próximo ajuste: "+check.next;article.append(next);}
    $("#diagnosticChecks").append(article);
  }
  $("#diagnosticConclusion").textContent=report.conclusion||"Testes em andamento. Aguarde o relatório final.";
  $("#diagnosticStatus").textContent=report.finishedAt?"Diagnóstico concluído":report.checks.length+" verificações registradas";
  $("#evidenceDetails").hidden=!report.evidence;$("#evidenceJson").textContent=report.evidence?JSON.stringify(report.evidence,null,2):"";
}
$("#diagnosticForm").addEventListener("submit",async event=>{
  event.preventDefault();const button=$("#runDiagnostic");button.disabled=true;button.textContent="Investigando...";
  $("#copyDiagnostic").disabled=true;$("#downloadDiagnostic").disabled=true;$("#reportFallback").hidden=true;
  try{
    const filters=diagnosticFilters(Object.fromEntries(new FormData(event.target)));
    filters.uf=filters.uf.toUpperCase();
    await runDiagnostics({filters,workerUrl:searchWorkerUrl,getSession,readDatabase,inspectBrowser,checkAssets,onProgress:render});
    $("#copyDiagnostic").disabled=false;$("#downloadDiagnostic").disabled=false;
  }catch{ $("#diagnosticConclusion").textContent="O diagnóstico foi interrompido. Nenhum registro foi alterado. Os resultados parciais permanecem abaixo."; }
  finally{button.disabled=false;button.textContent="Executar diagnóstico";}
});
$("#copyDiagnostic").addEventListener("click",async()=>{
  const text=formatDiagnosticReport(latest);
  // Deixa o texto acessível também quando o navegador não sincroniza a área de transferência.
  $("#reportFallback").hidden=false;$("#reportText").value=text;
  try{await navigator.clipboard.writeText(text);$("#diagnosticStatus").textContent="Relatório copiado";}
  catch{$("#reportText").focus();$("#reportText").select();$("#diagnosticStatus").textContent="Selecione e copie o relatório abaixo";}
});
$("#downloadDiagnostic").addEventListener("click",()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:"application/json"})),a=document.createElement("a");
  a.href=url;a.download="diagnostico-evolution-radar-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
