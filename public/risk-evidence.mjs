// Sinais comerciais na descrição acessível de um anúncio.
// NÃO substitui histórico veicular oficial nem atesta ausência de ocorrências.
const normalizeRiskText=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/\s+/g," ").trim().slice(0,12000);
const rules={
  auction:{
    positive:/\b(?:passagem por leilao|(?:moto|veiculo) de leilao|oriund[ao] de leilao|proveniente de leilao|arrematad[ao] em leilao|leilao\s*[:=-]\s*sim)\b/,
    negative:/\b(?:sem passagem por leilao|nao (?:tem|possui) passagem por leilao|passagem por leilao\s*[:=-]\s*(?:nao|nenhuma?)|sem historico de leilao)\b/g
  },
  accident:{
    positive:/\b(?:passagem por sinistro|veiculo sinistrado|moto sinistrada|sinistro recuperado)\b/,
    negative:/\b(?:sem passagem por sinistro|sem sinistro|nao (?:tem|possui) sinistro)\b/g
  },
  theftRecovery:{
    positive:/\b(?:recuperad[ao] de (?:roubo|furto)|(?:roubo|furto) recuperado|passagem por (?:roubo|furto))\b/,
    negative:/\b(?:sem passagem por (?:roubo|furto)|sem (?:roubo|furto))\b/g
  },
  chassisRemark:{
    positive:/\b(?:chassi remarcado|chassi regravado|remarcacao de chassi)\b/,
    negative:/\b(?:sem remarcacao de chassi|chassi nao remarcado)\b/g
  },
  restriction:{
    positive:/\b(?:restricao judicial|bloqueio judicial|impedimento de transferencia)\b/,
    negative:/\b(?:sem restricao judicial|sem bloqueio judicial|sem impedimento de transferencia)\b/g
  }
};
export const REPORTED_RISK_REASONS=Object.freeze({
  auction:"O anúncio declara passagem por leilão (sem laudo independente)",
  accident:"O anúncio declara sinistro (sem laudo independente)",
  theftRecovery:"O anúncio declara roubo/furto recuperado (sem laudo independente)",
  chassisRemark:"O anúncio declara chassi remarcado (sem laudo independente)",
  restriction:"O anúncio declara restrição ou impedimento (sem verificação oficial)"
});
export function assessAdvertisedRisks(content){
  const text=normalizeRiskText(String(content??"").split(/(?:^|\n)\s*(?:an[uú]ncios relacionados|veja tamb[eé]m|motos similares|recomendados para voc[eê])/i)[0]);
  return Object.fromEntries(Object.entries(rules).map(([key,rule])=>{
    // Retira negações ANTES de procurar afirmações positivas. Uma negação não
    // equivale a certidão limpa: continua sem validação independente.
    const denied=Boolean(text.match(rule.negative));
    const withoutNegations=text.replace(rule.negative," ");
    return [key,rule.positive.test(withoutNegations)?"declared-present":
      denied?"seller-denied":"unknown"];
  }));
}
