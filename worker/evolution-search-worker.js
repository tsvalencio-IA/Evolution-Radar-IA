import {assessMunicipalityRadius} from "../public/br-municipios.mjs";
import {parseListingFacts,vehicleMatches} from "../public/listing-facts.mjs";
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
  // Mantém o administrador e permite usuários adicionais aprovados explicitamente.
  // ALLOWED_UIDS é opcional e deve ficar somente nos Secrets da Cloudflare.
  const allowed=new Set([
    String(env.ALLOWED_UID??"").trim(),
    ...String(env.ALLOWED_UIDS??"").split(/[,;\s]+/).map(x=>x.trim())
  ].filter(Boolean));
  if(!u||u.disabled||!u.localId)return null;
  // A conta do padrinho mantém acesso sem depender da nova estrutura.
  if(u.localId===String(env.ALLOWED_UID??"").trim())return u.localId;
  if(u.emailVerified!==true)return null;
  // A autorização da equipe vem da base; a revogação sempre prevalece
  // sobre listas antigas (ALLOWED_UIDS não pode contornar uma suspensão).
  const memberUrl="https://evolution-radar-ia-default-rtdb.firebaseio.com/"+
    "workspaces/evolution-motos/members/"+encodeURIComponent(u.localId)+
    ".json?auth="+encodeURIComponent(token);
  try{
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),6500);
    let membership;
    try{membership=await fetch(memberUrl,{signal:control.signal,cache:"no-store"});}
    finally{clearTimeout(timer);}
    if(!membership.ok)return null;
    const m=await membership.json();
    if(m?.status==="approved"&&m?.permissions?.search===true)return u.localId;
    if(m)return null;
    // Compatibilidade com autorizações manuais anteriores, somente se não
    // existir registro de suspensão/revogação para este UID.
    return allowed.has(u.localId)?u.localId:null;
  }catch{return null;}
}
// Filtra páginas de outros setores ANTES de mostrar resultados e consumir extração.
export function relevantMarketplacePage(item){
  if(!item || typeof item!=="object")return false;
  let u;try{u=new URL(String(item.url??""));}catch{return false;}
  if(u.protocol!=="https:" || !SOURCE_HOST_RE.test(u.hostname))return false;
  const path=normalized(decodeURIComponent(u.pathname));
  // Categorias incompatíveis com motocicletas. Não confundir anúncio de moto com catálogo genérico.
  if(/(?:^|\/)(?:imoveis|apartamentos?|casas?|celulares?|smartphones?|eletronicos|informatica|moda|roupas?|moveis|eletrodomesticos|terrenos?|carros|automoveis)(?:\/|$)/.test(path))return false;
  if(listingType(u.href)==="individual-candidate")return true;
  const title=normalized(item.title);
  const motorcycleTitle=/(?:^|\W)(?:moto|motos|motocicleta|motocicletas|honda|yamaha|suzuki|kawasaki|bajaj|dafra|shineray|triumph|bmw|factor|ninja|titan|fan|biz|fazer|ybr|cg)(?:$|\W)/.test(title);
  const motorcyclePath=/(?:^|\/)(?:motos?|motocicletas?)(?:\/|$)/.test(path);
  return motorcycleTitle||motorcyclePath;
}
function sources(results){
  if(!Array.isArray(results))return [];
  const dedupe=new Set();
  return results.flatMap(item=>{
    if(!item||typeof item!=="object")return [];
    let u;
    try{u=new URL(String(item.url??""));}catch{return [];}
    if(u.protocol!=="https:"||!SOURCE_HOST_RE.test(u.hostname))return [];
    if(!relevantMarketplacePage({url:u.href,title:item.title}))return [];
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
export function parseFacts(page,title,f){
  return parseListingFacts(page,f);
}
export function gradeListing(item,f){
  const found=item.fields||{},title=normalized(item.title),reject=[],pending=[];
  const vehicle=vehicleMatches(item,f);
  if(!vehicle.brand)pending.push("Marca não comprovada no anúncio");
  if(!vehicle.model){
    const expected=normalized(f.model).match(/^([a-z]+)\s*(\d{2,4})$/);
    const observed=expected&&title.match(new RegExp("\\b"+expected[1]+"\\s*(\\d{2,4})\\b"));
    if(observed&&observed[1]!==expected[2])reject.push("Cilindrada/modelo incompatível");
    else pending.push("Modelo exato não comprovado");
  }
  if(!vehicle.version){
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
  if(!found.city||!found.uf)pending.push("Cidade e UF não comprovadas no anúncio");
  else {
    const area=assessMunicipalityRadius(f,found.city,found.uf);
    if(area.status==="outside")reject.push("Município fora do raio solicitado (sedes municipais)");
    else if(area.status==="unknown")pending.push("Distância geográfica não verificável");
  }
  if(item.extractionStatus!=="extracted")pending.push("Página individual não extraída");
  return {bucket:reject.length?"outside":pending.length?"pending":"prequalified",
    reasons:reject.length?reject:pending.length?pending:["Dados da página sugerem compatibilidade; confirmar vendedor, documentação e disponibilidade"]};
}
export function searchPlan(f){
  const core=[text(f.brand),text(f.model),text(f.version)].filter(Boolean).join(" ");
  const city='"'+text(f.originCity).replace(/"/g,"")+'"';
  const years=[f.yearFrom,f.yearTo].filter(x=>isYear(x));
  const query1=[core,years[0]||"","site:olx.com.br",city,text(f.uf),"moto venda"].join(" ");
  const query2=[core,years[1]||years[0]||"","site:webmotors.com.br/comprar",city,text(f.uf)].join(" ");
  const middle=years.length===2?String(Math.floor((Number(years[0])+Number(years[1]))/2)):(years[0]||"");
  const query3=[core,middle,city,text(f.uf),"moto usada venda"].join(" ");
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
// Códigos deliberadamente genéricos: não expor texto externo de erro, URL privada,
// token ou inferir que um anúncio foi removido somente porque a extração falhou.
export function classifyExtractionFailure(reason){
  const value=String(reason??"").slice(0,400).toLowerCase();
  if(/\b(?:401|403)\b|access denied|forbidden|captcha|blocked|unauthorized/.test(value))return "EXTRACT_ACCESS_REPORTED";
  if(/\b(?:404|410)\b|not found|gone|removed/.test(value))return "EXTRACT_NOT_FOUND_REPORTED";
  if(/\b429\b|rate limit|too many requests|quota/.test(value))return "EXTRACT_RATE_LIMIT_REPORTED";
  if(/timed?\s*out|timeout|deadline/.test(value))return "EXTRACT_TIMEOUT_REPORTED";
  return value?"EXTRACT_OTHER_REPORTED":"EXTRACT_NO_DETAILS";
}
async function collect(f,env){
  const plan=searchPlan(f);
  const batches=await Promise.allSettled(plan.map(query=>tavilyCall("search",{
    query,search_depth:"basic",max_results:15,
    include_domains:ALLOWED_DOMAINS,include_answer:false,include_raw_content:false
  },env)));
  const succeeded=batches.filter(x=>x.status==="fulfilled").map(x=>x.value);
  let queriesSucceeded=succeeded.length;
  if(!succeeded.length)throw Error(batches[0]?.reason?.message||"Nenhuma consulta concluída");
  const raw=succeeded.flatMap(data=>Array.isArray(data.results)?data.results:[]);
  let pages=sources(raw);
  let recovered=false;
  if(!pages.some(x=>listingType(x.url)==="individual-candidate")){
    // Uma quarta busca focada só é consumida quando as buscas iniciais devolvem catálogos.
    recovered=true;
    const q=[text(f.brand),text(f.model),text(f.version),text(f.yearFrom||""),text(f.originCity),
      "site:olx.com.br", "R$", "km", "venda"].filter(Boolean).join(" ").slice(0,360);
    try{
      const next=await tavilyCall("search",{query:q,search_depth:"basic",max_results:15,
        include_domains:ALLOWED_DOMAINS,include_answer:false,include_raw_content:false},env);
      pages=sources([...raw,...(Array.isArray(next.results)?next.results:[])]);
      queriesSucceeded++;
    }catch{/* Mantém resultados anteriores e informa cobertura parcial. */}
  }
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
  // Tentativa avançada opcional e limitada a UM URL por pesquisa.
  // Desligada por padrão: exige opção explícita TAVILY_ADVANCED_RETRY=true
  // no ambiente de teste/autorizado por consumir créditos adicionais.
  let advancedRetryAttempted=0,advancedRetrySucceeded=0;
  if(env.TAVILY_ADVANCED_RETRY==="true"&&selected.length){
    const missing=selected.filter(x=>!extracted.some(result=>result.url===x.url&&String(result.raw_content??"").trim())).slice(0,1);
    if(missing.length){
      advancedRetryAttempted=1;
      try{
        const recovered=await tavilyCall("extract",{urls:[missing[0].url],extract_depth:"advanced",
          include_images:false,format:"markdown"},env);
        const recoveredContent=(Array.isArray(recovered.results)?recovered.results:[])
          .find(x=>x.url===missing[0].url&&String(x.raw_content??"").trim());
        if(recoveredContent){
          advancedRetrySucceeded=1;
          extracted=extracted.filter(x=>x.url!==missing[0].url).concat(recoveredContent);
          failures=failures.filter(x=>x.url!==missing[0].url);
        }else{
          const retried=Array.isArray(recovered.failed_results)?recovered.failed_results:[];
          failures=failures.filter(x=>x.url!==missing[0].url).concat(
            retried.length?retried:[{url:missing[0].url,error:"advanced_empty"}]);
        }
      }catch(e){
        failures=failures.filter(x=>x.url!==missing[0].url).concat({url:missing[0].url,error:String(e.message)});
      }
    }
  }
  const bodies=new Map(extracted.filter(x=>typeof x?.url==="string").map(x=>[x.url,String(x.raw_content??"")]));
  const errors=new Map(failures.filter(x=>typeof x?.url==="string").map(x=>
    [x.url,classifyExtractionFailure(x.error??x.message??x.reason)]));
  const attempted=new Set(selected.map(x=>x.url));
  const individual=candidates.map(x=>{
    const content=bodies.get(x.url),done=!!content,wasAttempted=attempted.has(x.url);
    const failureCode=wasAttempted&&!done
      ?errors.get(x.url)??(bodies.has(x.url)?"EXTRACT_EMPTY_CONTENT":"EXTRACT_NO_DETAILS")
      :null;
    const item={...x,extractionStatus:done?"extracted":wasAttempted?"failed":"not-attempted",
      extractionFailureCode:failureCode,
      fields:done?parseFacts(content,x.title,f):{price:null,km:null,yearMake:null,yearModel:null,city:null,uf:null}};
    item.assessment=gradeListing(item,f);
    return item;
  });
  const extractionFailureReasons={};
  for(const item of individual){
    if(!item.extractionFailureCode)continue;
    const code=item.extractionFailureCode;
    extractionFailureReasons[code]=(extractionFailureReasons[code]??0)+1;
  }
  const priority={prequalified:0,pending:1,outside:2};
  individual.sort((a,b)=>(priority[a.assessment.bucket]??8)-(priority[b.assessment.bucket]??8));
  const catalogs=listed.filter(x=>x.pageType==="catalog").slice(0,5).map(x=>({...x,
    assessment:{bucket:"catalog",reasons:["Página de resultados; nenhuma moto individual confirmada"]}}));
  return {source:"Tavily",query:plan[0],queries:plan,checkedAt:new Date().toISOString(),evidence:"index",
    items:[...individual,...catalogs].slice(0,20),coverage:{
      queriesAttempted:plan.length+(recovered?1:0),queriesSucceeded,indexedLinks:listed.length,
      individualLinks:individual.length,catalogPages:catalogs.length,
      extractionAttempted:selected.length,extractionSucceeded:individual.filter(x=>x.extractionStatus==="extracted").length,
      extractionFailures:individual.filter(x=>x.extractionStatus==="failed").length,
      extractionFailureReasons,advancedRetryAttempted,advancedRetrySucceeded,
      prequalified:individual.filter(x=>x.assessment.bucket==="prequalified").length,
      regionRadiusVerified:false,regionRadiusMethod:"approximate-municipal-centers"
    },notice:"Resultado indexado ou extraído de página. Não comprova disponibilidade, documentação ou distância de rota."};
}


// Interpretação de pedido por IA: retorna apenas campos estruturados e jamais confirma anúncios.
const intentCache=new Map();
export function safeIntent(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
  const out={};
  for(const key of ["brand","model","version","originCity"]){
    if(typeof raw[key]==="string"&&raw[key].trim())out[key]=raw[key].trim().slice(0,100);
  }
  const uf=String(raw.uf??"").trim().toUpperCase();
  if(/^[A-Z]{2}$/.test(uf))out.uf=uf;
  if(raw.yearType==="make"||raw.yearType==="model")out.yearType=raw.yearType;
  if(["all","particular","loja"].includes(raw.sellerType))out.sellerType=raw.sellerType;
  for(const key of ["yearFrom","yearTo"]){
    if(/^(19|20)\d{2}$/.test(String(raw[key]??"")))out[key]=String(raw[key]);
  }
  for(const key of ["priceMin","priceMax","kmMax","radiusKm"]){
    const value=raw[key];
    if(value===null||value===undefined||value==="")continue;
    if((typeof value==="number"||typeof value==="string")&&/^\d+(?:\.\d+)?$/.test(String(value))&&Number.isFinite(Number(value))&&Number(value)>=0){
      out[key]=String(value);
    }
  }
  return out;
}
export function intentText(result){
  const value=result?.choices?.[0]?.message?.content??result?.response??result?.result?.response;
  if(typeof value==="string")return value;
  if(Array.isArray(value))return value.map(x=>typeof x==="string"?x:String(x?.text??"")).join("");
  if(value&&typeof value==="object"&&!Array.isArray(value))return JSON.stringify(value);
  return "";
}
async function interpretRequest(message,uid,env){
  if(!env.AI?.run)return response({error:"Workers AI ainda não foi vinculado ao Worker publicado."},503);
  const prompt=String(message??"").trim();
  if(prompt.length<5||prompt.length>450)return response({error:"Descreva a moto em até 450 caracteres."},400);
  const cacheKey=uid+":"+prompt.toLocaleLowerCase("pt-BR");
  const saved=intentCache.get(cacheKey);
  if(saved&&Date.now()-saved.time<600000)return response({...saved.data,cache:true});
  try{
    const model=await env.AI.run("@cf/zai-org/glm-4.7-flash",{
      messages:[
        {role:"system",content:"Você extrai exclusivamente filtros de pesquisa de motos usadas de um pedido em português brasileiro. Responda APENAS com um objeto JSON válido sem markdown, sem texto adicional, com as chaves opcionais: brand, model, version, yearType (model ou make), yearFrom, yearTo, priceMin, priceMax, kmMax, originCity, uf, radiusKm, sellerType (all, particular, loja). Nunca invente filtros ausentes. Se o pedido citar um único ano, use yearFrom e yearTo iguais. Dinheiro em reais como número simples (ex: oito mil = 8000). Cidade e UF apenas se explicitamente fornecidas ou inequivocamente identificáveis pelo nome geográfico. Se estiver ambíguo, omita o campo."},
        {role:"user",content:prompt}
      ],
      // A GLM usa raciocínio por padrão. Desativá-lo evita consumir o limite
      // de saída com pensamento oculto, deixando apenas o JSON solicitado.
      chat_template_kwargs:{enable_thinking:false},
      response_format:{type:"json_object"},
      max_completion_tokens:650,temperature:0,stream:false
    });
    const raw=intentText(model),start=raw.indexOf("{"),end=raw.lastIndexOf("}");
    if(start<0||end<=start)throw Error("AI_EMPTY_RESPONSE");
    let parsed;
    try{parsed=JSON.parse(raw.slice(start,end+1));}catch{throw Error("AI_INVALID_JSON");}
    const filters=safeIntent(parsed);
    if(!filters.brand||!filters.model)throw Error("AI_INCOMPLETE_FILTERS");
    const data={filters,mode:"workers-ai",model:"glm-4.7-flash",notice:"Filtros interpretados por IA; confira os campos antes de considerar qualquer anúncio."};
    if(intentCache.size>30)intentCache.clear();
    intentCache.set(cacheKey,{time:Date.now(),data});
    return response({...data,cache:false});
  }catch(e){
    // Resposta padronizada: nenhuma credencial, texto do usuário ou resposta bruta
    // do modelo é exposta. O código distingue erro do modelo de erro de formato.
    const rawCode=String(e?.message||"");
    const code=rawCode==="AI_EMPTY_RESPONSE"?"AI_EMPTY_RESPONSE":
      rawCode==="AI_INVALID_JSON"?"AI_INVALID_JSON":
      rawCode==="AI_INCOMPLETE_FILTERS"?"AI_INCOMPLETE_FILTERS":
      /quota|rate limit|429|capacity|3040/i.test(rawCode)?"AI_CAPACITY_LIMIT":
      "AI_INFERENCE_FAILED";
    const reason={
      AI_EMPTY_RESPONSE:"O modelo respondeu sem texto utilizável.",
      AI_INVALID_JSON:"O modelo retornou uma resposta que não é JSON válido.",
      AI_INCOMPLETE_FILTERS:"A IA não conseguiu identificar com segurança a marca e o modelo.",
      AI_CAPACITY_LIMIT:"O serviço gratuito de IA atingiu um limite ou está sem capacidade.",
      AI_INFERENCE_FAILED:"Falha de inferência da Cloudflare. Consulte o log do Worker se persistir."
    }[code];
    console.error("Evolution Radar /interpret:",code,rawCode.slice(0,180));
    return response({error:"Interpretação pela IA não concluída.",code,detail:reason},code==="AI_CAPACITY_LIMIT"?503:502);
  }
}

// Exclusão REAL do Firebase Authentication: só servidor, com conta de serviço
// limitada ao projeto e guardada no Secret FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON.
const uidPattern=/^[A-Za-z0-9_-]{12,128}$/;
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
async function firebaseAdminToken(env){
  if(!env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)throw Error("ADMIN_CREDENTIALS_MISSING");
  let credentials;
  try{credentials=JSON.parse(env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);}catch{throw Error("ADMIN_CREDENTIALS_INVALID");}
  if(credentials.project_id!=="evolution-radar-ia"||typeof credentials.client_email!=="string"||
    typeof credentials.private_key!=="string"||credentials.token_uri!=="https://oauth2.googleapis.com/token")
    throw Error("ADMIN_CREDENTIALS_INVALID");
  const pem=credentials.private_key.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/);
  if(!pem)throw Error("ADMIN_CREDENTIALS_INVALID");
  const bytes=Uint8Array.from(atob(pem[1].replace(/\s+/g,"")),v=>v.charCodeAt(0));
  const key=await crypto.subtle.importKey("pkcs8",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const now=Math.floor(Date.now()/1000),encoder=new TextEncoder();
  const header=b64url(encoder.encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const claim=b64url(encoder.encode(JSON.stringify({
    iss:credentials.client_email,scope:"https://www.googleapis.com/auth/identitytoolkit",
    aud:credentials.token_uri,iat:now,exp:now+1200
  })));
  const signed=header+"."+claim,signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,encoder.encode(signed));
  const body=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:signed+"."+b64url(new Uint8Array(signature))});
  const oauth=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});
  const token=await oauth.json();
  if(!oauth.ok||typeof token.access_token!=="string")throw Error("ADMIN_OAUTH_FAILED");
  return token.access_token;
}
const authAdminEndpoint=method=>"https://identitytoolkit.googleapis.com/v1/projects/evolution-radar-ia/accounts:"+method;
async function adminApi(method,accessToken,body){
  const result=await fetch(authAdminEndpoint(method),{method:"POST",
    headers:{"Authorization":"Bearer "+accessToken,"Content-Type":"application/json"},
    body:JSON.stringify(body)});
  const data=await result.json().catch(()=>({}));
  if(!result.ok)throw Error("FIREBASE_AUTH_"+method.toUpperCase()+"_"+String(data.error?.message||result.status).slice(0,70));
  return data;
}
const dbUrl=path=>"https://evolution-radar-ia-default-rtdb.firebaseio.com/"+path+".json";
async function ownerDb(method,path,token,body){
  const url=dbUrl(path)+"?auth="+encodeURIComponent(token);
  const result=await fetch(url,{method,headers:{"Content-Type":"application/json"},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!result.ok)throw Error("DATABASE_"+method+"_"+result.status);
  return result.json().catch(()=>null);
}
async function deleteRegisteredUser(payload,token,env){
  const uid=String(payload?.uid||""),email=String(payload?.email||"").trim().toLowerCase();
  if(!uidPattern.test(uid)||!email||email.length>254||payload?.confirmation!=="EXCLUIR")
    return response({error:"Confirmação inválida.",code:"DELETE_CONFIRMATION_INVALID"},400);
  if(uid===env.ALLOWED_UID)return response({error:"A conta principal está protegida.",code:"OWNER_PROTECTED"},403);
  if(!env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)
    return response({error:"Exclusão de contas ainda não configurada no servidor.",code:"ADMIN_CREDENTIALS_MISSING"},503);
  let accessToken;
  try{
    const registry=await ownerDb("GET","registrationRequests/"+uid,token);
    if(!registry||registry.sponsorUid!==env.ALLOWED_UID||String(registry.email||"").toLowerCase()!==email)
      return response({error:"Colaborador não pertence a esta equipe.",code:"MEMBER_NOT_FOUND"},404);
    accessToken=await firebaseAdminToken(env);
    const account=await adminApi("lookup",accessToken,{localId:[uid]});
    if(account.users?.length!==1||String(account.users[0].email||"").toLowerCase()!==email)
      return response({error:"Identidade não confere. Nenhuma conta foi excluída.",code:"ACCOUNT_MISMATCH"},409);
    // Bloquear imediatamente o acesso antes da exclusão, preservando registros coletivos.
    const member=await ownerDb("GET","workspaces/evolution-motos/members/"+uid,token);
    if(member)await ownerDb("PATCH","workspaces/evolution-motos/members/"+uid,token,{
      status:"revoked",reviewedBy:env.ALLOWED_UID,reviewedAt:{".sv":"timestamp"}
    });
    await ownerDb("PATCH","registrationRequests/"+uid,token,{
      status:"revoked",reviewedBy:env.ALLOWED_UID,reviewedAt:{".sv":"timestamp"}
    });
    // Exclusão definitiva: API administrativa do Firebase Auth.
    await adminApi("delete",accessToken,{localId:uid});
  }catch(error){
    const code=String(error.message||"DELETE_FAILED");
    const status=code==="ADMIN_CREDENTIALS_INVALID"||code==="ADMIN_OAUTH_FAILED"?503:502;
    return response({error:"Conta não excluída do Firebase Authentication.",code,detail:"Verifique as credenciais e permissões do serviço administrativo."},status);
  }
  // Após o Auth confirmar a exclusão, limpar somente o cadastro e o vínculo.
  // Preservar oportunidades, buscas, auditoria e dados privados legados.
  const incomplete=[];
  for(const path of ["workspaces/evolution-motos/members/"+uid,"registrationRequests/"+uid]){
    try{await ownerDb("DELETE",path,token);}catch{incomplete.push(path.includes("members")?"member":"registration");}
  }
  try{
    await ownerDb("POST","workspaces/evolution-motos/adminAudit",token,{
      action:"delete",actorUid:env.ALLOWED_UID,targetUid:uid,at:{".sv":"timestamp"}
    });
  }catch{incomplete.push("audit");}
  if(incomplete.length)return response({deletedAuth:true,deleted:false,
    error:"Conta removida do Firebase Authentication, mas a limpeza administrativa não foi concluída.",
    code:"PARTIAL_DELETE",pending:incomplete},207);
  return response({deletedAuth:true,deleted:true,uid});
}

export default {
  async fetch(request,env){
    if(request.method==="GET"&&new URL(request.url).pathname==="/health")
      return response({service:"Evolution Radar IA",version:"2026-11-12.5",capabilities:["search","interpret","municipal-radius","account-deletion"],radiusMethod:"approximate-municipal-centers",status:"online",aiBinding:env.AI?.run?"connected":"missing",aiInference:"not-tested-by-health",accountDeletionConfigured:!!env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON});
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
    const endpoint=new URL(request.url).pathname;
    if(!["/search","/interpret","/admin/delete-user"].includes(endpoint)||request.method!=="POST")return response({error:"Endpoint inexistente"},404);
    if(request.headers.get("Origin")!==ORIGIN)return response({error:"Origem não autorizada"},403);
    if(!env.ALLOWED_UID||!env.FIREBASE_WEB_API_KEY||(endpoint==="/search"&&!env.TAVILY_API_KEY))return response({error:"Conector não configurado"},503);
    const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    if(token.length<100||token.length>5000)return response({error:"Login obrigatório"},401);
    let valid;
    try{valid=await authenticate(token,env)}catch{return response({error:"Falha na validação do login"},502);}
    if(!valid)return response({error:"Usuário não autorizado"},403);
    if(endpoint==="/admin/delete-user"&&valid!==String(env.ALLOWED_UID))return response({error:"Somente o administrador pode excluir contas."},403);
    let payload;
    try{if(Number(request.headers.get("Content-Length")||0)>4000)return response({error:"Requisição muito grande"},413);payload=await request.json();}catch{return response({error:"JSON inválido"},400);}
    if(endpoint==="/admin/delete-user")return deleteRegisteredUser(payload,token,env);
    if(endpoint==="/interpret")return interpretRequest(payload?.message,valid,env);
    if(!validFilters(payload?.filters))return response({error:"Informe marca, modelo, cidade e UF válidos"},400);
    // Limite de consumo: cada consulta faz até 3 buscas básicas e até 5 extrações básicas.
    // Repetições no mesmo isolate dentro de 10 min usam cache após validar Firebase.
    const f=payload.filters;
    const cacheKey=JSON.stringify([f.brand,f.model,f.version,f.yearType,f.yearFrom,f.yearTo,f.priceMin,f.priceMax,f.kmMax,f.originCity,f.uf,f.radiusKm,f.sellerType]);
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
