import {municipalityFromLocationText,assessMunicipalityRadius} from "./br-municipios.mjs";

const plain=value=>String(value??"").replace(/\[([^\]]+)\]\([^)]*\)/g,"$1")
  .replace(/^[ \t]*#{1,6}[ \t]+/gm,"").replace(/[*_]/g,"");
const tokens=value=>plain(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/([a-z])(?=\d)/gi,"$1 ").replace(/(\d)(?=[a-z])/gi,"$1 ")
  .toLowerCase().match(/[a-z0-9]+/g)||[];
const matches=(value,evidence)=>tokens(value).every(word=>tokens(evidence).includes(word));
const amount=value=>{
  let s=String(value).replace(/[^\d.,]/g,"");
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  const n=Number(s);return s&&Number.isFinite(n)&&n>=0?n:null;
};
const unique=values=>{const v=[...new Set(values.filter(x=>x!==null))];return v.length===1?v[0]:null;};

// Comparar palavras completas, independentemente da ordem. CG125 e CG 125 são
// equivalentes; 125 não pode casar com 1250 e dados ausentes nunca são presumidos.
export function vehicleMatches(item,filters){
  const fields=item.fields||{},title=item.title||"";
  return {
    brand:!filters.brand||matches(filters.brand,title)||matches(filters.brand,fields.brand),
    model:!filters.model||matches(filters.model,title)||matches(filters.model,fields.model),
    version:!filters.version||matches(filters.version,title)||matches(filters.version,fields.version)||matches(filters.version,fields.model)
  };
}

export function parseListingFacts(content,filters={}){
  // Evitar que recomendações de outras motos contaminem os campos da moto principal.
  const source=plain(content).slice(0,16000).split(/(?:^|\n)\s*(?:an[uú]ncios relacionados|veja tamb[eé]m|motos similares|recomendados para voc[eê])\s*(?:\n|$)/i)[0];
  const labelled=name=>{
    const values=[...source.matchAll(new RegExp("(?:^|\\n)[ \\t]*(?:"+name+")[ \\t]*(?:[:\\-][ \\t]*|[ \\t]+|\\r?\\n[ \\t]*)([^\\n\\r]{1,110})","gmi"))]
      .map(x=>x[1].trim());
    return unique(values);
  };
  const prices=[...source.matchAll(/(?:pre[cç]o|valor(?:\s+total)?|à vista|a vista)\s*[:\n-]?\s*R\$\s*([\d.,]+)/gi),
    ...source.matchAll(/R\$\s*([\d.,]+)\s*(?:a vista|à vista)/gi),
    ...source.matchAll(/^[ \t]*R\$[ \t]*([\d.,]+)[ \t]*$/gm)];
  const kms=[...source.matchAll(/(?:quilometragem|km rodados|hod[oô]metro|\bkm[ \t]*:)\s*[:\n-]?\s*([\d.,]+)\s*(?:km)?\b/gi),
    ...source.matchAll(/\b([\d.,]+)[ \t]*km(?:[ \t]+rodados)?\b/gi)];
  const pairs=[...source.matchAll(/\b((?:19|20)\d{2})\s*\/\s*((?:19|20)\d{2})\b/g)].map(x=>x[1]+"/"+x[2]);
  const pair=unique(pairs)?.split("/").map(Number);
  const year=value=>/^(?:19|20)\d{2}$/.test(value||"")?Number(value):null;
  const place=municipalityFromLocationText(source);
  const geo=place?assessMunicipalityRadius(filters,place.name,place.uf):null;
  return {
    brand:labelled("marca"),model:labelled("modelo"),version:labelled("vers[aã]o"),
    price:unique(prices.map(x=>amount(x[1]))),km:unique(kms.map(x=>amount(x[1]))),
    yearMake:pair?.[0]??year(labelled("ano(?: de)? fabrica[cç][aã]o")),
    yearModel:pair?.[1]??year(labelled("ano[ -]modelo")),
    // "Ano 2018" não prova separadamente fabricação e modelo.
    yearAdvertised:year(labelled("ano")),
    city:place?.name??null,uf:place?.uf??null,
    distanceKm:geo?.distanceKm??null,distanceMethod:geo?.method??null
  };
}
