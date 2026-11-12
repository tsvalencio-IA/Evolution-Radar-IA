import {emptyFilters,numberOrNull,canonicalUrl,sanitizeLead,findDuplicate,evaluateLead,sortLeads,calculateScenario,sourceSearches,money,csvExport} from "./core.mjs";
import {firebaseConfig} from "./firebase-config.js";
import {searchWorkerUrl} from "./search-config.js";
import {searchQuery,normalizeWebLeads} from "./search-engine.mjs";
import {openFirebase} from "./firebase-client.js";
import {parseLocalIntent,mergeIntentFilters} from "./local-intent.mjs";
import {openTeam} from "./team-client.js";
import {DEFAULT_PERMISSIONS,PERMISSION_NAMES} from "./team-roles.mjs";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const LOCAL="evolution-radar-ia-local-v1",THEME="evolution-radar-ia-theme";
const state={filters:{...emptyFilters},leads:[],history:[],mode:"local",firebase:null,user:null,remoteReady:false,team:null,teamInfo:null,sharedLeads:[],sharedHistory:[],requests:[],members:[],audit:[]};
const labels={purchase:"compra",resale:"revenda",transport:"transporte",documents:"documentos",repairs:"reparos",labor:"mão de obra",taxes:"taxas",commissions:"comissões",other:"outros custos"};
let toastTimer,saveQueue=Promise.resolve(),latestDiscovered=[],lastDiscoveryFilters=null;
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function notice(message){const t=$("#toast");t.textContent=message;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,6500);}
function isOwner(){return !!state.teamInfo?.isOwner}
function isApproved(){return state.teamInfo?.status==="approved"}
function canUse(action){return !!state.user&&isApproved()&&state.teamInfo?.permissions?.[action]===true}
function allLeads(){
  if(!state.user)return state.leads;
  if(!isApproved())return [];
  const data=new Map();
  if(isOwner())for(const x of state.leads)data.set(x.id,{...x,_shared:false});
  for(const raw of state.sharedLeads){if(raw.archived===true){data.delete(raw.id);continue;}const x=sanitizeLead(raw);if(x)data.set(x.id,{...x,_shared:true});}
  return [...data.values()];
}
function allHistory(){
  if(!isApproved())return [];
  return [...(isOwner()?state.history:[]),...state.sharedHistory]
    .sort((a,b)=>new Date(b.createdAt||b.checkedAt||0)-new Date(a.createdAt||a.checkedAt||0)).slice(0,50);
}
function permissionsEditor(perms,uid){
  return '<div class="team-permissions">'+PERMISSION_NAMES.map(p=>
    '<label><input type="checkbox" data-perm="'+p+'" '+(perms?.[p]===true?'checked':'')+'> '+
    esc({view:"Visualizar",search:"Pesquisar",create:"Cadastrar",edit:"Editar",delete:"Arquivar"}[p])+'</label>').join("")+'</div>';
}
function renderTeamPanel(){
  const auth=!!state.user,owner=isOwner(),info=state.teamInfo;
  $("#signupForm").hidden=auth||!state.firebase;
  $("#requestApprovalForm").hidden=!auth||owner||!!info?.request||info?.status==="approved"||info?.status==="suspended"||info?.status==="revoked";
  $("#verificationActions").hidden=!auth||owner||info?.emailVerified!==false;
  $("#adminNav").hidden=!owner;
  const warning=$("#accessNotice"),status=$("#accountStatus");
  const pending=auth&&!isApproved();
  const msg=!auth?"":info?.status==="checking"?"Verificando autorização do padrinho...":
    info?.status==="email-unverified"||(!owner&&info?.emailVerified===false)?"Confirme seu e-mail pelo link recebido. Depois clique em Já confirmei meu e-mail. A aprovação do padrinho também é obrigatória.":
    info?.status==="suspended"?"Sua conta está suspensa. Entre em contato com o padrinho.":
    info?.status==="revoked"||info?.request?.status==="revoked"?"Seu acesso foi revogado pelo padrinho.":
    info?.request?.status==="rejected"?"Sua solicitação foi recusada pelo padrinho.":
    info?.status==="pending"?"Seu cadastro está aguardando aprovação do padrinho. Nenhuma pesquisa ou base compartilhada está liberada.":"";
  warning.hidden=!pending;warning.textContent=msg;
  status.hidden=!pending;status.textContent=msg;
  $$("[data-view]").forEach(b=>{if(b.id!=="adminNav"&&b.dataset.view!=="config")b.hidden=pending;});
  if(pending&&!$("#view-config").classList.contains("active"))switchView("config");
  $("#teamSetupStatus").textContent=owner?
    "O controle de acesso depende das regras do Firebase publicadas. Cadastro, aprovação e revogação são aplicados imediatamente quando a sincronização está ativa.":
    "Área exclusiva do padrinho.";
  if(!owner)return;
  const waiting=state.requests.filter(r=>r.status==="pending");
  $("#adminRequests").innerHTML=waiting.length?waiting.map(r=>
    '<article class="team-entry"><h3>'+esc(r.name||"Nome não informado")+'</h3>'+
    '<div class="meta">E-mail: '+esc(r.email||"")+' · Solicitação: '+
      esc(r.createdAt?new Date(r.createdAt).toLocaleString("pt-BR"):"Data não informada")+'</div>'+
    '<div class="actions"><button class="btn primary small" data-uid="'+esc(r.id)+'" data-team-action="approve">Aprovar com permissões iniciais</button>'+
    '<button class="btn secondary small" data-uid="'+esc(r.id)+'" data-team-action="reject">Recusar</button></div></article>').join(""):
    '<p class="micro">Não há solicitações pendentes.</p>';
  $("#adminMembers").innerHTML=state.members.length?state.members.map(m=>
    '<article class="team-entry" data-member="'+esc(m.id)+'"><h3>'+esc(m.name||"Colaborador")+'</h3>'+
    '<div class="meta">'+esc(m.email||"")+' · Estado: '+esc(m.status||"")+'</div>'+
    permissionsEditor(m.permissions,m.id)+
    '<div class="actions"><button class="btn secondary small" data-uid="'+esc(m.id)+'" data-team-action="permissions">Salvar permissões</button>'+
    '<button class="btn secondary small" data-uid="'+esc(m.id)+'" data-team-action="rename">Editar nome</button>'+
    (m.status==="approved"?'<button class="btn small" data-uid="'+esc(m.id)+'" data-team-action="suspend">Suspender</button>':
      '<button class="btn small" data-uid="'+esc(m.id)+'" data-team-action="activate">Reativar</button>')+
    '<button class="btn small" data-uid="'+esc(m.id)+'" data-team-action="revoke">Revogar acesso</button></div></article>').join(""):
    '<p class="micro">Nenhum colaborador aprovado.</p>';
  $("#adminAudit").innerHTML=state.audit.length?state.audit.slice(0,30).map(x=>
    '<div class="team-entry"><span class="meta">'+
    esc(x.at?new Date(x.at).toLocaleString("pt-BR"):"Data não informada")+' · '+
    esc({approve:"Aprovou",reject:"Recusou",suspend:"Suspendeu",activate:"Reativou",
      permissions:"Alterou permissões de",rename:"Renomeou",revoke:"Revogou"}[x.action]||x.action||"Ação")+
    ' colaborador '+esc(x.targetUid||"")+'</span></div>').join(""):
    '<p class="micro">Nenhuma decisão registrada nesta base.</p>';
}
function localRead(){try{const a=JSON.parse(localStorage.getItem(LOCAL)||"{}");const leads=Array.isArray(a.leads)?a.leads.map(sanitizeLead).filter(Boolean):[];return {filters:{...emptyFilters,...a.filters},leads};}catch{return {filters:{...emptyFilters},leads:[]};}}
function localSave(){try{localStorage.setItem(LOCAL,JSON.stringify({schemaVersion:1,filters:state.filters,leads:state.leads}));}catch{notice("Não foi possível gravar localmente. Exporte um backup antes de sair.");}}
function setStatus(){const remote=state.mode==="remote",busy=state.mode==="loading";$("#dataStatus").textContent=state.user&&!isApproved()?"Aguardando autorização":remote?"Firebase conectado":busy?"Sincronizando...":"Dados locais";$("#storageDescription").textContent=remote?"Conectado ao Firebase: dados deste usuário armazenados no Realtime Database.":busy?"Carregando dados da conta Firebase; aguarde antes de editar.":"Dados guardados somente neste navegador. Sem sincronização com outros dispositivos. Use backup JSON regularmente.";$("#loginForm").hidden=!state.firebase||!!state.user;$("#logoutButton").hidden=!state.user;$("#firebaseStatus").textContent=state.firebase?(state.user?"Autenticado: "+state.user.email:"Firebase configurado. Faça login para consultar seus registros privados."):"Firebase não configurado. Edite public/firebase-config.js e habilite Authentication e Realtime Database; veja o README.";}
async function persist(){
  if(state.mode==="loading"){notice("Aguarde a leitura inicial dos dados remotos.");return;}
  if(state.mode!=="remote"){localSave();return;}
  const payload={schemaVersion:1,filters:state.filters,leads:state.leads,updatedAt:new Date().toISOString()};
  saveQueue=saveQueue.catch(()=>{}).then(()=>state.firebase.save(payload));
  try{await saveQueue;}catch(e){notice("Falha ao gravar no Firebase. Exporte backup JSON. "+(e?.message||""));}
}
function switchView(name){if(name==="admin"&&!isOwner())name="config";$$(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+name));$$("[data-view]").forEach(x=>{x.classList.toggle("active",x.dataset.view===name);x.setAttribute("aria-current",x.dataset.view===name?"page":"false")});location.hash=name;}
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
function displayDiscovery(items,metadata){
  latestDiscovered=items;
  const panel=$("#automaticResults"),coverage=metadata.coverage||{};
  const types=[
    {key:"prequalified",title:"Compatibilidade preliminar",explain:"Dados extraídos indicam os critérios, mas ainda não comprovam anúncio ativo, documentação ou vendedor."},
    {key:"pending",title:"Anúncios com verificação pendente",explain:"Algum critério não pôde ser comprovado na página individual."},
    {key:"outside",title:"Anúncios com incompatibilidade identificada",explain:"Algum dado observado contraria os filtros solicitados."},
    {key:"catalog",title:"Catálogos e páginas gerais",explain:"São páginas de busca, não motos individuais. Não entram na contagem de oportunidades."}
  ];
  const groups=Object.fromEntries(types.map(x=>[x.key,[]]));
  for(const item of items){
    const bucket=item.pageType==="catalog"?"catalog":item.assessment?.bucket||"pending";
    (groups[bucket]||groups.pending).push(item);
  }
  const header='<p class="micro"><strong>Busca rastreável · '+items.length+' página(s) indexada(s)</strong>. '+
    esc(metadata.source||"Buscador")+' · '+esc(metadata.checkedAt||"Sem data de consulta")+
    '. Nenhuma oferta está aprovada para compra.</p>'+
    '<div class="notice"><strong>Cobertura declarada:</strong> '+
    esc(coverage.queriesSucceeded??"?")+' de '+esc(coverage.queriesAttempted??"?")+
    ' consultas externas; '+esc(coverage.individualLinks??groups.prequalified.length+groups.pending.length+groups.outside.length)+
    ' links de anúncios; '+esc(coverage.extractionSucceeded??0)+' extrações realizadas. '+
    'O raio rodoviário e a disponibilidade não foram verificados automaticamente.</div>';
  const card=(x)=>{
    const f=x.fields||{},badge=x.pageType==="catalog"?"Catálogo":x.assessment?.bucket==="prequalified"?"Pré-qualificado":x.assessment?.bucket==="outside"?"Fora dos filtros":"Pendente";
    const info=x.pageType==="catalog"?"Página de listagem":x.extractionStatus==="extracted"?"Dados extraídos da página (não confirmados pelo vendedor)":"Página individual não extraída";
    const fields=x.extractionStatus==="extracted"?'<div class="card-meta">'+
      '<span>Preço: <b>'+esc(money(f.price))+'</b></span>'+
      '<span>KM: <b>'+esc(f.km===null?"Não comprovada":Number(f.km).toLocaleString("pt-BR"))+'</b></span>'+
      '<span>Ano: <b>'+esc(f.yearMake===null&&f.yearModel===null?"Não comprovado":(f.yearMake??"?")+"/"+(f.yearModel??"?"))+'</b></span>'+
      '<span>Cidade: <b>'+esc(f.city||"Não comprovada")+'</b></span></div>':'';
    const reasons=x.assessment?.reasons?.length?'<p class="card-reason">'+esc(x.assessment.reasons.join(" · "))+'</p>':'';
    const canRegister=x.pageType==="individual-candidate"&&x.assessment?.bucket!=="outside";
    return '<article class="lead-card"><div class="card-top"><h3 class="card-title">'+esc(x.title)+'</h3><span class="chip '+(x.assessment?.bucket==="outside"?"outside":"pending")+'">'+esc(badge)+'</span></div>'+
      '<p class="micro">'+esc(x.source)+' · '+esc(info)+'</p>'+fields+
      '<p class="card-note">'+esc(String(x.snippet||"Sem resumo disponível").slice(0,x.pageType==="catalog"?210:450))+'</p>'+reasons+
      '<div class="card-actions"><a class="btn secondary small" target="_blank" rel="noopener noreferrer" href="'+esc(x.url)+'">Ver fonte original ↗</a>'+
      (canRegister?'<button type="button" class="btn small" data-discovery="'+items.indexOf(x)+'">Investigar e registrar</button>':'')+'</div></article>';
  };
  panel.innerHTML=header+types.map(type=>
    '<section><div class="group-head"><h2>'+type.title+'</h2><span>'+groups[type.key].length+'</span></div>'+
    '<p class="micro">'+type.explain+'</p>'+
    (groups[type.key].length?'<div class="cards">'+groups[type.key].map(card).join("")+'</div>':'<div class="empty-state">Nenhum resultado desta categoria nesta consulta.</div>')+'</section>').join("");
}

