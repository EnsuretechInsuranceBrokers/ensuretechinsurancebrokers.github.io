// Checks assets/engine.js against what the REAL policy-service (Java) answered for thousands of random cases: family validation and rate-card quotes.
// Vectors in tests/vectors/java.json were produced by running the service's own FamilyConstructService and PremiumEngine. Run: node tests/java-vectors.test.js
const assert = require("assert"); const E = require("../assets/engine.js"); const V = require("./vectors/java.json");
let bad = 0, n = 0; const fail = (...a) => { if (bad++ < 6) console.log("MISMATCH", ...a.map((x) => JSON.stringify(x))); };
for (const sc of V.family) {
  const rules = {}; for (const r of sc.rules) rules[r.relationCode] = { minAge: r.minAge, maxAge: r.maxAge, ageDifference: r.ageDifference, differenceFromRelation: r.differenceFromRelation, maxTwins: r.maxTwins };
  for (const c of sc.families) {
    n++; const got = E.checkFamily(sc.construct, rules, c.people.map((p) => ({ relation: p.relation, age: p.age, dob: p.dob }))), want = c.violations;
    const g = got.map((x) => [x.code, x.member, x.message]), w = want.map((x) => [x.code, x.member, x.message]);
    if (JSON.stringify(g) !== JSON.stringify(w)) fail({ construct: sc.construct, rules: sc.rules, people: c.people }, "got", g, "want", w);
  }
}
for (const q of V.quotes) {
  n++; const members = q.members.map((m) => ({ ref: m.ref, relation: m.relation, age: m.age, grade: m.grade, designation: null, sumInsured: m.sumInsured === null ? null : E.D(m.sumInsured) }));
  let got; try { const r = E.quote(q.type, q.table, q.tax, members); got = { subtotal: E.Dec.str(r.subtotal), tax: E.Dec.str(r.tax), total: E.Dec.str(r.total), premiums: r.members.map((m) => E.Dec.str(m.premium)) }; } catch (e) { got = { error: true }; }
  if (q.error) { if (!got.error) fail("expected an error", q.message, q); }
  else if (got.error || got.subtotal !== q.subtotal || got.tax !== q.taxAmount || got.total !== q.total || JSON.stringify(got.premiums) !== JSON.stringify(q.premiums)) fail(q.type, q.table, q.members, "got", got, "want", { s: q.subtotal, t: q.taxAmount, tot: q.total, p: q.premiums });
}
assert.equal(bad, 0, bad + " mismatches"); console.log(n + " family and rate-card cases match the real Java service exactly");
