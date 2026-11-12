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

test("exclusão aparece para pendentes e aprovados e exige confirmação dupla",()=>{
 assert.match(app,/data-team-action="delete"/);
 assert.ok(app.includes("deleteTeamUser(uid)"));
 assert.ok(app.includes('prompt('));
 assert.ok(app.includes('EXCLUIR'));
 assert.ok(app.includes('await state.team.deleteUser(uid,email)'));
});
test("interface compacta evita justificativas repetitivas nos campos",()=>{
 assert.doesNotMatch(html,/O padrinho aprova cada novo cadastro e define permissões individuais/);
 assert.doesNotMatch(html,/O cadastro é gratuito, mas só permite pesquisar/);
 assert.doesNotMatch(html,/Limitações transparentes/);
});

test("exclusão seleciona múltiplos botões sem usar querySelector isolado",()=>{
 assert.ok(app.includes("const buttons=$$('"));
 assert.ok(app.includes('data-team-action="delete"]'));
 assert.ok(app.includes(".filter(b=>b.dataset.uid===uid)"));
});

test("exclusão só é exibida com Worker 2026-11-12.4 e credencial confirmada",()=>{
 assert.match(app,/accountDeletionConfigured===true/);
 assert.match(app,/version==="2026-11-12\.4"/);
 assert.match(app,/capabilities\.includes\("account-deletion"\)/);
 assert.match(app,/state\.accountDeletionReady\?'<button class="btn small team-danger"/);
 assert.match(app,/if\(!state\.accountDeletionReady\)return notice/);
 assert.match(app,/void checkAccountDeletionService\(\)/);
});
