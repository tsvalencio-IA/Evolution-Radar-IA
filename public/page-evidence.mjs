import {resolveMunicipality,assessMunicipalityRadius} from "./br-municipios.mjs";
const evidenceNorm=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function primaryPageText(content){
  return String(content??"").slice(0,250000).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<br\s*\/?>|<\/(?:p|div|h[1-6]|li|dt|dd|section)>/gi,"\n").replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#x([0-9a-f]+);/gi,(_,n)=>parseInt(n,16)<=0x10ffff?String.fromCodePoint(parseInt(n,16)):"")
    .replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):"")
    .split(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:an[uú]ncios relacionados|veja tamb[eé]m|motos similares|similares a este an[uú]ncio|recomendados para voc[eê])[^\n]*(?:\n|$)/i)[0].slice(0,24000);
}
export function detectPageState(content,status=200){
  const primary=evidenceNorm(primaryPageText(content));
  if(status===404||status===410)return {status:"unavailable",reason:"HTTP_"+status};
  if([401,403,429].includes(status)||/verify you are human|checking your browser|captcha|verifique.{0,30}humano|acesso negado|access denied/.test(primary))return {status:"blocked",reason:"ACCESS_BLOCKED"};
  if(/(?:a |esta )?pagina nao (?:foi )?encontrada|anuncio (?:foi )?(?:removido|excluido|encerrado)|(?:este|esse) (?:item|anuncio|produto) (?:ja foi vendido|nao esta mais disponivel)|\bstatus\s*:\s*vendido\b|\b404\s*[-:]?\s*(?:not found|pagina)/.test(primary))return {status:"unavailable",reason:"REMOVED_OR_NOT_FOUND"};
  if(status<200||status>=300)return {status:"unverified",reason:"HTTP_"+status};
  if(primary.trim().length<20)return {status:"unverified",reason:"EMPTY_PAGE"};
  return {status:"available",reason:"PUBLIC_PAGE_OBSERVED"};
}
export function listingIdentity(value){
  try{
    const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password)return "";
    const domain=["olx.com.br","webmotors.com.br","mercadolivre.com.br","napista.com.br"].find(d=>u.hostname===d||u.hostname.endsWith("."+d));
    const id=u.pathname.replace(/\/+$/,"").match(/(?:[-/])(MLB-?\d{7,}|\d{5,})$/i)?.[1];
    return domain&&id?domain+"/"+id.replace(/^MLB-/i,"MLB"):"";
  }catch{return "";}
}
export function parseStructuredListing(html,url,filters={}){return parseStructuredListingEvidence(html,url,filters).fields;}
export function parseStructuredListingEvidence(html,url,filters={}){
  const identity=listingIdentity(url),objects=[];
  if(!identity||detectPageState(html).status!=="available")return mergeListingEvidence([]);
  function walk(value,depth=0,inList=false){
    if(!value||typeof value!=="object"||depth>9||objects.length>200)return;
    if(Array.isArray(value)){for(const item of value.slice(0,100))walk(item,depth+1,inList);return;}
    const types=[value["@type"]].flat();
    const listed=inList||types.includes("ItemList")||Object.hasOwn(value,"itemListElement");
    if(!listed&&types.some(x=>["Motorcycle","Vehicle","Product","Car"].includes(x))){
      const link=value.url||value.mainEntityOfPage?.["@id"]||value.mainEntityOfPage||value["@id"];
      let candidate="";try{candidate=listingIdentity(new URL(typeof link==="object"?link["@id"]:String(link),url).href);}catch{}
      if(candidate===identity)objects.push(value);
    }
    for(const [key,item] of Object.entries(value))if(["@graph","mainEntity","itemListElement","item"].includes(key))walk(item,depth+1,listed);
  }
  for(const script of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{walk(JSON.parse(script[1]));}catch{}
  }
  const candidates=objects.map(item=>{
    const offers=[item.offers].flat().filter(Boolean),offer=offers.length===1?offers[0]:null;
    const price=offer?.priceCurrency==="BRL"&&/^\d+(?:\.\d+)?$/.test(String(offer.price??""))?Number(offer.price):null;
    const mileage=item.mileageFromOdometer,km=mileage&&/^(?:KMT|km)$/i.test(String(mileage.unitCode||mileage.unitText||""))&&Number.isFinite(Number(mileage.value))?Number(mileage.value):null;
    const address=item.address||item.availableAtOrFrom?.address||offer?.availableAtOrFrom?.address;
    const place=address?resolveMunicipality(address.addressLocality,address.addressRegion):null;
    const area=place?assessMunicipalityRadius(filters,place.name,place.uf):null;
    const year=x=>/^(?:19|20)\d{2}(?:-|$)/.test(String(x||""))?Number(String(x).slice(0,4)):null;
    const name=x=>typeof x==="string"?x:typeof x?.name==="string"?x.name:null;
    const seller=item.seller||offer?.seller;
    return {brand:name(item.brand),model:name(item.model),version:name(item.vehicleConfiguration),price,km,yearMake:year(item.productionDate),yearModel:year(item.vehicleModelDate),
      city:place?.name??null,uf:place?.uf??null,distanceKm:area?.distanceKm??null,distanceMethod:area?.method??null,
      sellerType:seller?.["@type"]==="Person"?"particular":seller?.["@type"]==="Organization"?"loja":null};
  });
  return mergeListingEvidence(candidates.map(fields=>({fields,source:"json-ld"})));
}
export function mergeListingEvidence(records){
  const fields={},sources={},conflicts=[];
  const keys=["brand","model","version","vehicleText","price","km","yearMake","yearModel","yearAdvertised","city","uf","sellerType","distanceKm","distanceMethod"];
  for(const key of keys){
    const known=records.filter(x=>x?.fields?.[key]!==undefined&&x.fields[key]!==null&&x.fields[key]!=="");
    // Cabeçalhos variam na formatação; preferir o observado diretamente na página.
    // Contradições dos campos do veículo continuam sendo comparadas abaixo.
    if(key==="vehicleText"){fields[key]=known[0]?.fields[key]??null;if(known.length)sources[key]=[known[0].source];continue;}
    const entries=new Map(known.map(x=>[typeof x.fields[key]==="string"?evidenceNorm(x.fields[key]):String(x.fields[key]),x.fields[key]]));
    fields[key]=entries.size===1?[...entries.values()][0]:null;
    if(entries.size>1)conflicts.push(key);
    if(entries.size===1)sources[key]=[...new Set(known.map(x=>x.source))];
  }
  return {fields,sources,conflicts};
}
