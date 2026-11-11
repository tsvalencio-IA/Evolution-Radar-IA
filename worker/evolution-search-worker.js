/* Evolution Radar IA — Cloudflare Worker
 * Implantação pelo painel da Cloudflare, sem terminal.
 * Segredos obrigatórios no Worker (Settings > Variables and Secrets):
 * TAVILY_API_KEY, ALLOWED_UID. Variável não secreta FIREBASE_WEB_API_KEY.
 * Nenhuma chave é enviada ao navegador ou registrada nos resultados.
 */
const ORIGIN="https://tsvalencio-ia.github.io";
const ALLOWED_DOMAINS=["olx.com.br","webmotors.com.br","mercadolivre.com.br","napista.com.br"];
const SOURCE_HOST_RE=/(^|\.)((olx\.com\.br)|(webmotors\.com\.br)|(mercadolivre\.com\.br)|(napista\.com\.br))$/i;
const cors={"Access-Control-Allow-Origin":ORIGIN,"Vary":"Origin","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"};
const response=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors}});
const text=x=>String(x??"").trim().slice(0,100);
const isYear=x=>Number.isInteger(Number(x)) && Number(x)>=1950 && Number(x)<=2100;
function queryFor(f){
  const bits=[f.brand,f.model,f.version].map(text).filter(Boolean);
  if(isYear(f.yearFrom))bits.push(String(Number(f.yearFrom)));
  if(isYear(f.yearTo)&&String(f.yearTo)!==String(f.yearFrom))bits.push(String(Number(f.yearTo)));
  if(f.originCity)bits.push(text(f.originCity));
  if(f.uf)bits.push(text(f.uf).toUpperCase());
  bits.push("moto usada venda");
  return bits.join(" ").slice(0,360);
}
function validFilters(f){
  if(!f||typeof f!=="object"||Array.isArray(f))return false;
  if(!text(f.brand)||!text(f.model)||!text(f.originCity)||!text(f.uf))return false;
  if(!/^[a-z]{2}$/i.test(text(f.uf)))return false;
  if(f.yearFrom&&!isYear(f.yearFrom))return false;
  if(f.yearTo&&!isYear(f.yearTo))return false;
  if(f.yearFrom&&f.yearTo&&Number(f.yearFrom)>Number(f.yearTo))return false;
  for(const name of ["priceMin","priceMax","kmMax","radiusKm"]){
    if(f[name]!==""&&f[name]!==undefined&&f[name]!==null&&(!Number.isFinite(Number(f[name]))||Number(f[name])<0))return false;
  }
  if(f.priceMin&&f.priceMax&&Number(f.priceMin)>Number(f.priceMax))return false;
  return true;
}
async function authenticate(token,env){
  const result=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({idToken:token})
  });
  if(!result.ok)return null;
  const data=await result.json();
  const u=data.users?.[0];
  if(!u||u.disabled||u.localId!==env.ALLOWED_UID)return null;
  return u.localId;
}
function sources(results){
  if(!Array.isArray(results))return [];
  const dedupe=new Set();
  return results.flatMap(item=>{
    if(!item||typeof item!=="object")return [];
    let u;
    try{u=new URL(String(item.url??""));}catch{return [];}
    if(u.protocol!=="https:"||!SOURCE_HOST_RE.test(u.hostname))return [];
    u.hash="";
    for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid$|gclid$)/i.test(k))u.searchParams.delete(k);
    if(dedupe.has(u.href))return [];dedupe.add(u.href);
    return [{title:String(item.title??"").slice(0,160),url:u.href,content:String(item.content??"").slice(0,800)}];
  }).slice(0,60);
}

