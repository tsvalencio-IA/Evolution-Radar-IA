import {parseIntentQuantities} from "./intent-quantities.mjs";
import {resolveMunicipality,municipalitiesInText} from "./br-municipios.mjs";
// Alternativa determinística, gratuita e explícita quando /interpret não está publicado.
// Não substitui IA e não inventa anúncios, localidades, versões ou preços.
const norm = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const inText = (text, pattern) => pattern.test(text);

export function parseLocalIntent(message, previousFilters = {}) {
  const raw = String(message ?? "").slice(0, 450);
  const s = norm(raw);
  const quantities=parseIntentQuantities(s),typedAt=index=>quantities.evidence.some(e=>index>=e.start&&index<e.end);
  const previous = previousFilters && typeof previousFilters === "object" ? previousFilters : {};
  const filters = {}, warnings = [];
  const brands = ["honda", "yamaha", "suzuki", "kawasaki", "bmw", "bajaj", "shineray", "dafra", "triumph", "harley-davidson", "royal enfield"]
    .filter(name => s.includes(name));
  if (brands.length > 1) warnings.push("Há mais de uma marca no pedido. Informe uma única marca.");
  else if (brands.length === 1) filters.brand = brands[0].split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const hasFactor = inText(s, /\b(?:factor|ybr)\b/);
  const hasHondaCG = inText(s, /\b(?:cg|titan|fan|start|cargo)\b/);
  const isTitan = inText(s, /\btitan\b/), isFan = inText(s, /\bfan\b/), isStart = inText(s, /\bstart\b/);
  const hondaVersions = [isTitan && "Titan", isFan && "Fan", isStart && "Start"].filter(Boolean);
  if (hondaVersions.length > 1) warnings.push("Você citou versões diferentes (" + hondaVersions.join(" e ") + "). Escolha apenas uma.");
  if (hasFactor && hasHondaCG) warnings.push("Foram citados modelos de fabricantes diferentes. Especifique somente uma moto.");

  const displacement = [...s.matchAll(/\b(110|115|125|135|150|160|190|200|250|300|350|400|600|650)\b/g)].find(m=>!typedAt(m.index));
  if (hasFactor && !hasHondaCG) {
    if (filters.brand && norm(filters.brand) !== "yamaha") warnings.push("Factor/YBR não corresponde à marca informada.");
    else {
      filters.brand = "Yamaha";
      filters.model = displacement ? displacement[1] : "";
      filters.version = inText(s, /\bfactor\b/) ? "Factor" : "YBR";
    }
  } else if (hasHondaCG && !hasFactor) {
    if (filters.brand && norm(filters.brand) !== "honda") warnings.push("CG/Titan/Fan não corresponde à marca informada.");
    else {
      filters.brand = "Honda";
      filters.model = displacement ? "CG " + displacement[1] : "";
      if (hondaVersions.length === 1) filters.version = hondaVersions[0];
    }
  } else if (inText(s, /\bbiz\b/)) {
    if (filters.brand && norm(filters.brand) !== "honda") warnings.push("Biz não corresponde à marca informada.");
    else {filters.brand = "Honda"; filters.model = displacement ? "Biz " + displacement[1] : "Biz"; filters.version = "";}
  } else if (inText(s, /\b(?:fazer|fz25)\b/)) {
    if (filters.brand && norm(filters.brand) !== "yamaha") warnings.push("Fazer não corresponde à marca informada.");
    else {filters.brand = "Yamaha"; filters.model = displacement ? "Fazer " + displacement[1] : "Fazer"; filters.version = "";}
  }
  const namedModels=[[/\bdr\s*160\b/,"Suzuki","DR160"],[/\bninja\s*400\b/,"Kawasaki","Ninja 400"],[/\b(?:mt\s*03)\b/,"Yamaha","MT-03"],[/\bcb\s*300\b/,"Honda","CB 300"]];
  for(const [pattern,brand,model] of namedModels)if(pattern.test(s)){
    if(filters.brand&&norm(filters.brand)!==norm(brand))warnings.push("O modelo citado não corresponde à marca informada.");
    else Object.assign(filters,{brand,model,version:""});
  }

  // Modelo explícito não reconhecido (ex.: XRE 300) requer interpretação remota.
  // Pedido parcial como "Honda em Campinas" ainda pode manter o modelo atual.
  const brandWord=filters.brand?norm(filters.brand).replace(/[^a-z0-9-]/g,"\\  const range = [...s.matchAll(/\b((?:19|20)\d{2})\s*(?:a|ate|e|-)\s*((?:19|20)\d{2})\b/g)].find(m=>!typedAt(m.index)&&!typedAt(m.index+m[0].length-m[2].length));"):"";
  const afterBrand=brandWord?s.match(new RegExp("\\b"+brandWord+"\\s+([a-z][a-z0-9-]{1,24})\\b"))?.[1]:"";
  const neutralWords=new Set(["em","no","na","nos","nas","de","do","da","dos","das","para","por","com","ano","anos","entre","ate","partir","a","e","modelo","fabricacao","moto","motocicleta","usada","usado","sem","preco","valor","maximo","minimo","raio","reais"]);
  const needsRemoteModel=Boolean(filters.brand&&!filters.model&&
    (displacement||(afterBrand&&!neutralWords.has(afterBrand))));

  const range = [...s.matchAll(/\b((?:19|20)\d{2})\s*(?:a|ate|e|-)\s*((?:19|20)\d{2})\b/g)].find(m=>!typedAt(m.index)&&!typedAt(m.index+m[0].length-m[2].length));
  if (range) {
    const start = Number(range[1]), end = Number(range[2]);
    if (start <= end) {filters.yearFrom = String(start); filters.yearTo = String(end);}
    else warnings.push("A faixa de anos está invertida.");
  } else {
    const years = [...s.matchAll(/\b((?:19|20)\d{2})\b/g)].filter(m=>!typedAt(m.index));
    if(years.length===1){
      const one=years[0],before=s.slice(Math.max(0,one.index-42),one.index),after=s.slice(one.index+one[0].length,one.index+one[0].length+42);
      const minimum=/\b(?:a partir de|desde|no minimo(?: de)?|pelo menos|depois de)\s*$/.test(before)||
        /^\s*(?:em diante|ou mais nov[ao]s?|ou mais recentes?|para (?:cima|frente))\b/.test(after);
      const maximum=/\b(?:ate|no maximo(?: de)?|antes de)\s*$/.test(before)||
        /^\s*(?:ou mais antig[ao]s?|ou anteriores?)\b/.test(after);
      if(minimum&&maximum)warnings.push("Limites de ano contraditórios; informe a faixa desejada.");
      else if(minimum){filters.yearFrom=one[1];filters.yearTo="";}
      else if(maximum){filters.yearFrom="";filters.yearTo=one[1];}
      else{filters.yearFrom=one[1];filters.yearTo=one[1];}
    }else if(years.length>1)warnings.push("Há vários anos sem uma faixa clara. Especifique o intervalo.");
  }
  if(/\b(?:fabricacao|fabricada|fabricado)\b/.test(s))filters.yearType="make";
  else if(filters.yearFrom||/\b(?:ano[- ]?modelo|modelo de)\b/.test(s))filters.yearType="model";
  // Cidades reconhecidas por nome inequívoco; jamais usar localização aproximada do aparelho.
  const places = [
    ["sao jose do rio preto", "São José do Rio Preto", "SP"],
    ["ribeirao preto", "Ribeirão Preto", "SP"],
    ["sao paulo", "São Paulo", "SP"],
    ["campinas", "Campinas", "SP"],
    ["goiania", "Goiânia", "GO"],
    ["belo horizonte", "Belo Horizonte", "MG"],
    ["curitiba", "Curitiba", "PR"],
    ["porto alegre", "Porto Alegre", "RS"],
    ["brasilia", "Brasília", "DF"]
  ];
  const cities = places.filter(([name]) => s.includes(name));
  if (cities.length === 1) {
    filters.originCity = cities[0][1];
    filters.uf = cities[0][2];
  } else if (cities.length > 1) {
    warnings.push("Foram identificadas várias cidades. Especifique a cidade de origem.");
  }
  // "Rio Preto" sozinho pode referir-se a municípios diferentes. Usar somente
  // quando o pedido contém "SP" ou quando já está selecionada a cidade correspondente.
  if (!filters.originCity && /\brio preto\b/.test(s) &&
      (/\bsp\b/.test(s) || norm(previous.originCity) === "sao jose do rio preto")) {
    filters.originCity = "São José do Rio Preto";
    filters.uf = "SP";
  }
  let ufExplicit = s.match(/\b(?:uf|estado)\s*[:\-]?\s*(sp|mg|go|pr|rs|rj|sc|mt|ms|ba|df|es|pa|pb|pe|ce|rn|ro|rr|to|ma|pi|al|se|ac|am|ap)\b/);
  if(!ufExplicit)for(const point of municipalitiesInText(raw)){
    const name=norm(point.name),index=s.indexOf(name);if(index<0)continue;
    const suffix=s.slice(index+name.length).match(/^[\s/,-]+(sp|mg|go|pr|rs|rj|sc|mt|ms|ba|df|es|pa|pb|pe|ce|rn|ro|rr|to|ma|pi|al|se|ac|am|ap)\b/);
    if(suffix&&(suffix[1].toUpperCase()===point.uf||!["se","to","am"].includes(suffix[1])||raw.includes(suffix[1].toUpperCase()))){ufExplicit=suffix;break;}
  }
  if (ufExplicit) {
    const uf = ufExplicit[1].toUpperCase();
    if (filters.uf && filters.uf !== uf) warnings.push("A cidade informada não corresponde à UF solicitada.");
    else filters.uf = uf;
  }
  if(!filters.originCity&&/\b(?:em|cidade|origem|municipio)\b/.test(s)&&!(/\brio preto\b/.test(s)&&!(/\bsp\b/.test(s)||norm(previous.originCity)==="sao jose do rio preto"))){
    const places=municipalitiesInText(raw,filters.uf||"");
    if(places.length===1){filters.originCity=places[0].name;filters.uf=places[0].uf;}
    else if(places.length>1)warnings.push("Cidade ambígua; informe nome completo e UF.");
  }
  const seller = /\bparticular(?:es)?\b/.test(s) ? "particular" : /\b(?:loja|revenda|concessionaria)\b/.test(s) ? "loja" : "";
  if (seller) filters.sellerType = seller;
  Object.assign(filters,quantities.filters);warnings.push(...quantities.warnings);
  for(const [a,b,label] of [["priceMin","priceMax","preço"],["kmMin","kmMax","quilometragem"]])
    if(filters[a]!==undefined&&filters[a]!==""&&filters[b]!==undefined&&filters[b]!==""&&Number(filters[a])>Number(filters[b]))warnings.push("A faixa de "+label+" está invertida.");
  const colorText=filters.originCity?s.replace(norm(filters.originCity),""):s;
  if (/\b(?:preta|preto|vermelha|vermelho|azul|branca|branco)\b/.test(colorText) &&
      !/\b(?:rio preto|ribeirao preto)\b/.test(s)) warnings.push("A cor da moto não é um filtro disponível nesta pesquisa.");
  return {filters, warnings:[...new Set(warnings)], mode:"local", evidence:quantities.evidence, recognized:Object.keys(filters).length>0, needsRemoteModel, notice:"Interpretação por regras locais, sem usar IA remota. Confira os filtros."};
}

export function mergeIntentFilters(previous, interpreted) {
  const original = previous && typeof previous === "object" ? previous : {};
  const incoming = interpreted && typeof interpreted === "object" ? interpreted : {};
  const changedVehicle = (incoming.brand && norm(incoming.brand) !== norm(original.brand)) ||
    (incoming.model && norm(incoming.model) !== norm(original.model));
  // Não transportar filtros de outra moto (ex.: Yamaha Factor → Kawasaki Ninja).
  // Preservar apenas localização e preferências geográficas, sem inventar dados.
  const base=changedVehicle?{
    ...original,model:incoming.model||"",version:"",yearFrom:"",yearTo:"",priceMin:"",priceMax:"",
    kmMin:"",kmMax:"",sellerType:"all"
  }:original;
  return {...base,...incoming};
}
