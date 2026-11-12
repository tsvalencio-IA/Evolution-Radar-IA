import test,{after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initializeTestEnvironment} from "@firebase/rules-unit-testing";
import * as api from "firebase/database";
import {workspaceConfig} from "../../public/workspace-config.js";
import {manageMember} from "../../public/team-admin.js";
import {saveSharedLead,archiveSharedLead,saveSharedSearch} from "../../public/team-data.js";

const rules=readFileSync(new URL("../../database.rules.json",import.meta.url),"utf8");
const env=await initializeTestEnvironment({projectId:"demo-evolution-radar-team",database:{rules}});
after(async()=>env.cleanup());
const owner={uid:workspaceConfig.ownerUid},user={uid:"team-member-1"};
const ownerDb=env.authenticatedContext(owner.uid,{email:"owner@example.test"}).database();
const memberDb=env.authenticatedContext(user.uid,{email:"member@example.test"}).database();
const root="workspaces/evolution-motos";
const request={name:"Colaborador",email:"member@example.test",status:"pending",
  sponsorUid:owner.uid,createdAt:api.serverTimestamp()};
const readonly={view:true,search:true,create:true,edit:false,delete:false};
test("membro solicita e padrinho aprova pela API do site",async()=>{
 await api.set(api.ref(memberDb,"registrationRequests/"+user.uid),request);
 await manageMember({db:ownerDb,api,user:owner,uid:user.uid,action:"approve",permissions:readonly});
 const record=(await api.get(api.ref(ownerDb,root+"/members/"+user.uid))).val();
 assert.equal(record.status,"approved");
 assert.equal(record.permissions.edit,false);
 assert.equal((await api.get(api.ref(ownerDb,"registrationRequests/"+user.uid))).val().status,"approved");
 const audit=(await api.get(api.ref(ownerDb,root+"/adminAudit"))).val();
 assert.ok(Object.values(audit).some(x=>x.action==="approve"&&x.actorUid===owner.uid));
});
test("membro cria anúncio pela API sem apagar original",async()=>{
 const result=await saveSharedLead({db:memberDb,api,user,member:{status:"approved",permissions:readonly},
   lead:{id:"moto-001",brand:"Honda",model:"CG 160",version:"Titan"}});
 assert.equal(result.id,"moto-001");
 const value=(await api.get(api.ref(memberDb,root+"/leads/moto-001"))).val();
 assert.equal(value.brand,"Honda");assert.equal(value.createdBy,user.uid);
 assert.equal(typeof value.updatedAt,"number");
});
test("editar é negado antes da permissão e liberado depois",async()=>{
 await assert.rejects(()=>saveSharedLead({db:memberDb,api,user,member:{status:"approved",permissions:readonly},
  lead:{id:"moto-001",brand:"Honda",model:"CG 160",notes:"tentativa"}}),/permissão/i);
 await manageMember({db:ownerDb,api,user:owner,uid:user.uid,action:"permissions",
  permissions:{...readonly,edit:true}});
 const member={status:"approved",permissions:{...readonly,edit:true}};
 await saveSharedLead({db:memberDb,api,user,member,
  lead:{id:"moto-001",brand:"Honda",model:"CG 160",notes:"Alteração autorizada"}});
 assert.equal((await api.get(api.ref(memberDb,root+"/leads/moto-001"))).val().notes,"Alteração autorizada");
});
test("pesquisa compartilhada registra autor e timestamp do servidor",async()=>{
 const member={status:"approved",permissions:{...readonly,edit:true}};
 const key=await saveSharedSearch({db:memberDb,api,user,member,
   record:{filters:{brand:"Honda",model:"CG 160"},items:[],source:"Tavily",requestText:"teste"}});
 const saved=(await api.get(api.ref(ownerDb,root+"/searchHistory/"+key))).val();
 assert.equal(saved.createdBy,user.uid);assert.equal(typeof saved.createdAt,"number");
});
test("somente quem tem delete pode arquivar, sem apagar fisicamente",async()=>{
 const member={status:"approved",permissions:{...readonly,edit:true}};
 await assert.rejects(()=>archiveSharedLead({db:memberDb,api,user,member,id:"moto-001"}),/permissão/i);
 await manageMember({db:ownerDb,api,user:owner,uid:user.uid,action:"permissions",
   permissions:{...readonly,edit:true,delete:true}});
 await archiveSharedLead({db:memberDb,api,user,
   member:{status:"approved",permissions:{...readonly,edit:true,delete:true}},id:"moto-001"});
 const saved=(await api.get(api.ref(ownerDb,root+"/leads/moto-001"))).val();
 assert.equal(saved.archived,true);
 assert.equal(saved.archivedBy,user.uid);
});
test("suspensão bloqueia leitura no Firebase imediatamente",async()=>{
 await manageMember({db:ownerDb,api,user:owner,uid:user.uid,action:"suspend"});
 await assert.rejects(()=>api.get(api.ref(memberDb,root+"/leads")),/permission_denied/i);
});
