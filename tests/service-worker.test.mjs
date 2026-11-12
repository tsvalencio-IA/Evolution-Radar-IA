import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const code=readFileSync(new URL("../public/sw.js",import.meta.url),"utf8");
function runServiceWorker(cacheValue){
 const events=new Map();
 const location={origin:"https://tsvalencio-ia.github.io"};
 const self={location,addEventListener:(name,fn)=>events.set(name,fn)};
 const caches={match:async()=>cacheValue};
 const context={self,caches,fetch:async()=>{throw Error("network unavailable")},URL,Response,Promise,console};
 runInNewContext(code,context);
 return events.get("fetch");
}
test("Service Worker devolve Response 503 sem rede e sem cache",async()=>{
 const handler=runServiceWorker(undefined);
 let result;
 handler({request:new Request("https://tsvalencio-ia.github.io/Evolution-Radar-IA/?utm_source=chatgpt.com"),
   respondWith:p=>{result=p},waitUntil:()=>{}});
 assert.ok(result instanceof Promise);
 const response=await result;
 assert.equal(response instanceof Response,true);
 assert.equal(response.status,503);
 assert.match(await response.text(),/Sem conexão/);
});
test("Service Worker entrega cache válido quando falha rede",async()=>{
 const cached=new Response("offline",{status:200});
 const handler=runServiceWorker(cached);
 let result;
 handler({request:new Request("https://tsvalencio-ia.github.io/Evolution-Radar-IA/app.js"),
   respondWith:p=>{result=p},waitUntil:()=>{}});
 const response=await result;
 assert.equal(response.status,200);
 assert.equal(await response.text(),"offline");
});
