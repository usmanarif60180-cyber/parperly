import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
if (process.env.RUN_LIVE_AUTH_TEST !== "1")
  throw Error(
    "Set RUN_LIVE_AUTH_TEST=1 to create and delete a disposable test identity.",
  );
const cfg = JSON.parse(
  await readFile("packages/config/firebase-public.json", "utf8"),
);
const email = `paperly-test-${randomUUID()}@example.invalid`,
  password = randomBytes(24).toString("base64url");
let token;
async function call(method, body) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${cfg.apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error?.message || `HTTP ${r.status}`);
  return data;
}
try {
  const created = await call("signUp", {
    email,
    password,
    returnSecureToken: true,
  });
  token = created.idToken;
  const signed = await call("signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
  if (signed.localId !== created.localId) throw Error("Identity mismatch");
  token = signed.idToken;
  console.log("PASS: real Firebase registration and password sign-in.");
} finally {
  if (token) {
    await call("delete", { idToken: token });
    console.log("PASS: disposable test identity deleted.");
  }
}
