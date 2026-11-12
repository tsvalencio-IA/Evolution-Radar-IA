import {workspaceConfig} from "./workspace-config.js";
import {safeLeadId,canAccess} from "./team-roles.mjs";
const ROOT="workspaces/"+workspaceConfig.id;
export function memberAllowed(user,member,action){
  return user?.uid===workspaceConfig.ownerUid||canAccess(member,action);
}
export async function saveSharedLead({db,api,user,member,lead}){
  const id=safeLeadId(lead?.id),ref=api.ref(db,ROOT+"/leads/"+id);
  if(!lead.brand||!lead.model)throw Error("Marca e modelo são obrigatórios.");
  const snapshot=await api.get(ref),old=snapshot.val(),operation=old?"edit":"create";
  if(old?.archived)throw Error("Registro arquivado.");
  if(!memberAllowed(user,member,operation))throw Error("Sem permissão para "+operation);
  const item={...lead,id,archived:false,createdBy:old?.createdBy||user.uid,
    createdAt:old?.createdAt||new Date().toISOString(),
    updatedBy:user.uid,updatedAt:api.serverTimestamp()};
  const result=await api.runTransaction(ref,existing=>{
    // RTDB pode iniciar a transação com null antes de hidratar o cache,
    // mesmo após get(). Usar o snapshot lido como base inicial.
    if(!old&&existing)return;
    const basis=existing||old;
    if(basis?.archived)return;
    return {...item,createdBy:basis?.createdBy||item.createdBy,
      createdAt:basis?.createdAt||item.createdAt};
  },{applyLocally:false});
  if(!result.committed)throw Error("Registro modificado por outra pessoa. Atualize antes de editar.");
  return item;
}
export async function archiveSharedLead({db,api,user,member,id}){
  if(!memberAllowed(user,member,"delete"))throw Error("Sem permissão para arquivar.");
  const ref=api.ref(db,ROOT+"/leads/"+safeLeadId(id));
  const previous=(await api.get(ref)).val();
  if(!previous||previous.archived)throw Error("Registro não encontrado ou já arquivado.");
  const result=await api.runTransaction(ref,current=>{
    const base=current||previous;
    if(!base||base.archived)return;
    return {...base,archived:true,archivedBy:user.uid,archivedAt:api.serverTimestamp(),
      updatedBy:user.uid,updatedAt:api.serverTimestamp()};
  },{applyLocally:false});
  if(!result.committed)throw Error("Registro já arquivado.");
}
export async function saveSharedSearch({db,api,user,member,record}){
  if(!memberAllowed(user,member,"search"))throw Error("Você não tem permissão para pesquisar.");
  const ref=api.push(api.ref(db,ROOT+"/searchHistory"));
  await api.set(ref,{...record,createdBy:user.uid,createdAt:api.serverTimestamp()});
  return ref.key;
}
export async function copyLegacyLeads({db,api,user,member,leads}){
  if(user?.uid!==workspaceConfig.ownerUid)throw Error("Só o padrinho copia os dados antigos.");
  if(!Array.isArray(leads)||leads.length>5000)throw Error("Quantidade inválida de registros.");
  let copied=0,skipped=0;
  for(const lead of leads){
    const id=safeLeadId(lead.id),ref=api.ref(db,ROOT+"/leads/"+id);
    if((await api.get(ref)).exists()){skipped++;continue;}
    await saveSharedLead({db,api,user,member,lead});copied++;
  }
  return {copied,skipped};
}
