import {normalizeWebLeads,partitionDiscovery} from "./search-engine.mjs";

export const DIAGNOSTIC_VERSION="2026-11-13.1";
const FILTER_KEYS=["brand","model","version","yearType","yearFrom","yearTo","priceMin","priceMax","kmMax","originCity","uf","radiusKm","sellerType"];
export function diagnosticFilters(value={}){
  return Object.fromEntries(FILTER_KEYS.map(key=>[key,String(value?.[key]??"").trim().slice(0,100)]));
}
const errorCode=error=>/^[a-zA-Z0-9_./-]{1,75}$/.test(String(error?.code||""))?String(error.code):error?.name==="AbortError"?"TIMEOUT":"REQUEST_FAILED";
const count=value=>Number.isInteger(value)&&value>=0?value:null;
const has=value=>value!==null&&value!==undefined&&value!=="";
const knownUnavailable=item=>item?.pageStatus==="unavailable"||item?.availability?.status==="unavailable";

// O relatório contém metadados e links públicos; nunca recebe tokens para exportação.
export function inspectSearchEvidence(data,filters,now=Date.now()){
  const normalized=normalizeWebLeads(data?.items);
  const groups=partitionDiscovery(normalized,filters);
  const candidates=normalized.filter(x=>x.pageType==="individual-candidate");
  const rawFor=item=>(Array.isArray(data?.items)?data.items:[]).find(x=>{
    try{const a=new URL(x.url),b=new URL(item.url);return a.hostname===b.hostname&&a.pathname===b.pathname;}catch{return false;}
  });
  const listings=candidates.map(item=>{
    const fields=item.fields||{};
    const raw=rawFor(item),publicUrl=new URL(item.url);publicUrl.username="";publicUrl.password="";publicUrl.search="";publicUrl.hash="";
    const missing=["price","km",filters.yearType==="make"?"yearMake":"yearModel","city","uf"].filter(key=>!has(fields[key]));
    return {url:publicUrl.href,title:item.title,extraction:item.extractionStatus,
      extractionFailureCode:item.extractionFailureCode??null,
      missing,advertisedYear:fields.yearAdvertised??null,
      titleYears:[...new Set(item.title.match(/\b(?:19|20)\d{2}\b/g)||[])],
      category:knownUnavailable(raw)?"excluded":groups.matched.some(x=>x.item===item)?"compatible":groups.excluded.some(x=>x.item===item)?"excluded":"unresolved",
      pageAvailability:knownUnavailable(raw)?"unavailable":"not-verified"};
  });
  const timestamp=Date.parse(data?.checkedAt||"");
  const coverage=data?.coverage||{};
  return {source:data?.source==="Tavily"?"Tavily":"not-reported",serverCache:data?.cache===true,
    checkedAt:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null,
    ageMinutes:Number.isFinite(timestamp)?Math.round((now-timestamp)/60000):null,
    queriesAttempted:count(coverage.queriesAttempted),queriesSucceeded:count(coverage.queriesSucceeded),
    extractionAttempted:count(coverage.extractionAttempted),extractionSucceeded:count(coverage.extractionSucceeded),
    extractionFailures:count(coverage.extractionFailures),
    extractionFailureReasons:Object.fromEntries(Object.entries(coverage.extractionFailureReasons||{})
      .filter(([code,value])=>/^EXTRACT_[A-Z_]{3,60}$/.test(code)&&count(value)!==null)),
    total:normalized.length,individual:candidates.length,catalogs:normalized.length-candidates.length,
    withinRegion:groups.matched.length,
    compatible:groups.matched.filter(x=>x.item.assessment?.bucket==="prequalified"&&!knownUnavailable(rawFor(x.item))).length,
    unresolved:groups.unresolved.length+groups.matched.filter(x=>x.item.assessment?.bucket!=="prequalified").length,excluded:groups.excluded.length,
    incomplete:candidates.filter(x=>["price","km",filters.yearType==="make"?"yearMake":"yearModel","city","uf"].some(k=>!has(x.fields?.[k]))).length,
    unavailable:listings.filter(x=>x.pageAvailability==="unavailable").length,listings};
}

