import {facebookListingUrl} from "./marketplaces.mjs";
export const SHARE_KEY="evolution-radar-pending-share-v1";
export function parseSharedListing(params){
  const get=key=>String(params?.get?.(key)??params?.[key]??"").slice(0,6000);
  const all=[get("url"),get("text"),get("title")].join("\n");
  if(all.length>8000)return {ok:false,reason:"Conteúdo compartilhado muito longo."};
  const urls=all.match(/https?:\/\/[^\s<>"']+/g)||[];
  const candidates=[...new Set(urls.map(x=>facebookListingUrl(x.replace(/[),.;!]+$/g,""))).filter(Boolean))];
  if(candidates.length!==1)return {ok:false,reason:candidates.length?"Compartilhe um anúncio por vez.":"É necessário o link completo do anúncio: facebook.com/marketplace/item/…"};
  const description=[get("title"),get("text")].join("\n").replace(/https?:\/\/[^\s<>"']+/g,"").trim().slice(0,450);
  return {ok:true,url:candidates[0],description,receivedAt:new Date().toISOString()};
}
export function readPendingShare(storage,now=Date.now()){
  try{
    const record=JSON.parse(storage.getItem(SHARE_KEY)||"null");
    if(!record||!facebookListingUrl(record.url)||!Number.isFinite(Date.parse(record.receivedAt))||now-Date.parse(record.receivedAt)>3600000||Date.parse(record.receivedAt)>now+300000){storage.removeItem(SHARE_KEY);return null;}
    return {url:facebookListingUrl(record.url),description:String(record.description||"").slice(0,450),receivedAt:record.receivedAt};
  }catch{return null;}
}
