import {assessMunicipalityRadius} from "./br-municipios.mjs";
import {vehicleMatches} from "./listing-facts.mjs";
// Pesquisa externa: resultados INDEXADOS nunca equivalem a anúncio individual verificado.
const SOURCES = [
  {name:"OLX",domains:["olx.com.br"]},
  {name:"Webmotors",domains:["webmotors.com.br"]},
  {name:"Mercado Livre",domains:["mercadolivre.com.br"]},
  {name:"NaPista",domains:["napista.com.br"]},
  {name:"Facebook Marketplace",domains:["facebook.com"]}
];
const simple=x=>String(x??"").trim().slice(0,140);
export function searchQuery(filters){
  const f=filters||{};
  const bits=[f.brand,f.model,f.version].map(simple).filter(Boolean);
  const y1=Number(f.yearFrom),y2=Number(f.yearTo);
  if(f.yearFrom&&Number.isInteger(y1)&&y1>1949&&y1<2101)bits.push(String(y1));
  if(f.yearTo&&Number.isInteger(y2)&&y2>1949&&y2<2101&&y2!==y1)bits.push(String(y2));
  if(f.originCity)bits.push(simple(f.originCity));
  if(f.uf)bits.push(simple(f.uf));
  bits.push("moto usada venda");
  return bits.join(" ").slice(0,360);
}
export function marketplaceName(raw){
  let host;
  try{host=new URL(raw).hostname.toLowerCase();}catch{return "";}
  for(const source of SOURCES)if(source.domains.some(x=>host===x||host.endsWith("."+x)))return source.name;
  return "";
}
// A busca indexa páginas. Este classificador distingue um endereço que parece
// anúncio individual de uma página de catálogo; não verifica disponibilidade.
export function classifySearchPage(url){
  let u;
  try{u=new URL(url);}catch{return "unknown";}
  const source=marketplaceName(u.href);
  const path=u.pathname.replace(/\/+$/,"");
  if(source==="Facebook Marketplace")return /^\/marketplace\/item\/\d{5,30}$/.test(path)?"individual-candidate":/^\/marketplace(?:\/|$)/.test(path)?"catalog":"unknown";
  if(source==="OLX"){
    return /[-\/]\d{9,}$/.test(path)&&path.includes("/autos-e-pecas/motos/")?"individual-candidate":"catalog";
  }
  if(source==="Webmotors"){
    return /^\/comprar\/.+\/\d{5,}$/i.test(path)?"individual-candidate":"catalog";
  }
  if(source==="Mercado Livre"){
    return /(?:^|[\/-])MLB-?\d{7,}(?:$|[\/?#])/i.test(path)?"individual-candidate":"catalog";
  }
  // Sem evidências de formato individual estável para esta origem.
  return source?"catalog":"unknown";
}

// Também filtra o histórico antigo, que pode conter catálogos de imóveis/celulares.
export function relevantSearchPage(item){
  if(!item||typeof item!=="object")return false;
  let u;try{u=new URL(String(item.url??""));}catch{return false;}
  if(!marketplaceName(u.href)||u.protocol!=="https:")return false;
  if(marketplaceName(u.href)==="Facebook Marketplace"&&classifySearchPage(u.href)==="unknown")return false;
  let path;try{path=decodeURIComponent(u.pathname).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}catch{return false;}
  if(/(?:^|\/)(?:imoveis|apartamentos?|casas?|celulares?|smartphones?|eletronicos|informatica|moda|roupas?|moveis|eletrodomesticos|terrenos?|carros|automoveis)(?:\/|$)/.test(path))return false;
  if(classifySearchPage(u.href)==="individual-candidate")return true;
  const title=String(item.title??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return /(?:^|\W)(?:moto|motos|motocicleta|motocicletas|honda|yamaha|suzuki|kawasaki|bajaj|dafra|shineray|triumph|bmw|factor|ninja|titan|fan|biz|fazer|ybr|cg)(?:$|\W)/.test(title) ||
    /(?:^|\/)(?:motos?|motocicletas?)(?:\/|$)/.test(path);
}
export function normalizeWebLeads(raw){
  if(!Array.isArray(raw))return [];
  const seen=new Set();let catalogs=0;
  return raw.flatMap(x=>{
    if(!x||typeof x!=="object")return [];
    const title=simple(x.title),url=String(x.url??"").trim(),source=marketplaceName(url);
    if(!source||!title||!/^https:\/\//i.test(url)||!relevantSearchPage({url,title}))return [];
    const canonical=new URL(url); canonical.hash="";
    if(canonical.username||canonical.password)return [];
    for(const key of [...canonical.searchParams.keys()])if(/^(utm_|fbclid$|gclid$)/i.test(key))canonical.searchParams.delete(key);
    const norm=canonical.toString();
    if(seen.has(norm))return []; seen.add(norm);
    const pageType=classifySearchPage(norm);
    if(pageType==="catalog"&&++catalogs>5)return [];
    const raw=x.fields&&typeof x.fields==="object"?x.fields:{};
    const numeric=k=>{
      const v=raw[k];
      return typeof v==="number"&&Number.isFinite(v)&&v>=0?v:null;
    };
    const fields={
      price:numeric("price"),km:numeric("km"),yearMake:numeric("yearMake"),yearModel:numeric("yearModel"),yearAdvertised:numeric("yearAdvertised"),
      brand:typeof raw.brand==="string"?raw.brand.slice(0,100):null,
      model:typeof raw.model==="string"?raw.model.slice(0,110):null,
      version:typeof raw.version==="string"?raw.version.slice(0,100):null,
      vehicleText:typeof raw.vehicleText==="string"?raw.vehicleText.slice(0,200):null,
      city:typeof raw.city==="string"?raw.city.slice(0,110):null,
      uf:typeof raw.uf==="string"?raw.uf.slice(0,2):null,
      sellerType:["particular","loja"].includes(raw.sellerType)?raw.sellerType:null
    };
    const status=["extracted","failed","not-attempted"].includes(x.extractionStatus)?x.extractionStatus:"not-attempted";
    const validBuckets=["prequalified","pending","outside","catalog","unavailable"];
    let assessment=x.assessment&&validBuckets.includes(x.assessment.bucket)?
      {bucket:x.assessment.bucket,reasons:Array.isArray(x.assessment.reasons)?x.assessment.reasons.filter(y=>typeof y==="string").slice(0,9).map(y=>y.slice(0,160)):[]}:
      {bucket:pageType==="catalog"?"catalog":"pending",reasons:["Informações não conferidas"]};
    if(assessment.bucket==="prequalified"&&x.availability?.status!=="available")assessment={bucket:"pending",reasons:[...assessment.reasons,"Link sem conferência pública atual"]};
    return [{
      title,url:norm,source,pageType,snippet:String(x.content??"").slice(0,750),
      observedAt:String(x.observedAt??"").slice(0,30),evidence:"index",
      extractionStatus:status,fields,assessment
      ,availability:{status:["available","unavailable","blocked","unverified"].includes(x.availability?.status)?x.availability.status:x.pageStatus==="unavailable"?"unavailable":"unverified",
        reason:String(x.availability?.reason||"LINK_NOT_VALIDATED").replace(/[^A-Z0-9_]/g,"").slice(0,60),
        checkedAt:Number.isFinite(Date.parse(x.availability?.checkedAt||""))?new Date(x.availability.checkedAt).toISOString():null,
        httpStatus:Number.isInteger(x.availability?.httpStatus)?x.availability.httpStatus:null},
      fieldEvidence:{conflicts:Array.isArray(x.fieldEvidence?.conflicts)?x.fieldEvidence.conflicts.filter(k=>Object.hasOwn(fields,k)):[],sourceUrl:norm,
        sources:Object.fromEntries(Object.keys(fields).map(k=>[k,Array.isArray(x.fieldEvidence?.sources?.[k])?x.fieldEvidence.sources[k].filter(s=>["public-html","json-ld","tavily-extract"].includes(s)):[]])),
        checkedAt:Number.isFinite(Date.parse(x.fieldEvidence?.checkedAt||""))?new Date(x.fieldEvidence.checkedAt).toISOString():null},
      extractionError:typeof x.extractionError==="string"?x.extractionError.replace(/[^A-Z0-9_]/g,"").slice(0,70):null
    }];
  });
}

// Revisão defensiva na interface: protege também contra respostas de Workers antigos
// e pesquisas armazenadas. Nunca promove catálogo ou município desconhecido a oferta.
export function classifyDiscoveryForFilters(item,filters={}){
  if(!item||item.pageType!=="individual-candidate")return {category:"catalog",distanceKm:null};
  if(item.availability?.status==="unavailable"||item.assessment?.bucket==="unavailable")return {category:"unavailable",distanceKm:null};
  const f=item.fields||{};
  const area=assessMunicipalityRadius(filters,f.city,f.uf);
  const year=Number(filters.yearType==="make"?f.yearMake:f.yearModel);
  if((f.yearModel!==null&&f.yearModel!==undefined&&filters.yearType!=="make")||(f.yearMake!==null&&f.yearMake!==undefined&&filters.yearType==="make")){
    if((filters.yearFrom&&year<Number(filters.yearFrom))||(filters.yearTo&&year>Number(filters.yearTo)))
      return {category:"outside-filters",distanceKm:area.distanceKm};
  }
  for(const [field,lower,upper] of [["price",filters.priceMin,filters.priceMax],["km",filters.kmMin,filters.kmMax]]){
    const v=f[field];
    if(v===null||v===undefined)continue;
    if((lower&&v<Number(lower))||(upper&&v>Number(upper)))
      return {category:"outside-filters",distanceKm:area.distanceKm};
  }
  if(area.status==="outside")return {category:"out-of-area",distanceKm:area.distanceKm};
  if(area.status!=="inside")return {category:"location-unverified",distanceKm:null};
  const vehicle=vehicleMatches(item,filters);
  if(!vehicle.brand||!vehicle.model||!vehicle.version)
    return {category:"model-unverified",distanceKm:area.distanceKm};
  return {category:"in-area",distanceKm:area.distanceKm};
}

// Dados incompletos continuam investigáveis, sem serem anunciados como dentro do raio.
export function partitionDiscovery(items,filters){
  const matched=[],unresolved=[],excluded=[],unavailable=[];
  for(const item of items){
    const entry={item,region:classifyDiscoveryForFilters(item,filters)};
    if(entry.region.category==="unavailable")unavailable.push(entry);
    else if(item.assessment?.bucket==="outside"||["catalog","out-of-area","outside-filters"].includes(entry.region.category))excluded.push(entry);
    else if(entry.region.category==="in-area")matched.push(entry);
    else unresolved.push(entry);
  }
  return {matched,unresolved,excluded,unavailable};
}
