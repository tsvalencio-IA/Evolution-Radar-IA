import {nearbyMunicipalities} from "../public/br-municipios.mjs";
import {classifySearchPage,marketplaceName,relevantSearchPage} from "../public/search-engine.mjs";
import {parseListingFacts} from "../public/listing-facts.mjs";
import {primaryPageText,detectPageState,parseStructuredListingEvidence,mergeListingEvidence,listingIdentity} from "../public/page-evidence.mjs";

export const SEARCH_BUDGET=Object.freeze({searches:4,extractionUrls:5,publicPages:5,deadlineMs:45000});
const PIPELINE_DOMAINS=["olx.com.br","webmotors.com.br","mercadolivre.com.br","napista.com.br"];
const pipelineText=x=>String(x??"").trim().slice(0,100).replace(/["()]/g,"");
function allowedListing(value){
  try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&PIPELINE_DOMAINS.some(d=>u.hostname===d||u.hostname.endsWith("."+d))&&classifySearchPage(u.href)==="individual-candidate";}catch{return false;}
}
function canonicalCandidate(value){
  try{const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||!PIPELINE_DOMAINS.some(d=>u.hostname===d||u.hostname.endsWith("."+d)))return "";
    u.hash="";for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid$|gclid$|ref$)/i.test(key))u.searchParams.delete(key);
    return u.href;
  }catch{return "";}
}
export function planQueries(f){
  const core=[f.brand,f.model,f.version].map(pipelineText).filter(Boolean).join(" ");
  const years=[f.yearFrom,f.yearTo].filter(v=>/^(?:19|20)\d{2}$/.test(String(v))),middle=years.length===2?String(Math.floor((Number(years[0])+Number(years[1]))/2)):years[0]||"";
  const city='"'+pipelineText(f.originCity)+'"',near=nearbyMunicipalities(f,2).map(p=>'"'+p.name+'"');
  return [[core,years[0]||"","site:olx.com.br",city,f.uf,"moto venda"],
    [core,years[1]||years[0]||"","site:webmotors.com.br/comprar",city,f.uf],
    [core,middle,near.length?"("+[city,...near].join(" OR ")+")":city,f.uf,"moto usada anuncio individual"]]
    .map(parts=>parts.filter(Boolean).join(" ").slice(0,360));
}
function pipelineFailure(code,status=0){const error=Error(code);error.code=code;error.status=status;return error;}
export async function readLimitedBody(response,maxBytes=250000){
  if(!response.body?.getReader){const value=await response.text();return {text:value.slice(0,maxBytes),truncated:value.length>maxBytes};}
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text="",truncated=false;
  try{while(true){const step=await reader.read();if(step.done)break;const remaining=maxBytes-bytes;
    if(step.value.length>remaining){text+=decoder.decode(step.value.slice(0,remaining),{stream:true});truncated=true;break;}
    bytes+=step.value.length;text+=decoder.decode(step.value,{stream:true});}
    text+=decoder.decode();
  }finally{try{await reader.cancel();}catch{}}
  return {text,truncated};
}
export async function inspectPublicPage(url,{fetchImpl=fetch,timeoutMs=5500}={}){
  const checkedAt=new Date().toISOString();
  if(!allowedListing(url))return {availability:{status:"unverified",reason:"URL_NOT_ALLOWED",checkedAt},html:""};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    // Somente páginas públicas, sem cookies, credenciais, login ou camuflagem de cliente.
    const response=await fetchImpl(url,{method:"GET",redirect:"manual",credentials:"omit",headers:{Accept:"text/html,application/xhtml+xml"},signal:controller.signal});
    if(response.status>=300&&response.status<400)return {availability:{status:"unverified",reason:"REDIRECT_REQUIRES_REVIEW",httpStatus:response.status,checkedAt},html:""};
    if([404,410,401,403,429].includes(response.status))return {availability:{...detectPageState("",response.status),httpStatus:response.status,checkedAt},html:""};
    if(!/text\/(?:html|plain)|application\/xhtml\+xml/i.test(response.headers.get("Content-Type")||""))return {availability:{status:"unverified",reason:"UNEXPECTED_CONTENT_TYPE",httpStatus:response.status,checkedAt},html:""};
    if(response.url&&listingIdentity(response.url)!==listingIdentity(url))return {availability:{status:"unverified",reason:"LISTING_ID_MISMATCH",checkedAt},html:""};
    const {text:html,truncated}=await readLimitedBody(response);
    const state=detectPageState(html,response.status);
    return {availability:{...state,httpStatus:response.status,checkedAt,truncated},html:state.status==="available"?html:""};
  }catch(error){return {availability:{status:"unverified",reason:error?.name==="AbortError"?"PAGE_TIMEOUT":"PAGE_NETWORK_ERROR",checkedAt},html:""};}
  finally{clearTimeout(timer);}
}
function candidatePages(raw){
  const seen=new Set();
  return raw.flatMap(value=>{
    const url=canonicalCandidate(value?.url);if(!url)return [];
    let relevant=false;try{relevant=relevantSearchPage({url,title:value.title});}catch{}
    const identity=classifySearchPage(url)==="individual-candidate"?listingIdentity(url)||url:url;
    if(!relevant||seen.has(identity))return [];seen.add(identity);
    return [{url,title:String(value.title||"").slice(0,160),content:String(value.content||"").slice(0,800),
      source:marketplaceName(url),evidence:"index",pageType:classifySearchPage(url)}];
  }).slice(0,60);
}
export async function collectCandidates(filters,env,{fetchImpl=fetch,grade}={}){
  const started=Date.now(),deadline=started+SEARCH_BUDGET.deadlineMs,queries=[],errors=[],raw=[];
  const usage={searches:0,extractionUrls:0,publicPages:0,tavilyExtractRequests:0},processed=new Map();
  let succeeded=0,supplierBlocked=false;
  const remaining=()=>Math.max(0,deadline-Date.now());
  async function tavily(endpoint,body){
    if(remaining()<100||supplierBlocked)throw pipelineFailure(supplierBlocked?"SUPPLIER_LIMIT":"SEARCH_DEADLINE");
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(12000,remaining()));
    try{
      const response=await fetchImpl("https://api.tavily.com/"+endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+env.TAVILY_API_KEY},body:JSON.stringify({...body,include_usage:true}),signal:controller.signal});
      if(!response.ok){
        if([401,403,429,432,433].includes(response.status))supplierBlocked=true;
        throw pipelineFailure(response.status===429?"TAVILY_RATE_LIMIT":[401,403].includes(response.status)?"TAVILY_AUTH_FAILED":"TAVILY_HTTP_"+response.status,response.status);
      }
      const bodyRead=await readLimitedBody(response,1000000);
      if(bodyRead.truncated)throw pipelineFailure("TAVILY_RESPONSE_TOO_LARGE");
      let data;try{data=JSON.parse(bodyRead.text);}catch{throw pipelineFailure("TAVILY_INVALID_RESPONSE");}
      if(!data||typeof data!=="object"||!Array.isArray(data.results))throw pipelineFailure("TAVILY_INVALID_RESPONSE");
      return data;
    }catch(error){if(error?.code)throw error;throw pipelineFailure(error?.name==="AbortError"?"TAVILY_TIMEOUT":"TAVILY_NETWORK_ERROR");}
    finally{clearTimeout(timer);}
  }
  async function search(query){
    if(usage.searches>=SEARCH_BUDGET.searches||remaining()<100)return;
    const index=usage.searches++;queries.push(query);
    try{const data=await tavily("search",{query,search_depth:"basic",max_results:15,include_domains:PIPELINE_DOMAINS,include_answer:false,include_raw_content:false});succeeded++;raw.push(...data.results);}
    catch(error){errors.push({stage:"search",queryIndex:index,code:error.code||"TAVILY_SEARCH_FAILED",httpStatus:error.status||null});}
  }
  async function examine(candidates){
    const selected=candidates.filter(x=>!processed.has(listingIdentity(x.url)||x.url)).slice(0,SEARCH_BUDGET.publicPages-usage.publicPages);
    const pending=[];
    // Lote de no máximo três páginas; todas as tentativas contam, inclusive falhas.
    for(let offset=0;offset<selected.length;offset+=3){
      await Promise.all(selected.slice(offset,offset+3).map(async page=>{
        if(remaining()<100)return;
        usage.publicPages++;
        const checked=await inspectPublicPage(page.url,{fetchImpl,timeoutMs:Math.min(5500,remaining())});
        const records=[];let structuredConflicts=[];
        if(checked.html){
          records.push({fields:parseListingFacts(checked.html,filters),source:"public-html"});
          const structured=parseStructuredListingEvidence(checked.html,page.url,filters);structuredConflicts=structured.conflicts;
          records.push({fields:structured.fields,source:"json-ld"});
        }
        const evidence=mergeListingEvidence(records);
        evidence.conflicts=[...new Set([...evidence.conflicts,...structuredConflicts])];
        for(const key of evidence.conflicts){evidence.fields[key]=null;delete evidence.sources[key];}
        const item={...page,...evidence,availability:checked.availability,pageStatus:checked.availability.status,
          extractionStatus:records.length&&Object.values(evidence.fields).some(x=>x!==null)?"extracted":"failed",extractionSource:records.length?"public-html":null,
          fieldEvidence:{sources:evidence.sources,conflicts:evidence.conflicts,checkedAt:checked.availability.checkedAt,sourceUrl:page.url}};
        processed.set(listingIdentity(page.url)||page.url,item);
        const needed=["price","km",filters.yearType==="make"?"yearMake":"yearModel","city","uf"];
        if(!["unavailable","blocked"].includes(item.availability.status)&&needed.some(k=>item.fields[k]===null))pending.push(item);
      }));
    }
    const extract=pending.slice(0,SEARCH_BUDGET.extractionUrls-usage.extractionUrls);
    if(extract.length&&!supplierBlocked&&remaining()>100){
      usage.extractionUrls+=extract.length;usage.tavilyExtractRequests++;
      try{
        const data=await tavily("extract",{urls:extract.map(x=>x.url),extract_depth:"basic",format:"markdown",include_images:false,timeout:Math.min(10,remaining()/1000)});
        const resultById=new Map(data.results.map(x=>[listingIdentity(x.url),x]));
        const failedById=new Map((Array.isArray(data.failed_results)?data.failed_results:[]).map(x=>[listingIdentity(x.url),x]));
        for(const item of extract){
          const id=listingIdentity(item.url),result=resultById.get(id),body=String(result?.raw_content||""),state=detectPageState(body);
          if(body&&state.status==="available"){
            const merged=mergeListingEvidence([{fields:item.fields,source:item.extractionSource||"public-html"},{fields:parseListingFacts(body,filters),source:"tavily-extract"}]);
            item.fields=merged.fields;item.extractionStatus="extracted";item.extractionSource="tavily-extract";
            item.fieldEvidence={sources:merged.sources,conflicts:[...new Set([...item.fieldEvidence.conflicts,...merged.conflicts])],checkedAt:new Date().toISOString(),sourceUrl:item.url};
          }else if(body&&state.status==="unavailable"){
            item.availability={...state,checkedAt:new Date().toISOString(),method:"extracted-page-content"};item.pageStatus="unavailable";
            item.fields=mergeListingEvidence([]).fields;item.extractionStatus="failed";
          }else{
            const code=failedById.has(id)?"TAVILY_EXTRACT_URL_FAILED":"TAVILY_EXTRACT_EMPTY";
            item.extractionError=code;errors.push({stage:"extract",url:item.url,code});
          }
        }
      }catch(error){for(const item of extract){item.extractionError=error.code||"TAVILY_EXTRACT_FAILED";errors.push({stage:"extract",url:item.url,code:item.extractionError,httpStatus:error.status||null});}}
    }
    for(const item of processed.values())item.assessment=grade(item,filters);
  }
  await Promise.all(planQueries(filters).map(search));
  if(!succeeded){const error=pipelineFailure(errors[0]?.code||"NO_SEARCH_COMPLETED",errors[0]?.httpStatus||0);error.coverage={...usage,errors};throw error;}
  let pages=candidatePages(raw);
  await examine(pages.filter(x=>x.pageType==="individual-candidate").slice(0,3));
  const hasQualified=()=>[...processed.values()].some(x=>x.assessment.bucket==="prequalified");
  if(!hasQualified()&&!supplierBlocked&&remaining()>100){
    const f=filters,near=nearbyMunicipalities(f,2);
    const query=[f.brand,f.model,f.version,f.yearFrom||"","site:olx.com.br",'"autos-e-pecas/motos"','"'+(near[0]?.name||f.originCity)+'"',"R$ km anuncio"].map(pipelineText).filter(Boolean).join(" ").slice(0,360);
    await search(query);pages=candidatePages(raw);
  }
  await examine(pages.filter(x=>x.pageType==="individual-candidate"));
  const individual=pages.filter(x=>x.pageType==="individual-candidate").map(page=>{
    const observed=processed.get(listingIdentity(page.url)||page.url);if(observed)return observed;
    const item={...page,fields:mergeListingEvidence([]).fields,extractionStatus:"not-attempted",availability:{status:"unverified",reason:"REQUEST_BUDGET",checkedAt:new Date().toISOString()}};item.assessment=grade(item,filters);return item;
  });
  const priority={prequalified:0,pending:1,outside:2,unavailable:3};individual.sort((a,b)=>(priority[a.assessment.bucket]??9)-(priority[b.assessment.bucket]??9));
  const catalogs=pages.filter(x=>x.pageType==="catalog").slice(0,5).map(x=>({...x,assessment:{bucket:"catalog",reasons:["Página de resultados; não é uma moto individual"]}}));
  return {source:"Tavily",query:queries[0],queries,checkedAt:new Date().toISOString(),evidence:"index",items:[...individual,...catalogs].slice(0,20),
    coverage:{queriesAttempted:usage.searches,queriesSucceeded:succeeded,indexedLinks:pages.length,individualLinks:individual.length,catalogPages:catalogs.length,
      extractionAttempted:processed.size,extractionSucceeded:[...processed.values()].filter(x=>x.extractionStatus==="extracted").length,
      extractionFailures:[...processed.values()].filter(x=>x.extractionStatus==="failed").length,publicPagesAttempted:usage.publicPages,tavilyExtractionUrls:usage.extractionUrls,tavilyExtractRequests:usage.tavilyExtractRequests,
      prequalified:individual.filter(x=>x.assessment.bucket==="prequalified").length,unavailable:individual.filter(x=>x.availability?.status==="unavailable").length,
      limits:SEARCH_BUDGET,errors,elapsedMs:Date.now()-started,regionRadiusVerified:false,regionRadiusMethod:"approximate-municipal-centers"},
    notice:"Páginas públicas observadas não comprovam disponibilidade de venda, documentação ou distância por estrada."};
}
