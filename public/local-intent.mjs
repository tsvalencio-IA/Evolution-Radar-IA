// Alternativa determinística, gratuita e explícita quando /interpret não está publicado.
// Não substitui IA e não inventa anúncios, localidades, versões ou preços.
const norm = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const inText = (text, pattern) => pattern.test(text);

export function parseLocalIntent(message, previousFilters = {}) {
  const raw = String(message ?? "").slice(0, 450);
  const s = norm(raw);
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

  const displacement = s.match(/\b(110|115|125|135|150|160|190|200|250|300|350|400|600|650)\b/);
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

  // DR160/DR 160 constam entre as pesquisas reais do Radar.
  if (!filters.model && /\bdr\s*160\b/.test(s)) {
    if (filters.brand && norm(filters.brand) !== "suzuki") warnings.push("DR160 não corresponde à marca informada.");
    else {filters.brand = "Suzuki";filters.model = "DR 160";filters.version = "";}
  }
  const range = s.match(/\b((?:19|20)\d{2})\s*(?:a|ate|e|-)\s*((?:19|20)\d{2})\b/);
  if (range) {
    const start = Number(range[1]), end = Number(range[2]);
    if (start <= end) {filters.yearFrom = String(start); filters.yearTo = String(end);}
    else warnings.push("A faixa de anos está invertida.");
  } else {
    const years = [...s.matchAll(/\b((?:19|20)\d{2})\b/g)].map(x => x[1]);
    if (years.length === 1) {filters.yearFrom = years[0]; filters.yearTo = years[0];}
    else if (years.length > 1) warnings.push("Há vários anos sem uma faixa clara. Especifique o intervalo.");
  }
  // Unidade faz parte do valor: "até 20mil km" nunca é R$ 20.000.
  // Analisa todas as ocorrências porque preço e quilometragem podem coexistir.
  const pricePattern=/\b(?:ate|no maximo de|abaixo de|limite de)\s*(r\$\s*)?(\d[\d.,]*)(?:\s*(mil))?\b/gi;
  for(const hit of s.matchAll(pricePattern)){
    const rest=s.slice(hit.index+hit[0].length);
    if(/^\s*(?:km|kms|quilometros|rodados)\b/.test(rest))continue;
    const rawNumber=hit[2].replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(/,(?=\d{3}(?:\D|$))/g,"").replace(",",".");
    const n=Number(rawNumber)*(hit[3]?1000:1);
    if(Number.isFinite(n)&&n>=3000&&n<=1000000){filters.priceMax=String(n);break;}
  }
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
  const ufExplicit = s.match(/\b(?:uf|estado)\s*[:\-]?\s*(sp|mg|go|pr|rs|rj|sc|mt|ms|ba|df|es|pa|pb|pe|ce|rn|ro|rr|to|ma|pi|al|se|ac|am|ap)\b/);
  if (ufExplicit) {
    const uf = ufExplicit[1].toUpperCase();
    if (filters.uf && filters.uf !== uf) warnings.push("A cidade informada não corresponde à UF solicitada.");
    else filters.uf = uf;
  }
  const seller = /\bparticular(?:es)?\b/.test(s) ? "particular" : /\b(?:loja|revenda|concessionaria)\b/.test(s) ? "loja" : "";
  if (seller) filters.sellerType = seller;
  const radius = s.match(/\braio(?:\s+de)?\s*(\d{1,4})\s*(?:km|quilometros)\b/);
  if (radius && Number(radius[1]) <= 1000) filters.radiusKm = radius[1];
  const km = s.match(/\b(?:ate|menos de|no maximo de|abaixo de|limite de)\s*(\d{1,6}(?:[.,]\d{3})*)(?:\s*(mil))?\s*(?:km|kms|quilometros|rodados)\b/);
  if (km) {
    const kmValue = Number(km[1].replace(/[.,]/g,""))*(km[2]?1000:1);
    if (kmValue > 0 && kmValue <= 300000) filters.kmMax = String(kmValue);
  }
  // Quantia escrita por extenso é interpretada apenas quando clara.
  const priceWords = s.match(/\b(?:ate|no maximo|abaixo de)\s*(?:r\$\s*)?(oito|sete|seis|cinco|nove|dez|onze|doze|quinze|vinte)\s+mil\b/);
  if (priceWords && !/^\s*(?:km|kms|quilometros|rodados)\b/.test(s.slice(priceWords.index+priceWords[0].length))) {
    const amounts={cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,quinze:15,vinte:20};
    filters.priceMax = String(amounts[priceWords[1]]*1000);
  }
  if (/\b(?:preta|preto|vermelha|vermelho|azul|branca|branco)\b/.test(s) &&
      !/\brio preto\b/.test(s)) warnings.push("A cor da moto não é um filtro disponível nesta pesquisa.");
  return {filters, warnings, mode:"local", notice:"Interpretação por regras locais, sem usar IA remota. Confira os filtros."};
}

export function mergeIntentFilters(previous, interpreted) {
  const original = previous && typeof previous === "object" ? previous : {};
  const incoming = interpreted && typeof interpreted === "object" ? interpreted : {};
  const changedVehicle = (incoming.brand && norm(incoming.brand) !== norm(original.brand)) ||
    (incoming.model && norm(incoming.model) !== norm(original.model));
  // Não transportar filtros de outra moto (ex.: Yamaha Factor → Kawasaki Ninja).
  // Preservar apenas localização e preferências geográficas, sem inventar dados.
  // Pedido completo (veículo + ano + cidade) inicia uma pesquisa nova,
  // mesmo para o mesmo modelo: não carrega preço/KM antigos silenciosamente.
  // Pedidos parciais mantêm o contexto para permitir refinamentos.
  const completeSearch=Boolean(incoming.brand&&incoming.model&&incoming.yearFrom&&incoming.originCity);
  const base=(changedVehicle||completeSearch)?{
    ...original,version:"",yearFrom:"",yearTo:"",priceMin:"",priceMax:"",
    kmMax:"",sellerType:"all"
  }:original;
  return {...base,...incoming};
}
