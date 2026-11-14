const WORD_AMOUNTS={zero:0,um:1,dois:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,quatorze:14,catorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cento:100,cem:100};
const QUANTITY_PATTERN="(?:\\d[\\d.,]*|"+Object.keys(WORD_AMOUNTS).join("|")+")(?:\\s*mil)?";
const qNorm=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function quantityNumber(value){
  const s=qNorm(value).trim(),thousands=/mil$/.test(s),raw=s.replace(/\s*mil$/,"").trim();
  let amount=Object.hasOwn(WORD_AMOUNTS,raw)?WORD_AMOUNTS[raw]:Number(raw.includes(",")?raw.replace(/\./g,"").replace(",","."):/^\d{1,3}(?:\.\d{3})+$/.test(raw)?raw.replace(/\./g,""):raw);
  amount*=thousands?1000:1;return Number.isFinite(amount)&&amount>=0?amount:null;
}
export function parseIntentQuantities(message){
  const s=qNorm(message),filters={},warnings=[],evidence=[];
  const matches=[...s.matchAll(new RegExp("(^|[^a-z0-9])("+QUANTITY_PATTERN+")(?![a-z0-9])","g"))].map(m=>({start:m.index+m[1].length,end:m.index+m[0].length,raw:m[2],value:quantityNumber(m[2])}));
  const context=token=>{
    const before=s.slice(Math.max(0,token.start-55),token.start),after=s.slice(token.end,token.end+30);
    const distance=/^\s*(?:km|quilometros?)\b/.test(after),km=distance||/^\s*rodad[oa]s?\b/.test(after)||/\b(?:quilometragem|km)(?:\s+(?:maxim[oa]|minim[oa]|de|ate|entre|a partir de|no maximo de|no minimo de))*\s*[:=]?\s*$/.test(before);
    const radius=distance&&/\braio\s*(?:(?:de|ate|maximo)\s*)?$/.test(before);
    const currency=/r\$\s*$/.test(before)||/^\s*reais\b/.test(after)||/\b(?:preco|valor|orcamento)(?:\s+(?:maxim[oa]|minim[oa]|de|ate|entre|a partir de|no maximo de|no minimo de))*\s*[:=]?\s*(?:r\$\s*)?$/.test(before);
    return {before,after,type:radius?"radius":km?"km":currency?"price":""};
  };
  const assign=(key,value,token)=>{
    if(value===null||value>10000000)return warnings.push("Valor fora da faixa interpretável; confira a unidade.");
    if(Object.hasOwn(filters,key)&&filters[key]!==String(value))warnings.push("Limites contraditórios para "+key+"; informe um único limite.");
    else{filters[key]=String(value);evidence.push({field:key,start:token.start,end:token.end,unit:key.startsWith("price")?"BRL":key==="radiusKm"?"radius-km":"odometer-km"});}
  };
  const consumed=new Set();
  for(let i=0;i<matches.length-1;i++){
    const a=matches[i],b=matches[i+1],ca=context(a),cb=context(b),between=s.slice(a.end,b.start);
    if(!/^\s*(?:a|ate|e|-)\s*(?:r\$\s*)?$/.test(between)||!/\b(?:entre|de)\s*(?:r\$\s*)?$/.test(ca.before))continue;
    const type=ca.type||cb.type;if(!["price","km"].includes(type))continue;
    if(a.value>b.value)warnings.push("A faixa de "+(type==="km"?"quilometragem":"preço")+" está invertida.");
    else{assign(type+"Min",a.value,a);assign(type+"Max",b.value,b);}
    consumed.add(a);consumed.add(b);
  }
  for(const token of matches){
    if(consumed.has(token))continue;
    const c=context(token);
    if(c.type==="radius"){if(token.value<=1000)assign("radiusKm",token.value,token);else warnings.push("Informe um raio entre 0 e 1000 km.");continue;}
    const min=/\b(?:a partir de|pelo menos|no minimo(?: de)?|minim[oa]|acima de)\s*(?:r\$\s*)?$/.test(c.before);
    const max=/\b(?:ate|no maximo(?: de)?|maxim[oa]|abaixo de|menos de|limite(?: de)?)\s*(?:r\$\s*)?$/.test(c.before);
    if(c.type){
      if(min||max||c.type==="price"||token.value===0)assign(c.type+(min?"Min":"Max"),token.value,token);
      else warnings.push("Quilometragem sem limite claro; diga mínima ou máxima.");
    }else if((min||max)&&token.value>=3000){
      // Compatibilidade com pedidos usuais "até 18000"; nunca aplicar quando há unidade KM/raio.
      assign("price"+(min?"Min":"Max"),token.value,token);
    }else if((min||max)&&!(token.value>=1950&&token.value<=2100)){
      warnings.push("Valor sem unidade clara; informe reais, quilometragem ou raio.");
    }
  }
  for(const type of ["price","km"]){
    const field=type==="price"?"(?:preco|valor)":"(?:km|quilometragem)";
    if(new RegExp("(?:sem\\s+(?:limite\\s+(?:de\\s+)?)?|(?:limpar|remover|retirar|zerar)\\s+(?:o\\s+)?(?:limite\\s+de\\s+)?)"+field+"\\b").test(s)){
      filters[type+"Min"]="";filters[type+"Max"]="";
    }
  }
  return {filters,warnings,evidence};
}
