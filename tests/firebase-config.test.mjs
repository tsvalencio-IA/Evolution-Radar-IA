import test from "node:test";
import assert from "node:assert/strict";
import {firebaseConfig} from "../public/firebase-config.js";

test("Firebase aponta para o banco correto da Evolution Radar IA", () => {
  assert.equal(firebaseConfig.projectId, "evolution-radar-ia");
  assert.equal(firebaseConfig.authDomain, "evolution-radar-ia.firebaseapp.com");
  assert.equal(firebaseConfig.databaseURL, "https://evolution-radar-ia-default-rtdb.firebaseio.com/");
  assert.equal(firebaseConfig.appId, "1:156060920013:web:737783da64aec345bae184");
});

test("Configuração Web não contém credenciais administrativas", () => {
  assert.equal("private_key" in firebaseConfig, false);
  assert.equal("serviceAccount" in firebaseConfig, false);
  assert.equal("uid" in firebaseConfig, false);
});
