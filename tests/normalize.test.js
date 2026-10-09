// Checks assets/engine.js against the real Python (endorsement-service normalize.py and rules.py) on thousands of deliberately messy rows. Run: node tests/normalize.test.js
const assert = require("assert"); const E = require("../assets/engine.js"); const V = require("./vectors/normalize.json");
let bad = 0, n = 0; const fail = (...a) => { if (bad++ < 5) console.log("MISMATCH", ...a.map((x) => JSON.stringify(x))); };
for (const r of V.rows) {
  n++; const [out, errs] = E.normalizeRow(r.raw, { sourceKey: r.src, defaultEffectiveDate: r.dflt, today: V.today });
  const keys = Object.keys(r.out); let same = true; for (const k of keys) if (out[k] !== r.out[k]) same = false;
  if (!same) { const diff = keys.filter((k) => out[k] !== r.out[k]).map((k) => [k, out[k], r.out[k]]); fail("normalize", r.raw, diff); continue; }
  if (JSON.stringify(errs) !== JSON.stringify(r.errors)) { fail("errors", r.raw, errs, r.errors); continue; }
  const got = E.issuesScalar({ ...out, _errors: errs }, r.op, V.today, 0).map((i) => [i.field, i.rule, i.severity, i.message, i.value]);
  if (JSON.stringify(got) !== JSON.stringify(r.issues)) fail("issues", r.op, out, got, r.issues);
}
assert.equal(bad, 0, bad + " mismatches"); console.log(n + " messy rows normalise and validate exactly as the Python does");
