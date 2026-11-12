import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {workspaceConfig} from "../public/workspace-config.js";
import {normalizePermissions,canAccess} from "../public/team-roles.mjs";

test("confirmar e-mail renova ID token antes de reabrir a base compartilhada",async()=>{
  const events=[],access=[];
  const user={uid:"session-test-member",emailVerified:false,getIdToken:async force=>{events.push("token:"+force);return "refreshed";}};
  const auth={currentUser:user};
  const sdk={getApps:()=>[{options:{projectId:"test"}}]};
  const authAPI={getAuth:()=>auth,onAuthStateChanged:(_auth,fn)=>fn(user),reload:async()=>{events.push("reload");user.emailVerified=true;}};
  const api={getDatabase:()=>({}),ref:(_db,path)=>path,query:ref=>ref,orderByKey:()=>{},limitToLast:()=>{},
    onValue:(ref,fn)=>{
      if(ref.endsWith("/leads"))events.push("shared-read");
      fn({val:()=>ref.includes("/members/")?{status:"approved",permissions:{view:true,search:true}}:null});
      return ()=>{};
    }};
  const code=readFileSync(new URL("../public/team-client.js",import.meta.url),"utf8")
    .replace(/^import .*;\r?\n/gm,"").replace("export async function openTeam","async function openTeam")
    .replace(/\bimport\(/g,"loadSDK(");
  const loadSDK=async url=>url.endsWith("firebase-app.js")?sdk:url.endsWith("firebase-auth.js")?authAPI:api;
  const openTeam=new Function("workspaceConfig","searchWorkerUrl","normalizePermissions","canAccess","loadSDK",code+"\nreturn openTeam;")
    (workspaceConfig,"https://worker.test",normalizePermissions,canAccess,loadSDK);
  const team=await openTeam({projectId:"test"},{onAccess:value=>access.push(value.status)});
  assert.equal(access.at(-1),"email-unverified");assert.deepEqual(events,[]);
  assert.equal(await team.refreshVerification(),true);
  assert.deepEqual(events,["reload","token:true","shared-read"]);
  assert.equal(access.at(-1),"approved");
});