async function automaticSearch({requestText=""}={}){
  if(!canUse("search")){notice("Sua conta precisa ser aprovada e ter permissão de pesquisa.");return;}
  const f=readFilters();
  if(!validFilters(f))return;
  if(!f.brand.trim()||!f.model.trim()||!f.originCity.trim()||!f.uf.trim()){
    notice("Informe marca, modelo, cidade e UF para realizar a busca online.");
    return;
  }
  if(!searchWorkerUrl){
    $("#autoSearchState").textContent="Configuração gratuita pendente";
    notice("O motor online está preparado, mas depende da configuração do Worker e de uma chave gratuita de pesquisa. Não há resultados simulados.");
    return;
  }
  const button=$("#automaticSearchButton"),output=$("#automaticResults");
  button.disabled=true;button.textContent="Pesquisando...";
  output.innerHTML='<p class="micro">Consultando a web. Nenhum resultado será tratado como anúncio verificado sem inspeção individual.</p>';
  try{
    const base="https://www.gstatic.com/firebasejs/11.10.0/";
    const [sdkApp,sdkAuth]=await Promise.all([import(base+"firebase-app.js"),import(base+"firebase-auth.js")]);
    const firebaseApp=sdkApp.getApps().find(a=>a.options.projectId===firebaseConfig.projectId);
    const user=firebaseApp?sdkAuth.getAuth(firebaseApp).currentUser:null;
    if(!user)throw Error("Entre na conta Firebase antes de pesquisar.");
    const token=await user.getIdToken();
    const uri=new URL("/search",searchWorkerUrl);
    if(uri.protocol!=="https:")throw Error("Conector precisa usar HTTPS.");
    const controller=new AbortController();
    const abort=setTimeout(()=>controller.abort(),55000);
    let res;
    try{
      res=await fetch(uri,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({filters:f}),signal:controller.signal,cache:"no-store"});
    }finally{clearTimeout(abort);}
    const data=await res.json();
    if(!res.ok)throw Error(String(data?.error||"Erro ao consultar o serviço de pesquisa"));
    lastDiscoveryFilters=f;
    const items=normalizeWebLeads(data?.items);
    displayDiscovery(items,data);
    $("#autoSearchState").textContent="Consulta realizada";
    try{
      if(!state.firebase||state.mode!=="remote")throw Error("Firebase não sincronizado");
      if(!state.team)throw Error("Base compartilhada não conectada");
      await state.team.saveSearch({
        requestText:String(requestText).slice(0,450),filters:f,source:data.source||"Tavily",
        checkedAt:data.checkedAt||new Date().toISOString(),coverage:data.coverage||{},
        items:(Array.isArray(data.items)?data.items:[]).slice(0,20)
      });
      $("#autoSearchState").textContent="Consulta salva no Firebase";
    }catch(e){
      $("#autoSearchState").textContent="Consulta feita, histórico não salvo";
      notice("A consulta apareceu, mas o histórico não foi salvo: "+(e?.message||"erro"));
    }
  }catch(e){
    latestDiscovered=[];
    output.innerHTML='<div class="empty-state">'+esc(e?.message||"Pesquisa indisponível")+'</div>';
    $("#autoSearchState").textContent="Consulta não concluída";
  }finally{
    button.disabled=false;button.textContent="Pesquisar motos agora";
  }
}
function registerDiscovery(index){
  const item=latestDiscovered[index];
  if(!item||item.pageType!=="individual-candidate")return;
  openLead(null);
  setForm($("#leadForm"),{
    brand:"",model:"",version:"",
    city:"",uf:"",source:item.source,url:item.url,evidence:"index",
    notes:"URL candidata a anúncio individual, encontrada em busca indexada; ainda NÃO verificada. Título: "+item.title+"\nTrecho: "+item.snippet+"\nPreencha marca, modelo, versão, ano, KM, preço e cidade apenas após verificar a página original."
  });
  $("#leadForm").elements.namedItem("brand").focus();
  notice("Confira a página de origem e preencha apenas dados comprovados. Os filtros pesquisados não são informações verificadas do anúncio.");
  $("#leadDialog").scrollTop=0;
}