// Pesquisa em duas fases: descobrir URLs; extrair somente anúncios individuais.
// Dados incompletos sempre permanecem pendentes. Nenhum resultado equivale a compra aprovada.
const searchMemory=new Map();
export function listingType(url){
  let u;try{u=new URL(url);}catch{return "unknown";}
  const path=u.pathname.replace(/\/+$/,"");
  if(/(^|\.)olx\.com\.br$/i.test(u.hostname))
    return /[-/]\d{9,}$/.test(path)&&path.includes("/autos-e-pecas/motos/")?"individual-candidate":"catalog";
  if(/(^|\.)webmotors\.com\.br$/i.test(u.hostname))
    return /^\/comprar\/.+\/\d{5,}$/i.test(path)?"individual-candidate":"catalog";
  if(/(^|\.)mercadolivre\.com\.br$/i.test(u.hostname))
    return /(?:^|[-/])MLB-?\d{7,}$/i.test(path)?"individual-candidate":"catalog";
  return "catalog";
}
function marketplace(url){
  const h=new URL(url).hostname;
  if(h.endsWith("olx.com.br"))return "OLX";
  if(h.endsWith("webmotors.com.br"))return "Webmotors";
  if(h.endsWith("mercadolivre.com.br"))return "Mercado Livre";
  return "NaPista";
}
function normalized(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
function numeric(v){
  let s=String(v??"").replace(/[^\d.,]/g,"");
  if(!s)return null;
  if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",",".");
  else if(s.includes(","))s=s.replace(",",".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  const n=Number(s);return Number.isFinite(n)&&n>=0?n:null;
}
function uniqueNumber(matches){
  const entries=matches.map(m=>numeric(m[1])).filter(n=>n!==null);
  const distinct=[...new Set(entries)];
  return distinct.length===1?distinct[0]:null;
}
export function parseFacts(page,title,f){
  const t=String(page??"").slice(0,6500);
  const price=uniqueNumber([
    ...t.matchAll(/(?:pre[cç]o|valor(?:\s+total)?|à vista|a vista)\s*[:\n-]?\s*R\$\s*([\d.,]+)/gi),
    ...t.matchAll(/R\$\s*([\d.,]+)\s*(?:a vista|à vista)/gi)
  ]);
  const km=uniqueNumber([
    ...t.matchAll(/(?:quilometragem|km rodados|hod[oô]metro|km)\s*[:\n-]?\s*([\d.,]+)\s*(?:km)?\b/gi),
    ...t.matchAll(/\b([\d.,]+)\s*km(?:\s+rodados)?\b/gi)
  ]);
  const yearPairs=[...t.matchAll(/\b((?:19|20)\d{2})\s*\/\s*((?:19|20)\d{2})\b/g)].map(m=>m[1]+"/"+m[2]);
  const uniqueYears=[...new Set(yearPairs)];
  const match=uniqueYears.length===1?uniqueYears[0].split("/").map(Number):null;
  const city=normalized(f.originCity),body=normalized(t);
  // Só a ocorrência na localização da página comprova a cidade.
  const pos=body.indexOf(city);
  const nearby=pos>=0?body.slice(Math.max(0,pos-45),pos):"";
  const cityConfirmed=city.length>2&&/(?:localizacao|cidade|municipio|endereco)\s*[:\-\s]{0,12}$/.test(nearby);
  return {
    price,km,yearMake:match?match[0]:null,yearModel:match?match[1]:null,
    city:cityConfirmed?f.originCity:null,uf:cityConfirmed?f.uf:null
  };
}
export function gradeListing(item,f){
  const found=item.fields||{},title=normalized(item.title),reject=[],pending=[];
  const contains=v=>title.includes(normalized(v));
  if(f.brand&&!contains(f.brand))pending.push("Marca não comprovada no título");
  if(f.model&&!normalized(f.model).split(" ").every(w=>title.includes(w)))pending.push("Modelo exato não comprovado");
  if(f.version&&!contains(f.version)){
    if(/\b(fan|start|titan|cargo)\b/.test(title))reject.push("Versão aparentemente diferente");
    else pending.push("Versão não comprovada");
  }
  const y=f.yearType==="make"?found.yearMake:found.yearModel;
  if(f.yearFrom||f.yearTo){
    if(y===null||y===undefined)pending.push("Ano de "+(f.yearType==="make"?"fabricação":"modelo")+" não comprovado");
    else if((f.yearFrom&&y<Number(f.yearFrom))||(f.yearTo&&y>Number(f.yearTo)))reject.push("Ano fora da faixa");
  }
  if(f.priceMax){
    if(found.price===null||found.price===undefined)pending.push("Preço total não comprovado");
    else if(found.price>Number(f.priceMax))reject.push("Preço acima do limite");
  }
  if(f.priceMin){
    if(found.price===null||found.price===undefined)pending.push("Preço mínimo não comprovado");
    else if(found.price<Number(f.priceMin))reject.push("Preço abaixo do mínimo");
  }
  if(f.kmMax){
    if(found.km===null||found.km===undefined)pending.push("Quilometragem não comprovada");
    else if(found.km>Number(f.kmMax))reject.push("KM acima do limite");
  }
  if(!found.city)pending.push("Localização não comprovada no anúncio");
  if(f.radiusKm&&found.city&&normalized(found.city)!==normalized(f.originCity))
    pending.push("Distância rodoviária não verificada");
  if(item.extractionStatus!=="extracted")pending.push("Página individual não extraída");
  return {bucket:reject.length?"outside":pending.length?"pending":"prequalified",
    reasons:reject.length?reject:pending.length?pending:["Dados da página sugerem compatibilidade; confirmar vendedor, documentação e disponibilidade"]};
}
export function searchPlan(f){
  const core=[text(f.brand),text(f.model),text(f.version)].filter(Boolean).join(" ");
  const city='"'+text(f.originCity).replace(/"/g,"")+'"';
  const years=[f.yearFrom,f.yearTo].filter(x=>isYear(x));
  const query1=[core,years[0]||"","site:sp.olx.com.br/autos-e-pecas/motos",city,text(f.uf)].join(" ");
  const query2=[core,years[1]||years[0]||"","site:webmotors.com.br/comprar",city,text(f.uf)].join(" ");
  const middle=years.length===2&&Number(years[1])-Number(years[0])<=8?String(Math.floor((Number(years[0])+Number(years[1]))/2)):(years[0]||"");
  const query3=[core,middle,city,text(f.uf),"-Fan -Start moto venda"].join(" ");
  return [...new Set([query1,query2,query3].map(x=>x.slice(0,360)))];
}
async function tavilyCall(endpoint,body,env){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),18000);
  try{
    const r=await fetch("https://api.tavily.com/"+endpoint,{
      method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+env.TAVILY_API_KEY},
      body:JSON.stringify(body),signal:ac.signal});
    if(!r.ok)throw Error(r.status===429?"Cota de pesquisa atingida":"Erro externo HTTP "+r.status);
    return await r.json();
  }finally{clearTimeout(timer);}
}
async function collect(f,env){
  const plan=searchPlan(f);
  const batches=await Promise.allSettled(plan.map(query=>tavilyCall("search",{
    query,search_depth:"basic",max_results:15,
    include_domains:ALLOWED_DOMAINS,include_answer:false,include_raw_content:false
  },env)));
  const succeeded=batches.filter(x=>x.status==="fulfilled").map(x=>x.value);
  if(!succeeded.length)throw Error(batches[0]?.reason?.message||"Nenhuma consulta concluída");
  const raw=succeeded.flatMap(data=>Array.isArray(data.results)?data.results:[]);
  const pages=sources(raw);
  const listed=pages.map(x=>({...x,pageType:listingType(x.url),source:marketplace(x.url),
      evidence:"index",extractionStatus:"not-attempted"}));
  const candidates=listed.filter(x=>x.pageType==="individual-candidate");
  let extracted=[],failures=[];
  const selected=candidates.slice(0,5);
  if(selected.length){
    try{
      const r=await tavilyCall("extract",{urls:selected.map(x=>x.url),extract_depth:"basic",
        include_images:false,format:"markdown"},env);
      extracted=Array.isArray(r.results)?r.results:[];
      failures=Array.isArray(r.failed_results)?r.failed_results:[];
    }catch(e){failures=selected.map(x=>({url:x.url,error:String(e.message)}));}
  }
  const bodies=new Map(extracted.map(x=>[x.url,String(x.raw_content??"")]));
  const individual=candidates.map(x=>{
    const content=bodies.get(x.url),done=!!content;
    const item={...x,extractionStatus:done?"extracted":selected.some(v=>v.url===x.url)?"failed":"not-attempted",
      fields:done?parseFacts(content,x.title,f):{price:null,km:null,yearMake:null,yearModel:null,city:null,uf:null}};
    item.assessment=gradeListing(item,f);
    return item;
  });
  const priority={prequalified:0,pending:1,outside:2};
  individual.sort((a,b)=>(priority[a.assessment.bucket]??8)-(priority[b.assessment.bucket]??8));
  const catalogs=listed.filter(x=>x.pageType==="catalog").map(x=>({...x,
    assessment:{bucket:"catalog",reasons:["Página de resultados; nenhuma moto individual confirmada"]}}));
  return {source:"Tavily",query:plan[0],queries:plan,checkedAt:new Date().toISOString(),evidence:"index",
    items:[...individual,...catalogs].slice(0,20),coverage:{
      queriesAttempted:plan.length,queriesSucceeded:succeeded.length,indexedLinks:listed.length,
      individualLinks:individual.length,catalogPages:catalogs.length,
      extractionAttempted:selected.length,extractionSucceeded:extracted.length,extractionFailures:failures.length,
      prequalified:individual.filter(x=>x.assessment.bucket==="prequalified").length,
      regionRadiusVerified:false
    },notice:"Resultado indexado ou extraído de página. Não comprova disponibilidade, documentação ou distância de rota."};
}

