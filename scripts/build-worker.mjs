import {readFileSync,writeFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const parts=["public/br-municipios.mjs","public/listing-facts.mjs","public/risk-evidence.mjs","worker/evolution-search-worker.js"];
const body=parts.map(path=>readFileSync(new URL(path,root),"utf8").replace(/^import .*;\r?\n/gm,"")).join("\n");
const output="/* Evolution Radar IA — Worker único para o editor Cloudflare.\n * Gerado por npm run build:worker; nenhuma credencial está incluída.\n */\n"+body;
const target=new URL("deploy/evolution-radar-search-standalone.js",root);
if(process.argv.includes("--check")){
  if(readFileSync(target,"utf8")!==output)throw Error("Worker único desatualizado. Execute npm run build:worker.");
}else writeFileSync(target,output);
