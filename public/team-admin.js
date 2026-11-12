import {workspaceConfig} from "./workspace-config.js";
import {DEFAULT_PERMISSIONS,normalizePermissions,validAccountName} from "./team-roles.mjs";
const ROOT="workspaces/"+workspaceConfig.id;
export async function manageMember({db,api,user,uid,action,permissions,name}){
  if(user?.uid!==workspaceConfig.ownerUid)throw Error("Somente o padrinho administra cadastros.");
  if(!uid||uid===workspaceConfig.ownerUid||!/^[\w-]{12,128}$/.test(uid))throw Error("UID de colaborador inválido.");
  const request=(await api.get(api.ref(db,"registrationRequests/"+uid))).val();
  if(!request)throw Error("Solicitação não encontrada.");
  const previous=(await api.get(api.ref(db,ROOT+"/members/"+uid))).val();
  const status={approve:"approved",activate:"approved",permissions:previous?.status,rename:previous?.status,suspend:"suspended",revoke:"revoked"}[action];
  if(!status)throw Error("Ação desconhecida.");
  if(!previous&&action!=="approve")throw Error("Aprove antes de administrar.");
  const displayName=action==="rename"?validAccountName(name):String(previous?.name||request.name);
  const roles=action==="approve"?normalizePermissions(permissions||DEFAULT_PERMISSIONS):
    action==="permissions"?normalizePermissions(permissions):normalizePermissions(previous.permissions);
  const now=api.serverTimestamp(),changes={};
  changes[ROOT+"/members/"+uid]={
    name:displayName,email:request.email,status,
    sponsorUid:workspaceConfig.ownerUid,permissions:roles,
    reviewedBy:workspaceConfig.ownerUid,reviewedAt:now,
    approvedAt:previous?.approvedAt||now
  };
  if(action==="approve"||action==="revoke"){
    changes["registrationRequests/"+uid+"/status"]=action==="approve"?"approved":"revoked";
    changes["registrationRequests/"+uid+"/reviewedAt"]=now;
    changes["registrationRequests/"+uid+"/reviewedBy"]=user.uid;
  }
  if(action==="rename")changes["registrationRequests/"+uid+"/name"]=displayName;
  const auditId=api.push(api.ref(db,ROOT+"/adminAudit")).key;
  changes[ROOT+"/adminAudit/"+auditId]={action,actorUid:user.uid,targetUid:uid,at:now};
  await api.update(api.ref(db),changes);
}
export async function rejectRequest({db,api,user,uid}){
  if(user?.uid!==workspaceConfig.ownerUid)throw Error("Somente padrinho pode recusar.");
  const record=(await api.get(api.ref(db,"registrationRequests/"+uid))).val();
  if(!record||record.status!=="pending")throw Error("Solicitação pendente não encontrada.");
  const now=api.serverTimestamp(),auditId=api.push(api.ref(db,ROOT+"/adminAudit")).key;
  await api.update(api.ref(db),{
    ["registrationRequests/"+uid+"/status"]:"rejected",
    ["registrationRequests/"+uid+"/reviewedAt"]:now,
    ["registrationRequests/"+uid+"/reviewedBy"]:user.uid,
    [ROOT+"/adminAudit/"+auditId]:{action:"reject",actorUid:user.uid,targetUid:uid,at:now}
  });
}
