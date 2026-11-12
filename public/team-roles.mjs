export const DEFAULT_PERMISSIONS=Object.freeze({view:true,search:true,create:true,edit:false,delete:false});
export const PERMISSION_NAMES=Object.freeze(["view","search","create","edit","delete"]);
export function normalizePermissions(source={}){
  const value=source&&typeof source==="object"?source:{};
  return Object.fromEntries(PERMISSION_NAMES.map(k=>[k,value[k]===true]));
}
export function canAccess(member,action){
  return !!member&&member.status==="approved"&&PERMISSION_NAMES.includes(action)&&member.permissions?.[action]===true;
}
export function validAccountName(name){
  const clean=String(name||"").trim().replace(/\s+/g," ");
  if(clean.length<2||clean.length>90)throw Error("Informe nome de 2 a 90 caracteres.");
  return clean;
}
export function safeLeadId(value){
  const id=String(value||"");
  if(!/^[a-zA-Z0-9_-]{3,120}$/.test(id))throw Error("Identificador do registro inválido.");
  return id;
}
export function memberStatus(member,isOwner=false){
  if(isOwner)return "approved";
  return ["approved","suspended","revoked"].includes(member?.status)?member.status:"pending";
}
export function registeredRequest(request){
  return request && request.status==="pending";
}
