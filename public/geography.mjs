import {resolveMunicipality,assessMunicipalityRadius} from "./br-municipios.mjs";
export function describeGeography(lead={},filters={}){
  const declared={city:String(lead.city||"").slice(0,100),uf:String(lead.uf||"").slice(0,2).toUpperCase()};
  const found=resolveMunicipality(declared.city,declared.uf),area=assessMunicipalityRadius(filters,declared.city,declared.uf);
  const evidence=normalizeDistanceEvidence(lead.distanceEvidence),n=Number(lead.distanceKm);
  return {declared,municipality:found?{city:found.name,uf:found.uf}:null,
    estimated:Number.isFinite(area.distanceKm)?{km:area.distanceKm,method:"municipal-centers-straight-line"}:null,
    verified:lead.distanceVerified===true&&lead.distanceKm!==null&&lead.distanceKm!==""&&Number.isFinite(n)&&n>=0&&evidence?{km:n,...evidence}:null,
    legacyDeclaration:lead.distanceVerified===true&&!evidence};
}
export function normalizeDistanceEvidence(value){
  if(!value||!["route","straight-line"].includes(value.kind))return null;
  const source=String(value.source||"").trim().slice(0,400),date=Date.parse(value.checkedAt||"");
  return source&&Number.isFinite(date)&&date<=Date.now()+300000?{kind:value.kind,source,checkedAt:new Date(date).toISOString()}:null;
}
