export const emptyFilters = Object.freeze({
  brand:"", model:"", version:"", yearFrom:"", yearTo:"", yearType:"model",
  priceMin:"", priceMax:"", kmMax:"", originCity:"", uf:"", radiusKm:"",
  sellerType:"all", order:"price"
});
export const costs = Object.freeze(["transport","documents","repairs","labor","taxes","commissions","other"]);
const fixedFields=["id","brand","model","version","yearMake","yearModel","price","km","city","uf","sellerType","source","url","evidence","observedAt","distanceKm","distanceVerified","notes","createdAt","updatedAt"];
export function normalized(value) {
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
}
export function numberOrNull(value) {
  if (value===null || value===undefined || String(value).trim()==="") return null;
  const n=Number(value); return Number.isFinite(n)?n:null;
}
export function canonicalUrl(value) {
  try {
    const u=new URL(String(value).trim());
    if(!["http:","https:"].includes(u.protocol)) return "";
    u.hash="";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|igshid$|ref$|source$)/i.test(key)) u.searchParams.delete(key);
    }
    u.hostname=u.hostname.toLowerCase();
    u.pathname=u.pathname.replace(/\/+$/,"") || "/";
    return u.toString();
  } catch {return "";}
}
export function validLead(input) {
  if (!input || typeof input!=="object" || Array.isArray(input)) return false;
  if(!input.id || typeof input.id!=="string") return false;
  if(input.url && !canonicalUrl(input.url)) return false;
  if(input.price!==null && input.price!==undefined && (numberOrNull(input.price)===null || Number(input.price)<0)) return false;
  return true;
}
export function sanitizeLead(input) {
  if(!validLead(input)) return null;
  const o={}; for(const k of fixedFields) if(Object.prototype.hasOwnProperty.call(input,k)) o[k]=input[k];
  for(const k of ["price","km","yearMake","yearModel","distanceKm"]) o[k]=numberOrNull(o[k]);
  o.distanceVerified=o.distanceVerified===true;
  for(const k of ["brand","model","version","city","uf","sellerType","source","url","evidence","notes","observedAt","createdAt","updatedAt"]) o[k]=String(o[k]??"").slice(0,k==="notes"?3000:500);
  o.id=String(o.id).slice(0,100);
  return o;
}
export function findDuplicate(candidate,existing) {
  const url=canonicalUrl(candidate.url);
  if(url){const exact=existing.find(x=>x.id!==candidate.id && canonicalUrl(x.url)===url);if(exact)return {id:exact.id,type:"same-url"};}
  const fp=x=>[x.brand,x.model,x.version,x.yearModel,x.price,x.km,x.city,x.uf].map(normalized).join("|");
  if(candidate.price!=null && candidate.km!=null && candidate.city && candidate.model) {
    const x=existing.find(x=>x.id!==candidate.id && fp(x)===fp(candidate));
    if(x)return {id:x.id,type:"possible-same-bike"};
  }
  return null;
}
export function evaluateLead(lead, f=emptyFilters) {
  const reasons=[],unknown=[];
  const compare=(label,wanted,actual)=>{
    if(!normalized(wanted))return;
    if(!normalized(actual))unknown.push(label+" não informado");
    else if(normalized(wanted)!==normalized(actual))reasons.push(label+" diferente do filtro");
  };
  compare("Marca",f.brand,lead.brand);compare("Modelo",f.model,lead.model);compare("Versão",f.version,lead.version);
  const year=numberOrNull(f.yearType==="make"?lead.yearMake:lead.yearModel);
  const from=numberOrNull(f.yearFrom),to=numberOrNull(f.yearTo);
  if(from!==null||to!==null) {
    if(year===null)unknown.push("Ano de "+(f.yearType==="make"?"fabricação":"modelo")+" não confirmado");
    else if((from!==null&&year<from)||(to!==null&&year>to))reasons.push("Ano fora da faixa");
  }
  for(const [key,label,low,high] of [
    ["price","Preço",numberOrNull(f.priceMin),numberOrNull(f.priceMax)],
    ["km","Quilometragem",null,numberOrNull(f.kmMax)]
  ]) {
    if(low===null&&high===null)continue;
    const val=numberOrNull(lead[key]);
    if(val===null)unknown.push(label+" não informado");
    else if((low!==null&&val<low)||(high!==null&&val>high))reasons.push(label+" fora do limite");
  }
  if(normalized(f.sellerType)&&f.sellerType!=="all")compare("Vendedor",f.sellerType,lead.sellerType);
  if(normalized(f.uf))compare("UF",f.uf,lead.uf);
  if(normalized(f.originCity)) {
    const sameCity=normalized(f.originCity)===normalized(lead.city) && (!f.uf||normalized(f.uf)===normalized(lead.uf));
    const radius=numberOrNull(f.radiusKm);
    if(!sameCity) {
      if(!lead.city)unknown.push("Cidade não informada");
      else if(radius!==null && radius>0){
        if(lead.distanceVerified!==true||numberOrNull(lead.distanceKm)===null)unknown.push("Distância não verificada");
        else if(lead.distanceKm>radius)reasons.push("Distância acima do raio");
      } else reasons.push("Município fora do filtro");
    }
  } else if(numberOrNull(f.radiusKm)!==null && numberOrNull(f.radiusKm)>0)unknown.push("Cidade de origem não definida para o raio");
  if(reasons.length)return {bucket:"outside",reasons};
  if(!lead.url||!canonicalUrl(lead.url))unknown.push("Link individual não informado");
  if(lead.evidence!=="page")unknown.push("Página individual não conferida");
  if(unknown.length)return {bucket:"pending",reasons:[...new Set(unknown)]};
  return {bucket:"compatible",reasons:["Dados da página conferidos; disponibilidade e documentos ainda não comprovados"]};
}
export function sortLeads(leads,order="price") {
  return [...leads].sort((a,b)=>{
    if(order==="recent") return String(b.observedAt||b.createdAt||"").localeCompare(String(a.observedAt||a.createdAt||""));
    if(order==="km")return (a.km??Infinity)-(b.km??Infinity);
    return (a.price??Infinity)-(b.price??Infinity);
  });
}
export function calculateScenario(values) {
  const purchase=numberOrNull(values.purchase),resale=numberOrNull(values.resale);
  const missing=costs.filter(k=>numberOrNull(values[k])===null);
  if(purchase===null)missing.unshift("purchase");
  if(resale===null)missing.push("resale");
  const invalid=Object.entries(values).some(([k,v])=>["purchase","resale",...costs].includes(k)&&numberOrNull(v)!==null&&numberOrNull(v)<0);
  if(invalid)return {valid:false,error:"Valores negativos não são permitidos.",missing};
  const partialCost=(purchase??0)+costs.reduce((sum,k)=>sum+(numberOrNull(values[k])??0),0);
  if(missing.length)return {valid:false,missing,partialCost};
  if(resale<=0)return {valid:false,error:"Preço de revenda deve ser maior que zero.",missing:[]};
  const outcome=resale-partialCost;
  return {valid:true,missing:[],totalCost:partialCost,outcome,marginPercent:outcome/resale*100,returnPercent:partialCost>0?outcome/partialCost*100:null};
}
export function sourceSearches(filters) {
  const terms=[filters.brand,filters.model,filters.version];
  const years=[numberOrNull(filters.yearFrom),numberOrNull(filters.yearTo)];
  if(years[0]!==null)terms.push(String(years[0]));
  if(years[1]!==null&&years[1]!==years[0])terms.push(String(years[1]));
  if(filters.originCity)terms.push(filters.originCity);
  if(filters.uf)terms.push(filters.uf);
  const q=terms.filter(Boolean).join(" ")+" moto usada";
  return [
    ["OLX","site:olx.com.br "+q],
    ["Webmotors","site:webmotors.com.br/comprar "+q],
    ["Mercado Livre","site:mercadolivre.com.br "+q],
    ["NaPista","site:napista.com.br "+q],
    ["Revendas da região",q+" concessionária revenda"],
  ].map(([name,query])=>({name,url:"https://www.google.com/search?q="+encodeURIComponent(query)}));
}
export function money(v) {
  return v===null||v===undefined||v===""?"Não informado":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v));
}
export function csvExport(leads){
  const columns=["id","brand","model","version","yearMake","yearModel","price","km","city","uf","sellerType","source","url","evidence","observedAt","distanceKm","distanceVerified","notes"];
  const cell=x=>{let t=String(x??"");if(/^[=+\-@]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
  return "\uFEFF"+columns.join(";")+"\r\n"+leads.map(x=>columns.map(k=>cell(x[k])).join(";")).join("\r\n");
}