// Somente GET e os POST de leitura já existentes (/search e /interpret).
// Não grava histórico, não altera permissões e não chama exclusão de contas.
export async function runDiagnostics(options){
  const {workerUrl,fetchImpl=fetch,getSession,readDatabase,inspectBrowser,checkAssets,onProgress=()=>{},now=()=>Date.now()}=options;
  const filters=diagnosticFilters(options.filters);
  const report={schemaVersion:1,diagnosticVersion:DIAGNOSTIC_VERSION,startedAt:new Date(now()).toISOString(),filters,checks:[],evidence:null};
  const add=(id,label,status,note,next="",detail)=>{
    const row={id,label,status,note,...(next?{next}:{}),...(detail?{detail}:{})};
    report.checks.push(row);onProgress({...report,checks:[...report.checks]});return row;
  };
  const guarded=async(id,label,action)=>{
    try{return await action();}catch(error){add(id,label,error?.name==="AbortError"?"blocked":"fail",errorCode(error),"Verifique conexão, sessão e permissões; copie este relatório.");return null;}
  };
  const request=async(path,body,token)=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),path==="/search"?55000:20000);
    try{
      const response=await fetchImpl(new URL(path,workerUrl),{method:body?"POST":"GET",cache:"no-store",signal:controller.signal,
        headers:{...(body?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{})},
        ...(body?{body:JSON.stringify(body)}:{})});
      let data;try{data=await response.json();}catch{data=null;}
      return {ok:response.ok,status:response.status,data};
    }finally{clearTimeout(timer);}
  };
  const httpFailure=(id,label,result)=>{
    const blocked=[401,403,429].includes(result.status);
    add(id,label,blocked?"blocked":"fail","HTTP "+result.status+(result.data?.code?" · "+errorCode(result.data):""),
      result.status===401?"Entre novamente no sistema e execute o diagnóstico.":result.status===403?"Verifique autorização do usuário e origem permitida no Worker.":result.status===429?"Confira a franquia do serviço antes de repetir.":"Confira o serviço indicado e os logs do Worker.");
  };
  add("facebook","Facebook Marketplace","pending","Busca externa e registro de links disponíveis no Radar; coleta automática autenticada do Facebook não está conectada ao Worker.","Abra a busca no Facebook com sua sessão, confira cidade/raio e registre o link individual. Uma API/coleta autorizada precisa ser validada antes de declarar importação automática.");
  if(inspectBrowser)await guarded("browser","Tela e cache",async()=>{
    const detail=await inspectBrowser();
    add("browser","Tela e cache",detail.horizontalOverflow?"fail":"ok",detail.horizontalOverflow?"Existe rolagem horizontal nesta tela.":"Sem rolagem horizontal nesta tela.",detail.horizontalOverflow?"Revisar o layout nesta largura.":"",detail);
  });
  if(checkAssets)await guarded("assets","Arquivos do site",async()=>{
    const detail=await checkAssets();const failed=detail.filter(x=>x.status!==200);
    add("assets","Arquivos do site",failed.length?"fail":"ok",failed.length?"Há arquivos inacessíveis.":"Arquivos do aplicativo acessíveis neste navegador.",failed.length?"Verificar a publicação dos arquivos listados.":"",detail);
  });
  await guarded("health","Worker publicado",async()=>{
    const result=await request("/health");
    if(!result.ok)return httpFailure("health","Worker publicado",result);
    const data=result.data;
    if(data?.service!=="Evolution Radar IA"||data?.status!=="online")return add("health","Worker publicado","fail","Resposta inesperada; HTTP 200 sozinho não comprova o serviço.","Conferir endereço e conteúdo publicado.");
    add("health","Worker publicado","ok","Worker respondeu ao health; nenhuma pesquisa foi executada por essa rota.","",{version:String(data.version||"").slice(0,40)});
    add("ai-binding","Vínculo da IA",data.aiBinding==="connected"?"ok":"fail",data.aiBinding==="connected"?"Vínculo AI informado pelo servidor; inferência será testada separadamente.":"O Worker não informou vínculo AI conectado.",data.aiBinding==="connected"?"":"Conferir o binding AI existente.");
    add("account-deletion","Exclusão definitiva de contas","pending",data.accountDeletionConfigured===true?"Credencial declarada presente; nenhuma exclusão foi executada.":"Credencial administrativa ausente segundo o Worker.",data.accountDeletionConfigured===true?"Validar a exclusão separadamente com uma conta de teste autorizada.":"Configurar a credencial administrativa antes de habilitar exclusão definitiva.");
  });
  let session=null,token="";
  await guarded("session","Sessão Firebase",async()=>{
    session=await getSession();
    add("session","Sessão Firebase",session?.authenticated?"ok":"blocked",session?.authenticated?"Sessão autenticada encontrada; dados pessoais omitidos.":"Nenhuma sessão autenticada neste navegador.",session?.authenticated?"":"Abra o sistema nesta mesma janela, faça login e volte ao diagnóstico.");
  });
  if(session?.authenticated){
    add("email","Confirmação de e-mail",session.isOwner||session.emailVerified?"ok":"blocked",session.isOwner?"Conta principal identificada pela configuração existente.":session.emailVerified?"E-mail confirmado na sessão.":"E-mail ainda não confirmado na sessão.",session.isOwner||session.emailVerified?"":"Confirme o e-mail e renove a sessão no sistema.");
    if(readDatabase)await guarded("database","Leitura do Firebase",async()=>{
      const rows=await readDatabase(session);
      for(const row of rows)add(row.id,row.label,row.status,row.note,row.next||"");
    });
    await guarded("token","Token para o Worker",async()=>{
      token=await session.getIdToken();
      add("token","Token para o Worker",typeof token==="string"&&token.length>=100?"ok":"fail",typeof token==="string"&&token.length>=100?"Token obtido somente em memória; não aparece no relatório.":"Token de autenticação inválido.",typeof token==="string"&&token.length>=100?"":"Renove o login antes de continuar.");
      if(typeof token!=="string"||token.length<100)token="";
    });
  }
  const valid=["brand","model","originCity","uf"].every(k=>filters[k]);
  add("filters","Filtros usados no diagnóstico",valid?"ok":"blocked",valid?"Os campos exibidos acima serão enviados exatamente como preenchidos.":"Marca, modelo, cidade e UF são obrigatórios.",valid?"":"Preencha os quatro campos e execute novamente.");
  if(token&&valid){
    await guarded("inference","IA remota de verdade",async()=>{
      // Pedido determinístico, sem nomes, histórico ou dados particulares.
      const message=[filters.brand,filters.model,filters.version,filters.yearFrom,filters.originCity,filters.uf,"raio",filters.radiusKm||"0","km"].filter(Boolean).join(" ").slice(0,450);
      const result=await request("/interpret",{message},token);
      if(!result.ok)return httpFailure("inference","IA remota de verdade",result);
      if(result.data?.mode!=="workers-ai"||!result.data?.filters?.brand||!result.data?.filters?.model)
        return add("inference","IA remota de verdade","fail","Resposta não comprova interpretação pela rota Workers AI.","Conferir a rota /interpret e o modelo configurado.");
      add("inference","IA remota de verdade",result.data.cache===true?"pending":"ok",result.data.cache===true?"A rota Workers AI retornou interpretação em cache; nova inferência não comprovada nesta execução.":"A rota Workers AI retornou marca e modelo; o servidor informou resposta sem cache.","",{serverCache:result.data.cache===true});
    });
    await guarded("search","Pesquisa autenticada",async()=>{
      const result=await request("/search",{filters},token);
      if(!result.ok)return httpFailure("search","Pesquisa autenticada",result);
      if(!Array.isArray(result.data?.items))return add("search","Pesquisa autenticada","fail","Servidor respondeu sem uma lista de resultados válida.","Verificar o contrato da rota /search.");
      const evidence=inspectSearchEvidence(result.data,filters,now());report.evidence=evidence;
      add("search","Pesquisa autenticada","ok","Resposta recebida do Worker; isso não confirma a existência das motos.");
      add("search-provider","Pesquisa externa",evidence.source==="Tavily"&&evidence.queriesSucceeded>0&&!evidence.serverCache?"ok":"pending",
        evidence.serverCache?"Servidor declarou resposta em cache; nova consulta à Tavily não comprovada nesta execução.":"Origem e quantidade de consultas declaradas pelo servidor.","",{source:evidence.source,queriesSucceeded:evidence.queriesSucceeded,serverCache:evidence.serverCache});
      add("freshness","Data da resposta",evidence.ageMinutes===null||evidence.ageMinutes< -5||evidence.ageMinutes>15?"pending":"ok",evidence.checkedAt?"Data informada: "+evidence.checkedAt+"; idade aproximada: "+evidence.ageMinutes+" min.":"Servidor não informou uma data válida.",evidence.ageMinutes>15?"Conferir resposta antiga ou reabertura de histórico.":"");
      add("extraction","Extração de páginas",evidence.individual&&evidence.extractionSucceeded>0?"ok":"pending",String(evidence.extractionSucceeded??"Não informado")+" extração(ões) concluída(s); "+String(evidence.extractionFailures??"não informado")+" falha(s).","Uma falha de extração pode ser bloqueio, remoção ou indisponibilidade; não distingue sozinha a causa.");
      add("qualified","Compatibilidade preliminar",evidence.compatible?"ok":"pending",evidence.compatible+" pré-qualificado(s), "+evidence.unresolved+" sem comprovação e "+evidence.excluded+" excluído(s).",evidence.compatible?"":"Melhorar cobertura e comprovação das páginas; zero compatíveis não significa que não existam motos à venda.");
      add("fields","Dados dos anúncios",evidence.individual&&evidence.incomplete===0?"ok":"pending",evidence.incomplete+" de "+evidence.individual+" anúncio(s) individual(is) sem preço, KM, ano do tipo escolhido ou localização completos.",evidence.incomplete?"Conferir os campos ausentes por anúncio no relatório; não preencher com os filtros pesquisados.":"");
      add("availability","Existência dos links",evidence.unavailable?"fail":"pending",evidence.unavailable?evidence.unavailable+" link(s) informado(s) como indisponível(is).":"A resposta atual não comprova HTTP e conteúdo de cada anúncio. Um link indexado pode abrir uma página não encontrada.","Implementar verificação individual de link, página removida, bloqueio e conteúdo de recomendações; conferir a fonte antes de qualificar uma oportunidade.");
    });
  }else{
    add("inference","IA remota de verdade","pending","Não executada sem sessão/token válido e filtros completos.");
    add("search","Pesquisa autenticada","pending","Não executada sem sessão/token válido e filtros completos.");
  }
  add("writes","Gravação e administração","pending","Este diagnóstico só lê dados. Não testou gravação, aprovação, suspensão ou exclusão reais.","Validar esses fluxos separadamente com registros e contas de teste autorizados.");
  token="";session=null;
  report.finishedAt=new Date(now()).toISOString();
  report.summary={ok:0,fail:0,pending:0,blocked:0};
  for(const check of report.checks)report.summary[check.status]++;
  report.conclusion=report.summary.fail||report.summary.blocked?"Foram encontradas falhas ou bloqueios; o sistema completo não está comprovado.":"Há verificações pendentes; respostas HTTP válidas não comprovam o sistema completo.";
  onProgress(report);return report;
}

export function formatDiagnosticReport(report){
  const labels={ok:"OK",fail:"FALHA",pending:"PENDENTE",blocked:"BLOQUEADO"};
  return ["EVOLUTION RADAR IA — DIAGNÓSTICO "+report.diagnosticVersion,report.startedAt,
    report.conclusion||"Diagnóstico em execução", "Filtros: "+JSON.stringify(report.filters),
    ...report.checks.flatMap(x=>[labels[x.status]+" | "+x.label+" | "+x.note,...(x.next?["Próximo ajuste: "+x.next]:[])]),
    "Evidências por anúncio (links públicos; sem token, senha, e-mail ou UID):",
    JSON.stringify(report.evidence,null,2)].join("\n");
}
