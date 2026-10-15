import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

// Exercise the browser adapter without contacting Firebase or sending SMS.
function setup() {
  const state = { sends: 0, confirmations: 0, signOuts: 0, failSend: false, failCode: false };
  class ApiError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
  }
  const modules = {
    "./api": { ApiError },
    "firebase/app": { getApps: () => [], initializeApp: () => ({}) },
    "firebase/auth": {
      getAuth: () => ({}), inMemoryPersistence: {}, setPersistence: async () => {},
      signOut: async () => { state.signOuts++; },
      RecaptchaVerifier: class { clear() {} },
      signInWithPhoneNumber: async () => {
        state.sends++;
        if (state.failSend) throw { code: "auth/network-request-failed" };
        const token = `proof-${state.sends}`;
        return { confirm: async () => {
          state.confirmations++;
          if (state.failCode) throw { code: "auth/invalid-verification-code" };
          return { user: { getIdToken: async () => token } };
        } };
      },
    },
  };
  const source = ts.transpileModule(readFileSync(new URL("../lib/auth/firebasePhone.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = createContext({ exports: {}, require: (name) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  }, process: { env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: "test", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.invalid",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test", NEXT_PUBLIC_FIREBASE_APP_ID: "test",
  } } });
  runInContext(source, context);
  return { state, login: new context.exports.FirebasePhoneLogin() };
}

test("initial SMS failure can be retried on the same password challenge", async () => {
  const { login, state } = setup();
  state.failSend = true;
  await assert.rejects(login.send("+919000000001", "recaptcha"), /Unable to reach Firebase/);
  await assert.rejects(login.confirm("123456"), /Request an OTP first/);
  state.failSend = false;
  await login.send("+919000000001", "recaptcha");
  assert.equal(await login.confirm("123456"), "proof-2");
});

test("failed resend preserves the previous confirmation for an already delivered OTP", async () => {
  const { login, state } = setup();
  await login.send("+919000000001", "recaptcha");
  state.failSend = true;
  await assert.rejects(login.send("+919000000001", "recaptcha"));
  assert.equal(await login.confirm("123456"), "proof-1");
});

test("backend retry reuses the proof without consuming the OTP twice", async () => {
  const { login, state } = setup();
  await login.send("+919000000001", "recaptcha");
  const token = await login.confirm("123456");
  assert.equal(await login.confirm("123456"), token);
  assert.equal(state.confirmations, 1);
  assert.ok(state.signOuts >= 2, "temporary Firebase sign-in is cleared");
});

test("successful resend replaces the old proof", async () => {
  const { login, state } = setup();
  await login.send("+919000000001", "recaptcha");
  assert.equal(await login.confirm("123456"), "proof-1");
  await login.send("+919000000001", "recaptcha");
  assert.equal(await login.confirm("654321"), "proof-2");
  assert.equal(state.confirmations, 2);
});

test("wrong OTP permits another attempt but never returns proof", async () => {
  const { login, state } = setup();
  await login.send("+919000000001", "recaptcha");
  state.failCode = true;
  await assert.rejects(login.confirm("000000"), /Incorrect OTP/);
  state.failCode = false;
  assert.equal(await login.confirm("123456"), "proof-1");
});

test("cancelled login cannot send SMS or return a cached proof", async () => {
  const { login, state } = setup();
  await login.send("+919000000001", "recaptcha");
  await login.confirm("123456");
  login.dispose();
  await assert.rejects(login.send("+919000000001", "recaptcha"), /Sign-in cancelled/);
  await assert.rejects(login.confirm("123456"));
  assert.equal(state.sends, 1);
});
