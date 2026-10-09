// Column-name matching against the real Python (endorsement-service intake/schema.py). Run: node tests/mapping.test.js
const assert = require("assert"); const E = require("../assets/engine.js"); const V = require("./vectors/mapping.json");
let bad = 0, n = 0;
for (const c of V) { n++; const sug = E.suggestMapping(c.headers); const got = sug.map((s) => [s.header, s.field, s.confidence]);
  const mapped = sug.filter((s) => s.field).map((s) => s.field);
  const miss = {}, auto = {}; for (const op of ["ADD", "REMOVE", "UPDATE"]) { miss[op] = E.missingRequired(mapped, op); auto[op] = E.isAutoConfirmable(sug, op); }
  if (JSON.stringify(got) !== JSON.stringify(c.sug) || JSON.stringify(miss) !== JSON.stringify(c.missing) || JSON.stringify(auto) !== JSON.stringify(c.auto)) { if (bad++ < 4) console.log("MISMATCH", JSON.stringify(c.headers), JSON.stringify(got), JSON.stringify(c.sug)); } }
assert.equal(bad, 0); console.log(n + " column-name matchings agree with the Python exactly");