function renderHistory(){
  const panel=$("#searchHistory"),entries=allHistory();
  if(!state.user){panel.innerHTML='<div class="empty-state">Entre no Firebase para recuperar suas pesquisas salvas.</div>';return;}
  if(!entries.length){panel.innerHTML='<div class="empty-state">Nenhuma pesquisa salva nesta conta.</div>';return;}
  panel.innerHTML='<div class="cards">'+entries.slice(0,50).map((x,i)=>{
    const f=x.filters||{},name=[f.brand,f.model,f.version].filter(Boolean).join(" ");
    const count=Array.isArray(x.items)?x.items.length:0;
    return '<article class="lead-card"><h3 class="card-title">'+esc(name||"Pesquisa")+'</h3><p class="micro">'+esc(x.createdAt||x.checkedAt||"Sem data")+' · '+count+' páginas indexadas</p>'+
      (x.requestText?'<p class="card-note">'+esc(x.requestText)+'</p>':"")+
      '<div class="card-actions"><button class="btn secondary small" type="button" data-history="'+i+'">Reabrir resultados</button></div></article>';
  }).join("")+'</div>';
}
async function assistantSearch(){
  if(!canUse("search")){notice("Aguarde a aprovação do padrinho para consultar a IA.");return;}
  const prompt=$("#assistantPrompt").value.trim(),button=$("#assistantSend"),label=$("#assistantReply");
  if(prompt.length<5||prompt.length>450){label.textContent="Descreva seu pedido em até 450 caracteres.";return;}
  if(state.mode!=="remote"||!state.user){label.textContent="Entre na conta Firebase e aguarde a sincronização antes de pesquisar.";return;}
  if(!searchWorkerUrl){label.textContent="Worker de pesquisa ainda não configurado.";return;}
  button.disabled=true;button.textContent="Interpretando...";
  // Não confundir os resultados salvos da consulta anterior com a nova solicitação.
  latestDiscovered=[];
  $("#automaticResults").innerHTML='<div class="empty-state">Aguardando a nova pesquisa. Resultados anteriores permanecem no histórico do Firebase.</div>';
  $("#autoSearchState").textContent="Nova solicitação em análise";
  let localMode=false;
  try{
    const saved=readFilters();
    const local=parseLocalIntent(prompt,saved);
    if(local.warnings.length){
      label.textContent=local.warnings.join(" ")+" Confira o pedido e tente novamente; nenhuma pesquisa foi iniciada.";
      return;
    }
    let interpreted=local.filters;
    const completeLocal=!!(interpreted.brand&&interpreted.model);
    if(completeLocal){
      // Evita depender de /interpret quando o pedido já pode ser interpretado localmente.
      // A busca de anúncios continua no endpoint autenticado /search.
      localMode=true;
    }else{
      try{
        const base="https://www.gstatic.com/firebasejs/11.10.0/";
        const [sdkApp,sdkAuth]=await Promise.all([import(base+"firebase-app.js"),import(base+"firebase-auth.js")]);
        const app=sdkApp.getApps().find(a=>a.options.projectId===firebaseConfig.projectId);
        const user=app?sdkAuth.getAuth(app).currentUser:null;
        if(!user)throw Error("Login Firebase necessário.");
        const controller=new AbortController(),abort=setTimeout(()=>controller.abort(),12000);
        let res;
        try{
          res=await fetch(new URL("/interpret",searchWorkerUrl),{
            method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+await user.getIdToken()},
            body:JSON.stringify({message:prompt}),signal:controller.signal,cache:"no-store"
          });
        }finally{clearTimeout(abort);}
        const data=await res.json();
        if(!res.ok)throw Error("HTTP "+res.status+": "+(data?.code?data.code+" — ":"")+(data?.detail||data?.error||"IA indisponível"));
        if(!data?.filters||typeof data.filters!=="object")throw Error("A IA não devolveu filtros válidos.");
        interpreted=data.filters;
      }catch(e){
        const explanation=e?.name==="AbortError"?"A IA não respondeu dentro de 12 segundos.":String(e?.message||"Falha desconhecida na IA");
        label.textContent="IA Cloudflare: "+explanation+
          " Nenhuma nova pesquisa foi feita. Os filtros visíveis continuam sendo os da consulta anterior. "+
          "Você ainda pode usar os filtros manuais.";
        $("#autoSearchState").textContent="Interpretação pela IA falhou; nenhuma nova pesquisa";
        return;
      }
    }
    if(!interpreted.brand||!interpreted.model){label.textContent="Informe marca e modelo exato. Nenhuma pesquisa foi iniciada.";return;}
    const f=mergeIntentFilters(saved,interpreted);
    const missing=["brand","model","originCity","uf"].filter(k=>!String(f[k]||"").trim());
    if(missing.length){
      label.textContent="Complete os campos: "+missing.join(", ")+". Os demais dados identificados foram colocados nos filtros.";
      setForm($("#filterForm"),f);
      $("#filterForm").scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    if(!validFilters(f)){label.textContent="Os filtros precisam de correção. Nenhuma pesquisa foi feita.";return;}
    setForm($("#filterForm"),f);
    state.filters=f;
    await persist();
    renderAll();
    label.textContent=(localMode?"Interpretação local gratuita. ":"Interpretação por IA remota. ")+
      "Buscando anúncios na web; não são resultados simulados...";
    await automaticSearch({requestText:prompt});
    const result=$("#autoSearchState").textContent;
    label.textContent=(localMode?"Interpretação local gratuita. ":"IA remota. ")+result+
      ". Confira os filtros e os links de origem: resultados indexados não comprovam disponibilidade.";
  }catch(e){
    label.textContent="Pesquisa não concluída: "+(e?.message||"erro")+". Os filtros manuais continuam disponíveis.";
  }finally{button.disabled=false;button.textContent="Interpretar e pesquisar";}
}
function enableVoiceInput(){
  const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Rec)return;
  const mic=$("#assistantMic");mic.hidden=false;
  mic.addEventListener("click",()=>{
    const recognizer=new Rec();recognizer.lang="pt-BR";recognizer.maxAlternatives=1;recognizer.interimResults=false;
    mic.disabled=true;mic.textContent="Ouvindo...";
    recognizer.onresult=e=>{$("#assistantPrompt").value=String(e.results?.[0]?.[0]?.transcript||"").slice(0,450);};
    recognizer.onerror=e=>{$("#assistantReply").textContent="Ditado não concluído: "+(e?.error||"erro")+". Digite o pedido normalmente.";};
    recognizer.onend=()=>{mic.disabled=false;mic.textContent="🎙 Ditar pedido";};
    try{recognizer.start();}catch{mic.disabled=false;mic.textContent="🎙 Ditar pedido";}
  });
}

