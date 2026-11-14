import {qaLog} from "./qa-client.js";
globalThis.fetch=async(input,options={})=>{
  const uri=new URL(String(input),location.href);
  if(uri.origin!=="https://qa.invalid")throw Error("QA bloqueou tentativa externa: "+uri.hostname);
  if(uri.pathname==="/health")return Response.json({service:"Evolution Radar IA",status:"online",version:"fixture-rc1",accountDeletionConfigured:false});
  if(uri.pathname!=="/search")return Response.json({error:"Somente contratos simulados"},{status:503});
  const f=JSON.parse(options.body).filters,delay=Number(document.querySelector("#qaDelay")?.value||0);
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  const checkedAt=new Date().toISOString(),base={title:[f.brand,f.model,f.version,f.yearFrom||"2024"].filter(Boolean).join(" ")+" — FIXTURE",url:"https://sp.olx.com.br/autos-e-pecas/motos/fixture-9930000001",fields:{brand:f.brand,model:f.model,version:f.version||null,yearModel:Number(f.yearFrom||2024),yearMake:Number(f.yearFrom||2024),price:15000,km:15000,city:f.originCity,uf:f.uf},availability:{status:"available",reason:"PUBLIC_PAGE_OBSERVED",checkedAt,httpStatus:200},extractionStatus:"extracted",assessment:{bucket:"prequalified",reasons:["Compatibilidade da fixture; sem moto real"]},fieldEvidence:{sources:{price:["json-ld"]},checkedAt,conflicts:[]}};
  const items=[base,{...base,title:"Moto incompleta — FIXTURE",url:base.url.replace("0001","0002"),fields:{...base.fields,city:null,km:null},assessment:{bucket:"pending",reasons:["KM e localização não comprovados"]}},
  {...base,title:"Moto removida — FIXTURE",url:base.url.replace("0001","0003"),fields:{},availability:{status:"unavailable",reason:"SOFT_404",checkedAt,httpStatus:200},assessment:{bucket:"unavailable",reasons:["Página não encontrada"]}},
  {...base,title:"Fora dos critérios — FIXTURE",url:base.url.replace("0001","0004"),fields:{...base.fields,km:999999,city:"Sete Barras",uf:"SP"},assessment:{bucket:"outside",reasons:["KM fora do limite"]}},
  {title:"Catálogo de motos — FIXTURE",url:"https://www.olx.com.br/autos-e-pecas/motos",fields:{},assessment:{bucket:"catalog",reasons:["Catálogo"]}}];
  qaLog("Resposta de busca local; sem consumo de créditos");
  return Response.json({source:"Fixtures locais",checkedAt,items,coverage:{queriesAttempted:3,queriesSucceeded:3,publicPagesAttempted:4,extractionAttempted:4,extractionSucceeded:2,tavilyExtractionUrls:0,limits:{searches:4,extractionUrls:5,publicPages:5}}});
};
