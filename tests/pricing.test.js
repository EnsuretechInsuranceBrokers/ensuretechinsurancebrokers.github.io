// The platform's own pricing tests (endorsement-service tests/test_contribution.py and test_rounding.py), replayed against assets/engine.js. Run: node tests/pricing.test.js
const assert = require("assert"); const E = require("../assets/engine.js"); const s2 = (x) => E.Dec.str(x, 2);
const base = { start: "2030-04-01", end: "2031-03-31", proRata: "NONE" };
const flat = { type: "FLAT", table: { flat: 1000 }, tax: 18 };
const FAMILY = [{ relation: "SELF", dob: "1985-01-01", sumInsured: "500000" }, { relation: "SPOUSE", dob: "1983-02-02", sumInsured: "500000" }, { relation: "SON", dob: "2015-01-01", sumInsured: "500000" }];
let n = 0; const ok = (f) => { f(); n++; };
ok(() => { const r = E.priceFamily({ op: "ADD", eff: "2030-04-01", policy: { ...base, contribution: { type: "PERCENT", groups: { SELF: "0", SPOUSE: "50", CHILD: "50" } } }, rate: flat, existing: [], rows: FAMILY });
  assert.equal(s2(r.charged), "3000.00"); assert.equal(s2(r.employee), "1000.00"); assert.equal(s2(r.employer), "2000.00"); assert.equal(s2(r.tax), "540.00"); assert.equal(s2(r.total), "3540.00"); });          // percent split of an added family
ok(() => { const r = E.priceFamily({ op: "ADD", eff: "2030-04-01", policy: { ...base, contribution: { type: "FIXED", groups: { SELF: "300", SPOUSE: "1200", CHILD: "600" } } }, rate: flat, rows: FAMILY });
  assert.equal(s2(r.employee), "1900.00"); assert.equal(s2(r.employer), "1100.00"); assert.equal(r.employee + r.employer, r.charged); });                                                          // fixed split, capped at each premium
ok(() => { const r = E.priceFamily({ op: "ADD", eff: "2030-04-01", policy: base, rate: flat, rows: FAMILY }); assert.equal(r.employee, null); assert.equal(r.employer, null); assert.equal(s2(r.charged), "3000.00"); });   // no plan, no split
ok(() => { const r = E.priceFamily({ op: "ADD", eff: "2030-04-01", policy: { ...base, contribution: { type: "FIXED", groups: { PARENT_SINGLE: "400", PARENT_DOUBLE: "700" } } }, rate: flat,
  existing: [{ relation: "SELF", dob: "1985-01-01" }, { relation: "FATHER", dob: "1955-01-01" }], rows: [{ relation: "MOTHER", dob: "1957-01-01" }] });
  assert.equal(s2(r.charged), "1000.00"); assert.equal(s2(r.employee), "1000.00"); assert.equal(s2(r.employer), "0.00"); });                                                                       // the second parent reprices the first parent's share
ok(() => { // rounding: charged is rounded, tax follows the rounded amount, the split still adds up
  const r = E.priceFamily({ op: "ADD", eff: "2030-04-01", policy: { ...base, proRata: "DAILY", rounding: "CEIL", roundingUnit: 10, contribution: { type: "PERCENT", groups: { SELF: "33.3", SPOUSE: "33.3", CHILD: "33.3" } } }, rate: flat, rows: FAMILY.slice(0, 2) });
  assert.equal(r.employee + r.employer, r.charged); assert(r.employee >= 0n && r.employee <= r.charged); assert.equal(E.Dec.str(r.charged % E.D(10), 2), "0.00"); assert.equal(r.tax, E.money(E.Dec.div(E.Dec.mul(r.charged, E.D(18)), E.D(100)))); });
ok(() => { // a REMOVE refunds the unused part of the year: spouse leaves 30 Sep 2030 (cover from policy start), DAILY
  const r = E.priceFamily({ op: "REMOVE", eff: "2030-09-30", policy: { ...base, proRata: "DAILY" }, rate: flat, existing: [{ relation: "SELF", dob: "1985-01-01" }, { relation: "SPOUSE", dob: "1983-02-02" }], rows: [{ relation: "SPOUSE" }] });
  assert(r.charged < 0n); assert.equal(s2(r.charged), "-" + s2(E.Dec.mul(E.D(1000), E.removalFactor("DAILY", "2030-04-01", "2031-03-31", "2030-09-30", "2030-04-01"))).replace("-", "")); });
ok(() => { assert.throws(() => E.priceFamily({ op: "REMOVE", eff: "2030-09-30", policy: base, rate: flat, existing: [{ relation: "SELF", dob: "1985-01-01" }], rows: [{ relation: "SPOUSE" }] }), /no longer an active member/); });
ok(() => { // raters
  const m = (ref, relation, age, extra = {}) => ({ ref, relation, age, grade: null, designation: null, sumInsured: null, ...extra });
  const fam = [m("e", "SELF", 40, { grade: "A" }), m("s", "SPOUSE", 38), m("c", "SON", 10)];
  assert.equal(s2(E.quote("AGE_BAND", E.PREMIUM_TYPES.AGE_BAND.table, 18, fam).subtotal), "2500.00");                    // 1000 + 1000 + 500
  assert.equal(s2(E.quote("FAMILY_FLOATER_AGE", E.PREMIUM_TYPES.FAMILY_FLOATER_AGE.table, 18, fam).subtotal), "3000.00"); // one premium on the eldest band
  assert.equal(s2(E.quote("GRADE", E.PREMIUM_TYPES.GRADE.table, 18, fam).subtotal), "15000.00");                          // dependants inherit the employee's grade
  assert.equal(s2(E.quote("FAMILY_FLOATER_GRADE", E.PREMIUM_TYPES.FAMILY_FLOATER_GRADE.table, 18, fam).subtotal), "9000.00");
  assert.equal(s2(E.quote("FLAT_FAMILY_DEFINITION", E.PREMIUM_TYPES.FLAT_FAMILY_DEFINITION.table, 18, fam).subtotal), "2000.00");
  assert.equal(s2(E.quote("PERMILLY", { permille: "3.5" }, 18, [m("e", "SELF", 40, { sumInsured: E.D(500000) })]).subtotal), "1750.00");
  assert.throws(() => E.quote("FLAT_EMPLOYEE_PLUS_2", { flat: 100 }, 18, [...fam, m("x", "FATHER", 70)]), /at most 2/);
  assert.throws(() => E.quote("AGE_BAND", { age_bands: [{ from: 0, to: 20, premium: 1 }, { from: 15, to: 30, premium: 2 }] }, 18, fam), /overlapping/);
  assert.throws(() => E.quote("GRADE", { grades: { A: 1 } }, 18, [m("e", "SELF", 40, { grade: "Z" })]), /no rate for grade 'Z'/); });
console.log(n + " pricing cases pass (the platform's own expectations)");
