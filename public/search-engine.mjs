// Pesquisa externa: resultados INDEXADOS nunca equivalem a anúncio individual verificado.
const SOURCES = [
  {name:"OLX",domains:["olx.com.br"]},
  {name:"Webmotors",domains:["webmotors.com.br"]},
  {name:"Mercado Livre",domains:["mercadolivre.com.br"]},
  {name:"NaPista",domains:["napista.com.br"]}
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
export function normalizeWebLeads(raw){
  if(!Array.isArray(raw))return [];
  const seen=new Set();
  return raw.flatMap(x=>{
    if(!x||typeof x!=="object")return [];
    const title=simple(x.title),url=String(x.url??"").trim(),source=marketplaceName(url);
    if(!source||!title||!/^https:\/\//i.test(url))return [];
    const canonical=new URL(url); canonical.hash="";
    for(const key of [...canonical.searchParams.keys()])if(/^(utm_|fbclid$|gclid$)/i.test(key))canonical.searchParams.delete(key);
    const norm=canonical.toString();
    if(seen.has(norm))return []; seen.add(norm);
    return [{title,url:norm,source,snippet:String(x.content??"").slice(0,750),observedAt:String(x.observedAt??"").slice(0,30),evidence:"index"}];
  });
}
