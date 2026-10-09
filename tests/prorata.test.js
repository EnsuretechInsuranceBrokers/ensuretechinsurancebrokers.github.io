// Checks assets/engine.js against vectors produced by the real Python (endorsement-service pro_rata.py, contribution.py). Run: node tests/prorata.test.js
const assert = require("assert"); const E = require("../assets/engine.js"); const V = require("./vectors/prorata.json");
let bad = 0, n = 0; const fail = (what, got, want, args) => { if (bad++ < 8) console.log("MISMATCH", what, JSON.stringify(args), "got", got, "want", want); };
const dec6 = (s) => s;   // factors are six-place decimals
for (const [k, s, e, m, inc, want] of V.joiner) { n++; const got = E.Dec.str(E.joinerFactor(k, s, e, m, inc), 6); if (Number(got) !== Number(want)) fail("joiner", got, want, [k, s, e, m, inc]); }
for (const [k, s, e, l, cs, ild, wd, want] of V.removal) { n++; const got = E.Dec.str(E.removalFactor(k, s, e, l, cs, { includesLeavingDay: ild, whenDisabled: wd }), 6); if (Number(got) !== Number(want)) fail("removal", got, want, [k, s, e, l, cs, ild, wd]); }
for (const [a, k, u, want] of V.round) { n++; const got = E.Dec.str(E.roundAmount(E.D(a), k, u), 2); if (got !== want) fail("round", got, want, [a, k, u]); }
for (const [r, fam, g, kd] of V.group) { n++; if (E.groupOf(r, fam) !== g || E.kindOf(r) !== kd) fail("group", E.groupOf(r, fam), g, [r, fam]); }
for (const [t, groups, g, prem, want] of V.contrib) { n++; const got = E.Dec.num(new E.ContributionPlan(t, groups).employeeShare(g, E.D(prem))); if (Math.abs(got - Number(want)) > 1e-9) fail("contrib", got, want, [t, groups, g, prem]); }
assert.equal(bad, 0, bad + " mismatches"); console.log(n + " pro-rata / rounding / contribution cases match the Python exactly");