export default {
  async fetch(request,env){
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
    if(new URL(request.url).pathname!=="/search"||request.method!=="POST")return response({error:"Endpoint inexistente"},404);
    if(request.headers.get("Origin")!==ORIGIN)return response({error:"Origem não autorizada"},403);
    if(!env.TAVILY_API_KEY||!env.ALLOWED_UID||!env.FIREBASE_WEB_API_KEY)return response({error:"Conector não configurado"},503);
    const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    if(token.length<100||token.length>5000)return response({error:"Login obrigatório"},401);
    let valid;
    try{valid=await authenticate(token,env)}catch{return response({error:"Falha na validação do login"},502);}
    if(!valid)return response({error:"Usuário não autorizado"},403);
    let payload;
    try{if(Number(request.headers.get("Content-Length")||0)>4000)return response({error:"Requisição muito grande"},413);payload=await request.json();}catch{return response({error:"JSON inválido"},400);}
    if(!validFilters(payload?.filters))return response({error:"Informe marca, modelo, cidade e UF válidos"},400);
    // Limite de consumo: cada consulta faz até 3 buscas básicas e até 5 extrações básicas.
    // Repetições no mesmo isolate dentro de 10 min usam cache após validar Firebase.
    const f=payload.filters;
    const cacheKey=JSON.stringify([f.brand,f.model,f.version,f.yearFrom,f.yearTo,f.priceMin,f.priceMax,f.kmMax,f.originCity,f.uf,f.radiusKm,f.sellerType]);
    const entry=searchMemory.get(cacheKey);
    if(entry&&Date.now()-entry.time<600000)return response({...entry.data,cache:true});
    try{
      const data=await collect(f,env);
      if(searchMemory.size>40)searchMemory.clear();
      searchMemory.set(cacheKey,{time:Date.now(),data});
      return response({...data,cache:false});
    }catch(e){return response({error:"Consulta externa não concluída: "+text(e?.message||"erro",160)},502);}
  }
};
