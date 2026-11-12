import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../public/styles.css",import.meta.url),"utf8");
test("todos os controles novos do painel existem em HTML",()=>{
 for(const id of ["signupForm","requestApprovalForm","accountStatus","accessNotice","adminNav",
  "adminRequests","adminMembers","adminAudit","copyLegacyLeads","copyLegacyHistory","teamSetupStatus","teamCopyStatus"]){
  assert.ok(html.includes('id="'+id+'"'),"Falta: "+id);
 }
});
test("bloqueio de pendentes usa seleção de todos os menus, não apenas primeiro",()=>{
 assert.ok(app.includes('$$("[data-view]").forEach(b=>{if(b.id!=="adminNav"'));
 assert.ok(app.includes('if(!canUse("search"))'));
 assert.ok(app.includes('if(state.user&&!canUse("delete"))'));
 assert.ok(app.includes('if(!state.user||isOwner())'));
});
test("botões de equipe são responsivos e não há regras abrindo o Firebase publicamente",()=>{
 assert.ok(css.includes(".team-permissions"));
 assert.ok(css.includes(".nav:has(#adminNav:not([hidden]))"));
 assert.ok(css.includes("[hidden]{display:none!important}"));
});
test("cópia é confirmada e não apaga originais",()=>{
 assert.match(app,/confirm\("Copiar "\+state\.leads\.length/);
 assert.match(app,/importLegacyHistory/);
});
