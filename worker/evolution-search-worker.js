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
  }).slice(0,12);
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
    const query=queryFor(payload.filters);
    let result;
    try{
      const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),18000);
      try{
        result=await fetch("https://api.tavily.com/search",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"Bearer "+env.TAVILY_API_KEY},
          body:JSON.stringify({query,search_depth:"basic",max_results:12,include_domains:ALLOWED_DOMAINS,include_answer:false,include_raw_content:false}),
          signal:controller.signal
        });
      }finally{clearTimeout(timeout);}
    }catch{return response({error:"Pesquisa externa indisponível; tente mais tarde"},502);}
    if(!result.ok)return response({error:result.status===429?"Cota de pesquisa atingida":"Fonte de busca retornou erro",upstreamStatus:result.status},502);
    let data;
    try{data=await result.json();}catch{return response({error:"Resposta externa inválida"},502);}
    return response({source:"Tavily",query,checkedAt:new Date().toISOString(),evidence:"index",items:sources(data.results)});
  }
};
