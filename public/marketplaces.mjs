const FACEBOOK_HOSTS=new Set(["facebook.com","www.facebook.com","m.facebook.com","web.facebook.com","mbasic.facebook.com"]);
export function facebookListingUrl(value){
  try{
    const url=new URL(String(value||"").trim());
    if(url.protocol!=="https:"||!FACEBOOK_HOSTS.has(url.hostname)||url.username||url.password)return "";
    const match=url.pathname.match(/^\/marketplace\/item\/(\d{5,30})\/?$/);
    return match?"https://www.facebook.com/marketplace/item/"+match[1]+"/":"";
  }catch{return "";}
}
export function facebookMarketplaceSearch(filters={}){
  const words=[filters.brand,filters.model,filters.version].map(x=>String(x||"").trim().slice(0,100)).filter(Boolean);
  const from=String(filters.yearFrom||""),to=String(filters.yearTo||"");
  // Texto não representa aplicação de filtros nativos de ano, localização ou raio.
  if(/^(?:19|20)\d{2}$/.test(from)&&(!to||to===from))words.push(from);
  const url=new URL("https://www.facebook.com/marketplace/search/");
  if(words.length)url.searchParams.set("query",words.join(" "));
  return {name:"Facebook Marketplace",url:url.href,mode:"external-session",automaticImport:false,
    location:[filters.originCity,filters.uf].filter(Boolean).join(" / "),radiusKm:String(filters.radiusKm||"")};
}
