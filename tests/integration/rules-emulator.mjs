import test,{after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initializeTestEnvironment,assertFails,assertSucceeds} from "@firebase/rules-unit-testing";
import {ref,get,set,remove,serverTimestamp} from "firebase/database";
import {workspaceConfig} from "../../public/workspace-config.js";

const owner=workspaceConfig.ownerUid,uid="approved-tester-001",mail="tester@example.test";
const rules=readFileSync(new URL("../../database.rules.json",import.meta.url),"utf8");
const env=await initializeTestEnvironment({projectId:"demo-evolution-radar",
  database:{rules}});
after(async()=>await env.cleanup());
const administrator=env.authenticatedContext(owner,{email:"admin@example.test"}).database();
const applicant=env.authenticatedContext(uid,{email:mail}).database();
const stranger=env.authenticatedContext("intruder-001",{email:"intruder@example.test"}).database();
const anon=env.unauthenticatedContext().database();
const root="workspaces/evolution-motos";
const path="registrationRequests/"+uid;
const request={
  name:"Colaborador de Teste",email:mail,status:"pending",
  sponsorUid:owner,createdAt:serverTimestamp()
};
const member=(permissions,status="approved")=>({
  name:"Colaborador de Teste",email:mail,status,sponsorUid:owner,
  reviewedBy:owner,reviewedAt:serverTimestamp(),approvedAt:serverTimestamp(),
  permissions
});
const perms={view:true,search:true,create:true,edit:false,delete:false};

test("nega leitura anônima e de terceiros dos registros privados",async()=>{
  await assertFails(get(ref(anon,"users/"+owner+"/data")));
  await assertFails(get(ref(stranger,"users/"+owner+"/data")));
  await assertFails(get(ref(anon,root+"/leads")));
});
test("solicitante cria apenas pedido pendente vinculado ao padrinho",async()=>{
  await assertSucceeds(set(ref(applicant,path),request));
  await assertFails(set(ref(applicant,"registrationRequests/intruder-001"),request));
  await assertFails(set(ref(stranger,"registrationRequests/intruder-001"),{
    ...request,email:"tester@example.test"}));
  await assertFails(set(ref(applicant,path),{...request,status:"approved"}));
  await assertSucceeds(get(ref(administrator,"registrationRequests")));
});
test("ninguém pode aprovar a si mesmo",async()=>{
  await assertFails(set(ref(applicant,root+"/members/"+uid),member(perms)));
  await assertFails(get(ref(applicant,root+"/leads")));
  await assertFails(set(ref(applicant,root+"/leads/lead-a"),{
    id:"lead-a",brand:"Honda",model:"CG 160",archived:false,
    createdBy:uid,createdAt:"2026-11-12T12:00:00.000Z",
    updatedBy:uid,updatedAt:serverTimestamp()
  }));
});
test("padrinho aprova; equipe lê e cadastra, mas não edita nem exclui",async()=>{
  await assertSucceeds(set(ref(administrator,root+"/members/"+uid),member(perms)));
  await assertSucceeds(get(ref(applicant,root+"/leads")));
  const leadRef=ref(applicant,root+"/leads/lead-a");
  const lead={id:"lead-a",brand:"Honda",model:"CG 160",archived:false,
    createdBy:uid,createdAt:"2026-11-12T12:00:00.000Z",
    updatedBy:uid,updatedAt:serverTimestamp()};
  await assertSucceeds(set(leadRef,lead));
  await assertFails(set(leadRef,{...lead,notes:"Edição indevida"}));
  await assertFails(set(leadRef,{...lead,archived:true}));
  await assertFails(remove(leadRef));
  await assertFails(get(ref(stranger,root+"/leads")));
});
test("padrinho libera edição, mas arquivamento continua bloqueado",async()=>{
  await assertSucceeds(set(ref(administrator,root+"/members/"+uid),member({...perms,edit:true})));
  const leadRef=ref(applicant,root+"/leads/lead-a"),old=(await get(leadRef)).val();
  await assertSucceeds(set(leadRef,{...old,notes:"Aprovada a edição",updatedBy:uid,updatedAt:serverTimestamp()}));
  await assertFails(set(leadRef,{...old,archived:true,updatedAt:serverTimestamp()}));
});
test("com permissão excluir, registro é arquivado; exclusão física continua proibida",async()=>{
  await assertSucceeds(set(ref(administrator,root+"/members/"+uid),member({...perms,edit:true,delete:true})));
  const leadRef=ref(applicant,root+"/leads/lead-a"),old=(await get(leadRef)).val();
  await assertSucceeds(set(leadRef,{...old,archived:true,archivedBy:uid,archivedAt:serverTimestamp(),
    updatedBy:uid,updatedAt:serverTimestamp()}));
  await assertFails(remove(leadRef));
});
test("suspensão e revogação bloqueiam leitura sem alterar cadastros existentes",async()=>{
  await assertSucceeds(set(ref(administrator,root+"/members/"+uid),member(perms,"suspended")));
  await assertFails(get(ref(applicant,root+"/leads")));
  await assertSucceeds(set(ref(administrator,root+"/members/"+uid),member(perms,"revoked")));
  await assertFails(get(ref(applicant,root+"/searchHistory")));
});
