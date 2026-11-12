import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {workspaceConfig} from "../public/workspace-config.js";
import {DEFAULT_PERMISSIONS,normalizePermissions,canAccess,validAccountName,memberStatus} from "../public/team-roles.mjs";
test("conta do padrinho está configurada sem expor credenciais",()=>{
 assert.match(workspaceConfig.ownerUid,/^[a-zA-Z0-9_-]{20,128}$/);
 assert.equal(workspaceConfig.id,"evolution-motos");
});
test("privilégios são individuais, sem edit/delete por padrão",()=>{
 assert.deepEqual({...DEFAULT_PERMISSIONS},{view:true,search:true,create:true,edit:false,delete:false});
 assert.equal(canAccess({status:"pending",permissions:DEFAULT_PERMISSIONS},"search"),false);
 assert.equal(canAccess({status:"suspended",permissions:DEFAULT_PERMISSIONS},"search"),false);
 assert.equal(canAccess({status:"revoked",permissions:DEFAULT_PERMISSIONS},"search"),false);
 assert.equal(canAccess({status:"approved",permissions:DEFAULT_PERMISSIONS},"search"),true);
 assert.equal(canAccess({status:"approved",permissions:DEFAULT_PERMISSIONS},"delete"),false);
 assert.deepEqual(normalizePermissions({view:"true",search:1,edit:true}),
  {view:false,search:false,create:false,edit:true,delete:false});
});
test("nome do solicitante não é aceito em branco",()=>{
 assert.throws(()=>validAccountName(" "),/nome/i);
 assert.equal(validAccountName(" Ana  da  Silva "),"Ana da Silva");
});
test("status e estrutura das regras preservam usuários antigos",()=>{
 const rules=JSON.parse(readFileSync(new URL("../database.rules.json",import.meta.url),"utf8")).rules;
 assert.equal(rules[".read"],false);
 assert.equal(rules[".write"],false);
 assert.equal(rules.users.$uid[".read"],"auth != null && auth.uid === $uid");
 assert.equal(rules.workspaces["evolution-motos"].members.$uid[".read"].includes("auth.uid === $uid"),true);
 assert.match(rules.registrationRequests.$uid[".write"],/status'\).val\(\) === 'pending'/);
 assert.equal(memberStatus({status:"revoked"}),"revoked");
 assert.equal(memberStatus(null,true),"approved");
 assert.match(rules.workspaces["evolution-motos"].leads.$leadId[".write"],/createdBy/);
});
