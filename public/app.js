import {emptyFilters,numberOrNull,canonicalUrl,sanitizeLead,findDuplicate,evaluateLead,sortLeads,calculateScenario,sourceSearches,money,csvExport} from "./core.mjs";
import {firebaseConfig} from "./firebase-config.js";
import {openFirebase} from "./firebase-client.js";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const LOCAL="evolution-radar-ia-local-v1",THEME="evolution-radar-ia-theme";
const state={filters:{...emptyFilters},leads:[],mode:"local",firebase:null,user:null,remoteReady:false};
const labels={purchase:"compra",resale:"revenda",transport:"transporte",documents:"documentos",repairs:"reparos",labor:"mão de obra",taxes:"taxas",commissions:"comissões",other:"outros custos"};
let toastTimer,saveQueue=Promise.resolve();
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function notice(message){const t=$("#toast");t.textContent=message;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,6500);}
function localRead(){try{const a=JSON.parse(localStorage.getItem(LOCAL)||"{}");const leads=Array.isArray(a.leads)?a.leads.map(sanitizeLead).filter(Boolean):[];return {filters:{...emptyFilters,...a.filters},leads};}catch{return {filters:{...emptyFilters},leads:[]};}}
function localSave(){try{localStorage.setItem(LOCAL,JSON.stringify({schemaVersion:1,filters:state.filters,leads:state.leads}));}catch{notice("Não foi possível gravar localmente. Exporte um backup antes de sair.");}}
function setStatus(){const remote=state.mode==="remote",busy=state.mode==="loading";$("#dataStatus").textContent=remote?"Firebase conectado":busy?"Sincronizando...":"Dados locais";$("#storageDescription").textContent=remote?"Conectado ao Firebase: dados deste usuário armazenados no Realtime Database.":busy?"Carregando dados da conta Firebase; aguarde antes de editar.":"Dados guardados somente neste navegador. Sem sincronização com outros dispositivos. Use backup JSON regularmente.";$("#loginForm").hidden=!state.firebase||!!state.user;$("#logoutButton").hidden=!state.user;$("#firebaseStatus").textContent=state.firebase?(state.user?"Autenticado: "+state.user.email:"Firebase configurado. Faça login para consultar seus registros privados."):"Firebase não configurado. Edite public/firebase-config.js e habilite Authentication e Realtime Database; veja o README.";}
async function persist(){
  if(state.mode==="loading"){notice("Aguarde a leitura inicial dos dados remotos.");return;}
  if(state.mode!=="remote"){localSave();return;}
  const payload={schemaVersion:1,filters:state.filters,leads:state.leads,updatedAt:new Date().toISOString()};
  saveQueue=saveQueue.catch(()=>{}).then(()=>state.firebase.save(payload));
  try{await saveQueue;}catch(e){notice("Falha ao gravar no Firebase. Exporte backup JSON. "+(e?.message||""));}
}
function switchView(name){$$(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+name));$$("[data-view]").forEach(x=>{x.classList.toggle("active",x.dataset.view===name);x.setAttribute("aria-current",x.dataset.view===name?"page":"false")});location.hash=name;}
function setForm(form,obj){for(const [k,v] of Object.entries(obj)){const el=form.elements.namedItem(k);if(!el)continue;if(el.type==="checkbox")el.checked=v===true;else el.value=v===null||v===undefined?"":String(v);}}
function readFilters(){const f=Object.fromEntries(new FormData($("#filterForm")).entries());f.uf=String(f.uf||"").trim().toUpperCase();return {...emptyFilters,...f};}
function validFilters(f){
  const from=numberOrNull(f.yearFrom),to=numberOrNull(f.yearTo);
  if(from!==null&&to!==null&&from>to){notice("Ano inicial não pode ser maior que ano final.");return false;}
  if(f.radiusKm!==""&&(!f.originCity||!f.uf)){notice("Para usar raio, informe cidade de origem e UF.");return false;}
  return true;
}
function updateSearch(){
  const f=state.filters;const panel=$("#searchLinks");const links=sourceSearches(f);
  panel.hidden=false;
  panel.innerHTML='<div class="section-title"><h2>Abrir fontes externas</h2><span>Consultas, não anúncios individuais</span></div><p class="micro">Estas buscas abrem páginas externas; verifique cada anúncio e registre apenas informações comprovadas.</p><div class="source-links">'+links.map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.name)+' ↗</a>').join("")+'</div><p class="micro">Filtros de preço, KM e raio devem ser conferidos na fonte e novamente nos registros. O mecanismo de busca externo pode não aplicá-los.</p>';
}
function summarize(){const out={compatible:[],pending:[],outside:[]};for(const l of sortLeads(state.leads,state.filters.order)){const r=evaluateLead(l,state.filters);out[r.bucket].push({...l,assessment:r});}return out;}
function renderCounts(groups){$("#statConfirmed").textContent=groups.compatible.length;$("#statPending").textContent=groups.pending.length;$("#statOutside").textContent=groups.outside.length;}
function card(x,bucket){
  const url=canonicalUrl(x.url);
  const year=x.yearMake||x.yearModel?(x.yearMake??"?")+"/"+(x.yearModel??"?"):"Não informado";
  const meta=[["Ano",year],["KM",x.km==null?"Não informado":Number(x.km).toLocaleString("pt-BR")],["Cidade",(x.city||"Não informada")+(x.uf?"/"+x.uf:"")],["Fonte",x.source||"Não informada"],["Evidência",x.evidence==="page"?"Marcada como conferida":x.evidence==="provided"?"Link não conferido":"Índice/listagem"],["Consulta",x.observedAt||"Não informada"]];
  return '<article class="lead-card"><div class="card-top"><h3 class="card-title">'+esc([x.brand,x.model,x.version].filter(Boolean).join(" "))+'</h3><span class="chip '+(bucket==="compatible"?"confirmed":bucket)+'">'+(bucket==="compatible"?"Marcada como conferida":bucket==="pending"?"Pendente":"Fora do filtro")+'</span></div><div class="card-price">'+esc(money(x.price))+'</div><div class="card-meta">'+meta.map(([a,b])=>'<span>'+esc(a)+': <b>'+esc(b)+'</b></span>').join("")+'</div><p class="card-reason">'+esc(x.assessment.reasons.join(" · "))+'</p>'+(x.notes?'<p class="card-note">'+esc(x.notes)+'</p>':"")+'<div class="card-actions">'+(url?'<a class="btn secondary small" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">Abrir fonte ↗</a>':'<span class="chip">Sem link individual</span>')+'<button class="btn small" data-action="edit" data-id="'+esc(x.id)+'">Editar</button><button class="btn small" data-action="delete" data-id="'+esc(x.id)+'">Excluir</button></div></article>';
}
function renderLeads(groups){
  const info=[["compatible","Marcadas como conferidas"],["pending","Oportunidades pendentes"],["outside","Fora dos critérios"]];
  $("#leadGroups").innerHTML=info.map(([key,title])=>'<section><div class="group-head"><h2>'+title+'</h2><span>'+groups[key].length+'</span></div>'+(groups[key].length?'<div class="cards">'+groups[key].map(x=>card(x,key)).join("")+'</div>':'<div class="empty-state">Nenhum registro nesta categoria. Isso não significa ausência de motos na internet.</div>')+'</section>').join("");
}
function renderFinanceOptions(){
  const el=$("#financeLead"),prev=el.value;
  el.innerHTML='<option value="">Sem anúncio selecionado</option>'+state.leads.map(x=>'<option value="'+esc(x.id)+'">'+esc([x.brand,x.model,x.version,x.yearModel||"",money(x.price)].filter(Boolean).join(" · "))+'</option>').join("");
  if(state.leads.some(x=>x.id===prev))el.value=prev;
}
function renderAll(){const groups=summarize();renderCounts(groups);renderLeads(groups);renderFinanceOptions();setStatus();}
function openLead(id){
  const form=$("#leadForm");form.reset();
  const x=state.leads.find(y=>y.id===id);
  if(x){setForm(form,x);$("#leadDialogTitle").textContent="Editar evidência";}else{$("#leadDialogTitle").textContent="Registrar anúncio ou lead";setForm(form,{...state.filters,id:"",url:"",source:"",evidence:"index",price:"",km:"",city:state.filters.originCity,yearMake:"",yearModel:"",distanceKm:"",distanceVerified:false,notes:""});}
  $("#leadDialog").showModal();
}
function readLead(){
  const form=$("#leadForm"),d=Object.fromEntries(new FormData(form).entries()),old=state.leads.find(x=>x.id===d.id);
  for(const k of ["price","km","yearMake","yearModel","distanceKm"])d[k]=numberOrNull(d[k]);
  d.id=old?.id||crypto.randomUUID();
  d.distanceVerified=form.elements.namedItem("distanceVerified").checked;
  d.uf=String(d.uf||"").trim().toUpperCase();
  d.createdAt=old?.createdAt||new Date().toISOString();
  d.updatedAt=new Date().toISOString();
  d.observedAt=new Date().toISOString().slice(0,10);
  return sanitizeLead(d);
}
async function storeLead(e){
  e.preventDefault();
  if(state.mode==="loading")return notice("Aguarde a sincronização.");
  const l=readLead();if(!l)return notice("Registro inválido. Confira valores e URL.");
  if(l.evidence==="page"&&!l.url)return notice("Para marcar página declarada conferida, informe seu link individual.");
  const dupe=findDuplicate(l,state.leads);
  if(dupe?.type==="same-url")return notice("Esse link já existe no histórico. Edite o registro existente.");
  if(dupe?.type==="possible-same-bike"&&!confirm("Possível duplicidade: preço, KM, ano e cidade iguais. Registrar mesmo assim?"))return;
  const idx=state.leads.findIndex(x=>x.id===l.id);
  if(idx>=0)state.leads[idx]=l;else state.leads.unshift(l);
  $("#leadDialog").close();await persist();renderAll();switchView("oportunidades");notice("Registro salvo. Disponibilidade e documentação ainda não comprovadas.");
}
async function removeLead(id){
  if(state.mode==="loading")return notice("Aguarde a sincronização.");
  if(!confirm("Excluir este registro? Faça backup se desejar preservar o histórico."))return;
  state.leads=state.leads.filter(x=>x.id!==id);await persist();renderAll();notice("Registro excluído.");
}
function download(name,content,mime){
  const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function backupJson(){download("evolution-radar-ia-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),leads:state.leads,filters:state.filters},null,2),"application/json");}
async function importJson(e){
  if(state.mode==="loading"){notice("Aguarde sincronizar.");return;}
  const file=e.target.files?.[0];e.target.value="";if(!file)return;
  if(file.size>4_000_000)return notice("Backup muito grande (limite 4 MB).");
  try{
    const data=JSON.parse(await file.text());
    if(data.schemaVersion!==1||!Array.isArray(data.leads)||data.leads.length>5000)throw Error("Formato de backup não reconhecido.");
    const imported=data.leads.map(sanitizeLead).filter(Boolean);
    if(!confirm("Importar "+imported.length+" registros válidos, sem apagar os existentes?"))return;
    let added=0;
    for(const lead of imported){if(state.leads.some(x=>x.id===lead.id)||findDuplicate(lead,state.leads)?.type==="same-url")continue;state.leads.push(lead);added++;}
    await persist();renderAll();notice(added+" registro(s) importado(s). Registros existentes preservados.");
  }catch(err){notice("Não foi possível importar: "+(err.message||"arquivo inválido"));}
}
function calculate(e){
  e.preventDefault();const vals=Object.fromEntries(new FormData($("#financeForm")).entries());const r=calculateScenario(vals),out=$("#financeResult");
  if(r.error){out.textContent=r.error;return;}
  if(!r.valid){out.textContent="Cenário incompleto. Campos pendentes: "+r.missing.map(k=>labels[k]||k).join(", ")+". Total parcial conhecido: "+money(r.partialCost)+". Não é lucro.";return;}
  out.innerHTML='<strong>Custo total estimado:</strong> '+esc(money(r.totalCost))+'<br><strong>Resultado estimado antes de outras despesas não identificadas:</strong><br><span class="amount">'+esc(money(r.outcome))+'</span><br><strong>Margem sobre a revenda:</strong> '+r.marginPercent.toFixed(2)+'% · <strong>Retorno sobre custo:</strong> '+(r.returnPercent===null?"Não calculável":r.returnPercent.toFixed(2)+"%")+'<p class="micro">Cenário matemático, não garantia de preço final, venda ou lucro líquido. Confirme despesas, riscos, impostos e comparáveis.</p>';
}
function theme(){const current=document.documentElement.dataset.theme||"dark",next=current==="dark"?"light":"dark";document.documentElement.dataset.theme=next;localStorage.setItem(THEME,next);}
function bind(){
  $$("[data-view]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
  $("#themeToggle").addEventListener("click",theme);
  $("#filterForm").addEventListener("submit",async e=>{e.preventDefault();const f=readFilters();if(!validFilters(f))return;state.filters=f;await persist();renderAll();notice("Filtros aplicados ao histórico salvo.");});
  $("#generateSearch").addEventListener("click",async()=>{const f=readFilters();if(!validFilters(f))return;state.filters=f;await persist();renderAll();updateSearch();$("#searchLinks").scrollIntoView({behavior:"smooth",block:"start"});});
  $("#resetFilters").addEventListener("click",async()=>{state.filters={...emptyFilters};setForm($("#filterForm"),state.filters);$("#searchLinks").hidden=true;await persist();renderAll();});
  ["openLead","addLead"].forEach(id=>$("#"+id).addEventListener("click",()=>openLead(null)));
  $("#closeLead").addEventListener("click",()=>$("#leadDialog").close());
  $("#cancelLead").addEventListener("click",()=>$("#leadDialog").close());
  $("#leadForm").addEventListener("submit",storeLead);
  $("#leadGroups").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;if(b.dataset.action==="edit")openLead(b.dataset.id);if(b.dataset.action==="delete")removeLead(b.dataset.id);});
  $("#financeLead").addEventListener("change",e=>{const l=state.leads.find(x=>x.id===e.target.value);if(l&&l.price!=null)$("#financeForm").elements.namedItem("purchase").value=String(l.price);});
  $("#financeForm").addEventListener("submit",calculate);
  $("#exportJson").addEventListener("click",backupJson);
  $("#exportCsv").addEventListener("click",()=>download("evolution-radar-ia-"+new Date().toISOString().slice(0,10)+".csv",csvExport(state.leads),"text/csv;charset=utf-8"));
  $("#importJson").addEventListener("change",importJson);
  $("#loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!state.firebase)return;const f=new FormData(e.target);try{await state.firebase.login(String(f.get("email")),String(f.get("password")));e.target.elements.namedItem("password").value="";notice("Autenticação realizada. Carregando dados privados.");}catch(err){notice("Login não realizado: "+err.message);}});
  $("#logoutButton").addEventListener("click",async()=>{if(!state.firebase)return;try{await state.firebase.logout();notice("Sessão encerrada.");}catch(err){notice(err.message);}});
}
async function boot(){
  const local=localRead();state.filters=local.filters;state.leads=local.leads;
  try{document.documentElement.dataset.theme=localStorage.getItem(THEME)==="light"?"light":"dark";}catch{}
  setForm($("#filterForm"),state.filters);bind();renderAll();
  const configured=!!firebaseConfig?.apiKey&&!!firebaseConfig?.projectId&&!!firebaseConfig?.databaseURL;
  if(configured){
    try{
      state.firebase=await openFirebase(firebaseConfig,{
        onAuth:user=>{state.user=user;if(user){state.mode="loading";state.remoteReady=false;}else{const l=localRead();state.leads=l.leads;state.filters=l.filters;setForm($("#filterForm"),state.filters);state.mode="local";state.remoteReady=false;}renderAll();},
        onData:data=>{const raw=data?.leads;const leads=Array.isArray(raw)?raw:(raw&&typeof raw==="object"?Object.values(raw):[]);state.leads=leads.map(sanitizeLead).filter(Boolean);state.filters={...emptyFilters,...(data?.filters||{})};setForm($("#filterForm"),state.filters);state.mode="remote";state.remoteReady=true;renderAll();},
        onError:err=>{notice("Erro Firebase: "+err.message);state.mode="loading";renderAll();}
      });renderAll();
    }catch(err){notice("Firebase indisponível: "+err.message);state.firebase=null;state.mode="local";renderAll();}
  }
  if("serviceWorker" in navigator && location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
  const hash=location.hash.slice(1);if(["pesquisa","oportunidades","analise","config"].includes(hash))switchView(hash);
}
boot();
