// O silêncio do anúncio nunca é evidência de ausência de ocorrência.
export const RISK_TYPES=Object.freeze({auction:"Passagem por leilão",damage:"Histórico de sinistro",theft:"Roubo ou furto",recovery:"Recuperação após roubo/furto",chassis:"Remarcação de chassi",administrative:"Restrição documental/administrativa",transfer:"Impedimento de transferência",other:"Outra condição eliminatória"});
const clip=(x,n=300)=>String(x??"").trim().slice(0,n);
export function normalizeRiskReport(input={}){
  const items={};
  for(const key of Object.keys(RISK_TYPES)){
    const raw=input?.items?.[key]||{},status=["occurrence","absence-in-scope"].includes(raw.status)?raw.status:"unknown";
    const source=clip(raw.source),reference=clip(raw.reference),scope=clip(raw.scope,600),date=Date.parse(raw.checkedAt||"");
    const supported=status!=="unknown"&&source&&reference&&scope&&Number.isFinite(date)&&date<=Date.now()+300000;
    items[key]=supported?{status,source,reference,scope,checkedAt:new Date(date).toISOString()}:{status:"unknown"};
  }
  return {schemaVersion:1,items};
}
export function assessVehicleRisk(input,policy={}){
  const report=normalizeRiskReport(input),eliminated=[],unknown=[];
  const selected=Object.keys(RISK_TYPES).filter(key=>policy[key]!==false);
  for(const key of selected){
    if(report.items[key].status==="occurrence")eliminated.push(key);
    else if(report.items[key].status==="unknown")unknown.push(key);
  }
  return {bucket:eliminated.length?"eliminated":unknown.length?"pending":"absence-in-scope",eliminated,unknown,report};
}
// Nenhum fornecedor é conectado implicitamente. Adaptadores autorizados fornecem
// o mesmo contrato; os dados pessoais do veículo não aparecem no relatório.
export async function queryVehicleRisk({adapter,vehicle,authorization}={}){
  if(!adapter||typeof adapter.query!=="function")return {status:"not-configured",report:normalizeRiskReport()};
  if(authorization?.authorized!==true||!clip(authorization.purpose))throw Object.assign(Error("Autorização e finalidade obrigatórias."),{code:"RISK_AUTHORIZATION_REQUIRED"});
  if(!vehicle||(!clip(vehicle.plate)&&!clip(vehicle.chassis)))throw Object.assign(Error("Identificador do veículo obrigatório."),{code:"RISK_IDENTIFIER_REQUIRED"});
  try{return {status:"queried",report:normalizeRiskReport(await adapter.query({vehicle,authorization}))};}
  catch{throw Object.assign(Error("Consulta veicular não concluída."),{code:"RISK_PROVIDER_FAILED"});}
}
