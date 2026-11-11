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
// A busca indexa páginas. Este classificador distingue um endereço que parece
// anúncio individual de uma página de catálogo; não verifica disponibilidade.
export function classifySearchPage(url){
  let u;
  try{u=new URL(url);}catch{return "unknown";}
  const source=marketplaceName(u.href);
  const path=u.pathname.replace(/\/+$/,"");
  if(source==="OLX"){
    return /\/\d{9,}$/.test(path)&&path.includes("/autos-e-pecas/motos/")?"individual-candidate":"catalog";
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
    return [{title,url:norm,source,pageType:classifySearchPage(norm),snippet:String(x.content??"").slice(0,750),observedAt:String(x.observedAt??"").slice(0,30),evidence:"index"}];
  });
}