function summarize(){const out={compatible:[],pending:[],outside:[]};for(const l of sortLeads(allLeads(),state.filters.order)){const r=evaluateLead(l,state.filters);out[r.bucket].push({...l,assessment:r});}return out;}
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
  el.innerHTML='<option value="">Sem anúncio selecionado</option>'+allLeads().map(x=>'<option value="'+esc(x.id)+'">'+esc([x.brand,x.model,x.version,x.yearModel||"",money(x.price)].filter(Boolean).join(" · "))+'</option>').join("");
  if(allLeads().some(x=>x.id===prev))el.value=prev;
}
function renderAll(){const groups=summarize();renderCounts(groups);renderLeads(groups);renderFinanceOptions();renderHistory();setStatus();renderTeamPanel();}
function openLead(id){
  if(state.user&&!canUse(id?"edit":"create"))return notice("O padrinho ainda não autorizou esta operação.");
  const form=$("#leadForm");form.reset();
  const x=allLeads().find(y=>y.id===id);
  if(x){setForm(form,x);$("#leadDialogTitle").textContent="Editar evidência";}else{$("#leadDialogTitle").textContent="Registrar anúncio ou lead";setForm(form,{...state.filters,id:"",url:"",source:"",evidence:"index",price:"",km:"",city:state.filters.originCity,yearMake:"",yearModel:"",distanceKm:"",distanceVerified:false,notes:""});}
  $("#leadDialog").showModal();
}
function readLead(){
  const form=$("#leadForm"),d=Object.fromEntries(new FormData(form).entries()),old=allLeads().find(x=>x.id===d.id);
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
  const existing=allLeads().find(x=>x.id===l.id);
  const dupe=findDuplicate(l,allLeads().filter(x=>x.id!==l.id));
  if(dupe?.type==="same-url")return notice("Esse link já existe no histórico. Edite o registro existente.");
  if(dupe?.type==="possible-same-bike"&&!confirm("Possível duplicidade: preço, KM, ano e cidade iguais. Registrar mesmo assim?"))return;
  try{
    if(state.user){
      if(!canUse(existing?"edit":"create"))return notice("Permissão insuficiente para esta operação.");
      if(!state.team)throw Error("A base compartilhada ainda não foi carregada.");
      if(existing&&!existing._shared&&isOwner()){
        const idx=state.leads.findIndex(x=>x.id===l.id);
        if(idx<0)throw Error("Registro original não encontrado.");
        state.leads[idx]=l;await persist();
      }else{
        await state.team.saveLead(l);
      }
    }else{
      const idx=state.leads.findIndex(x=>x.id===l.id);
      if(idx>=0)state.leads[idx]=l;else state.leads.unshift(l);
      await persist();
    }
    $("#leadDialog").close();renderAll();switchView("oportunidades");
    notice("Registro salvo. Disponibilidade e documentação ainda não comprovadas.");
  }catch(err){notice("Não foi possível salvar: "+(err?.message||"erro"));}
}
async function removeLead(id){
  if(state.mode==="loading")return notice("Aguarde a sincronização.");
  const existing=allLeads().find(x=>x.id===id);
  if(!existing)return notice("Registro não encontrado.");
  if(state.user&&!canUse("delete"))return notice("Somente pessoas autorizadas podem arquivar.");
  if(!confirm(existing._shared?"Arquivar este registro compartilhado? Ele não será apagado fisicamente.":"Excluir este registro antigo? Faça backup se desejar preservá-lo."))return;
  try{
    if(state.user&&existing._shared){
      await state.team.archiveLead(id);notice("Registro compartilhado arquivado.");
    }else if(!state.user||isOwner()){
      state.leads=state.leads.filter(x=>x.id!==id);
      await persist();notice("Registro antigo excluído.");
    }else throw Error("Operação não autorizada.");
    renderAll();
  }catch(err){notice("Não foi possível arquivar: "+(err?.message||"erro"));}
}
function download(name,content,mime){
  const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function backupJson(){download("evolution-radar-ia-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),leads:allLeads(),filters:state.filters,recentSearchHistory:allHistory()},null,2),"application/json");}
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
    if(state.user&&!canUse("create"))throw Error("Seu perfil não permite cadastrar registros.");
    for(const lead of imported){
      if(allLeads().some(x=>x.id===lead.id)||findDuplicate(lead,allLeads())?.type==="same-url")continue;
      if(state.user){await state.team.saveLead(lead);}
      else state.leads.push(lead);
      added++;
    }
    if(!state.user)await persist();
    renderAll();notice(added+" registro(s) importado(s). Registros existentes preservados.");
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
  $("#automaticSearchButton").addEventListener("click",()=>automaticSearch());
  $("#assistantSend").addEventListener("click",assistantSearch);
  $("#searchHistory").addEventListener("click",e=>{const btn=e.target.closest("button[data-history]");if(!btn)return;const entry=allHistory()[Number(btn.dataset.history)];if(!entry)return;const f={...emptyFilters,...(entry.filters||{})};setForm($("#filterForm"),f);displayDiscovery(normalizeWebLeads(entry.items),entry);$("#automaticResults").scrollIntoView({behavior:"smooth",block:"start"});});
  enableVoiceInput();
  $("#automaticResults").addEventListener("click",e=>{const btn=e.target.closest("button[data-discovery]");if(btn)registerDiscovery(Number(btn.dataset.discovery));});
  $("#generateSearch").addEventListener("click",async()=>{const f=readFilters();if(!validFilters(f))return;state.filters=f;await persist();renderAll();updateSearch();$("#searchLinks").scrollIntoView({behavior:"smooth",block:"start"});});
  $("#resetFilters").addEventListener("click",async()=>{state.filters={...emptyFilters};setForm($("#filterForm"),state.filters);$("#searchLinks").hidden=true;await persist();renderAll();});
  ["openLead","addLead"].forEach(id=>$("#"+id).addEventListener("click",()=>openLead(null)));
  $("#closeLead").addEventListener("click",()=>$("#leadDialog").close());
  $("#cancelLead").addEventListener("click",()=>$("#leadDialog").close());
  $("#leadForm").addEventListener("submit",storeLead);
  $("#leadGroups").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;if(b.dataset.action==="edit")openLead(b.dataset.id);if(b.dataset.action==="delete")removeLead(b.dataset.id);});
  $("#financeLead").addEventListener("change",e=>{const l=allLeads().find(x=>x.id===e.target.value);if(l&&l.price!=null)$("#financeForm").elements.namedItem("purchase").value=String(l.price);});
  $("#financeForm").addEventListener("submit",calculate);
  $("#exportJson").addEventListener("click",backupJson);
  $("#exportCsv").addEventListener("click",()=>download("evolution-radar-ia-"+new Date().toISOString().slice(0,10)+".csv",csvExport(allLeads()),"text/csv;charset=utf-8"));
  $("#importJson").addEventListener("change",importJson);
  $("#loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!state.firebase)return;const f=new FormData(e.target);try{await state.firebase.login(String(f.get("email")),String(f.get("password")));e.target.elements.namedItem("password").value="";notice("Autenticação realizada. Carregando dados privados.");}catch(err){notice("Login não realizado: "+err.message);}});
  $("#logoutButton").addEventListener("click",async()=>{if(!state.firebase)return;try{await state.firebase.logout();notice("Sessão encerrada.");}catch(err){notice(err.message);}});
  $("#signupForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!state.team)return notice("Aguarde a conexão com o Firebase.");
    const form=e.target,button=form.querySelector("button[type=submit]"),data=new FormData(form);
    button.disabled=true;
    try{
      const registered=await state.team.signup(String(data.get("name")),String(data.get("email")),String(data.get("password")));
      form.reset();
      notice(registered.emailSent?"Cadastro registrado. Confira seu e-mail, depois faça login e aguarde aprovação.":"Cadastro registrado, mas o e-mail de confirmação não foi enviado. Faça login e use Reenviar confirmação.");
    }catch(err){notice("Cadastro: "+(err?.message||"erro"));}
    finally{button.disabled=false;}
  });
  $("#resendVerification").addEventListener("click",async e=>{
    if(!state.team)return;const button=e.currentTarget;button.disabled=true;
    try{await state.team.resendVerification();notice("E-mail de confirmação solicitado. Verifique também a pasta de spam.");}
    catch(err){notice("Confirmação não enviada: "+(err?.code||err?.message||"erro"));}
    finally{button.disabled=false;}
  });
  $("#refreshVerification").addEventListener("click",async e=>{
    if(!state.team)return;const button=e.currentTarget;button.disabled=true;
    try{const verified=await state.team.refreshVerification();
      notice(verified?"E-mail confirmado. Aguarde ou confira a aprovação do padrinho.":"E-mail ainda não confirmado. Abra o link de verificação e tente novamente.");}
    catch(err){notice("Falha ao verificar: "+(err?.message||"erro"));}
    finally{button.disabled=false;}
  });
  $("#requestApprovalForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{await state.team.requestApproval(String(new FormData(e.target).get("name")));notice("Solicitação enviada ao padrinho.");}
    catch(err){notice(err?.message||"Falha na solicitação");}
  });
  $("#adminRequests").addEventListener("click",async e=>{
    const btn=e.target.closest("button[data-team-action]");if(!btn)return;
    if(!isOwner()||!state.team)return;
    const uid=btn.dataset.uid,action=btn.dataset.teamAction;
    if(action!=="approve"&&action!=="reject")return;
    if(!confirm(action==="approve"?"Aprovar o cadastro com permissão inicial para visualizar, pesquisar e cadastrar?":"Recusar este cadastro?"))return;
    btn.disabled=true;
    try{
      if(action==="reject")await state.team.reject(uid);
      else await state.team.adminAction(uid,"approve",DEFAULT_PERMISSIONS);
      notice(action==="approve"?"Cadastro aprovado pelo padrinho.":"Cadastro recusado.");
    }catch(err){notice("Administração: "+(err?.message||"erro"));}
    finally{btn.disabled=false;}
  });
  $("#adminMembers").addEventListener("click",async e=>{
    const btn=e.target.closest("button[data-team-action]");if(!btn||!isOwner()||!state.team)return;
    const uid=btn.dataset.uid,action=btn.dataset.teamAction;
    const item=btn.closest(".team-entry");
    let name,permissions;
    if(action==="rename"){
      const current=state.members.find(m=>m.id===uid);
      name=prompt("Novo nome de exibição do colaborador:",current?.name||"");
      if(name===null)return;
    }
    if(action==="permissions"){
      permissions=Object.fromEntries([...item.querySelectorAll("input[data-perm]")].map(x=>[x.dataset.perm,x.checked]));
      if(!confirm("Salvar estas permissões para o colaborador?"))return;
    }
    if(["revoke","suspend"].includes(action)&&!confirm(
      action==="revoke"?"Revogar o acesso do colaborador? O login Firebase continuará existindo, mas ficará bloqueado no sistema.":"Suspender temporariamente o acesso?"))return;
    btn.disabled=true;
    try{await state.team.adminAction(uid,action,permissions,name);notice("Alteração de acesso registrada.");}
    catch(err){notice("Administração: "+(err?.message||"erro"));}
    finally{btn.disabled=false;}
  });
  $("#copyLegacyHistory").addEventListener("click",async e=>{
    if(!isOwner()||!state.team)return notice("Somente o padrinho pode executar a cópia.");
    if(!state.history.length)return notice("Nenhuma pesquisa anterior precisa ser copiada.");
    if(!confirm("Copiar "+state.history.length+" pesquisas antigas para a equipe, preservando todos os originais?"))return;
    e.currentTarget.disabled=true;
    try{
      const r=await state.team.importLegacyHistory(state.history);
      $("#teamCopyStatus").textContent=r.copied+" pesquisas copiadas, "+r.skipped+" já existentes. Histórico original preservado.";
      notice("Cópia do histórico concluída.");
    }catch(err){notice("Cópia do histórico interrompida: "+(err?.message||"erro"));}
    finally{e.currentTarget.disabled=false;}
  });
  $("#copyLegacyLeads").addEventListener("click",async e=>{
    if(!isOwner()||!state.team)return notice("Somente o padrinho pode executar a cópia.");
    if(!state.leads.length)return notice("Nenhum registro antigo precisa ser copiado.");
    if(!confirm("Copiar "+state.leads.length+" registros antigos para a base compartilhada, sem apagar os originais?"))return;
    const button=e.currentTarget;button.disabled=true;
    try{
      const result=await state.team.importLegacy(state.leads);
      $("#teamCopyStatus").textContent=result.copied+" copiados, "+result.skipped+" já existentes. Todos os originais foram preservados.";
      notice("Cópia concluída. Os registros antigos não foram alterados.");
    }catch(err){notice("Cópia incompleta: "+(err?.message||"erro"));}
    finally{button.disabled=false;}
  });
}
async function boot(){
  const local=localRead();state.filters=local.filters;state.leads=local.leads;
  try{document.documentElement.dataset.theme=localStorage.getItem(THEME)==="light"?"light":"dark";}catch{}
  setForm($("#filterForm"),state.filters);bind();renderAll();
  $("#autoSearchState").textContent=searchWorkerUrl?"Conector disponível":"Conector gratuito ainda não configurado";
  const configured=!!firebaseConfig?.apiKey&&!!firebaseConfig?.projectId&&!!firebaseConfig?.databaseURL;
  if(configured){
    try{
      state.firebase=await openFirebase(firebaseConfig,{
        onAuth:user=>{state.user=user;if(user){state.mode="loading";state.remoteReady=false;}else{const l=localRead();state.leads=l.leads;state.filters=l.filters;setForm($("#filterForm"),state.filters);state.mode="local";state.remoteReady=false;}renderAll();},
        onHistory:history=>{state.history=history;renderHistory();},
        onData:data=>{const raw=data?.leads;const leads=Array.isArray(raw)?raw:(raw&&typeof raw==="object"?Object.values(raw):[]);state.leads=leads.map(sanitizeLead).filter(Boolean);state.filters={...emptyFilters,...(data?.filters||{})};setForm($("#filterForm"),state.filters);state.mode="remote";state.remoteReady=true;renderAll();},
        onError:err=>{notice("Erro Firebase: "+err.message);state.mode="loading";renderAll();}
      });
      state.team=await openTeam(firebaseConfig,{
        onAccess:info=>{state.teamInfo=info;renderAll();},
        onRequests:list=>{state.requests=list;renderTeamPanel();},
        onMembers:list=>{state.members=list;renderTeamPanel();},
        onAudit:list=>{state.audit=list;renderTeamPanel();},
        onLeads:list=>{state.sharedLeads=list;renderAll();},
        onHistory:list=>{state.sharedHistory=list;renderHistory();},
        onError:err=>{
          $("#teamSetupStatus").textContent="Regras do Firebase não permitiram a operação. Confira a publicação de database.rules.json. Detalhe: "+(err?.code||err?.message||"erro");
          notice("Apadrinhamento: acesso negado pelo Firebase. Consulte a configuração das regras.");
        }
      });
      renderAll();
    }catch(err){notice("Firebase indisponível: "+err.message);state.firebase=null;state.mode="local";renderAll();}
  }
  if("serviceWorker" in navigator && location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
  const hash=location.hash.slice(1);if(["pesquisa","oportunidades","analise","config"].includes(hash))switchView(hash);
}
boot();
