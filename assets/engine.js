/*!
 * Ensuretech rules, in the browser.
 *
 * Every function here is a port of code that runs in the platform's services, kept deliberately close to the original so a reader can compare them
 * side by side:  pro-rata, rounding, contribution split, pricing  -> endorsement-service apps/computation/*, policy-service engine/*
 *                normalisation, row validation                    -> endorsement-service apps/intake/normalize.py, apps/validation/rules.py, batch.py
 *                family construct, relation rules                 -> policy-service FamilyConstructService
 *                dependants joining mid-term                      -> endorsement-service apps/validation/midterm.py
 *                enrollment windows                               -> policy-service EnrollmentWindowEvaluator
 *                endorsement states                               -> endorsement-service apps/jobs/states.py
 * tests/*.test.js check this file against vectors produced by the real Python and Java code, not against our own expectations.
 * Money is exact: amounts are BigInt scaled by 1e12, never floating point.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(); else root.ET = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ═══ exact decimals ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const SC = 12n, ONE = 10n ** SC;
  const Dec = {
    ZERO: 0n, ONE,
    from(x) {                                   // "12.345" | 12.345 | BigInt(scaled)
      if (typeof x === "bigint") return x;
      let s = String(x).trim();
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) throw new Error("not a number: " + x);
      if (/[eE]/.test(s)) { const n = Number(s); s = n.toFixed(12); }
      let neg = false; if (s[0] === "-") { neg = true; s = s.slice(1); } else if (s[0] === "+") s = s.slice(1);
      let [i, f = ""] = s.split("."); f = (f + "0".repeat(12)).slice(0, 12);
      const v = BigInt(i || "0") * ONE + BigInt(f); return neg ? -v : v;
    },
    mul: (a, b) => Dec.roundDiv(a * b, ONE),
    div: (a, b) => Dec.roundDiv(a * ONE, b),
    /* a / b rounded half away from zero, to an integer (this is Python's ROUND_HALF_UP) */
    roundDiv(n, d) {
      if (d < 0n) { n = -n; d = -d; }
      const neg = n < 0n; if (neg) n = -n;
      const q = (2n * n + d) / (2n * d); return neg ? -q : q;
    },
    /* quantize to `dp` decimals, half away from zero */
    q(a, dp) { const u = 10n ** (SC - BigInt(dp)); return Dec.roundDiv(a, u) * u; },
    /* quantize to `dp` decimals, half to even (Python's default context, used by Decimal.quantize) */
    qEven(a, dp) {
      const u = 10n ** (SC - BigInt(dp)); const neg = a < 0n; let x = neg ? -a : a;
      let q = x / u; const r = x % u; const twice = 2n * r;
      if (twice > u || (twice === u && q % 2n === 1n)) q += 1n;
      return (neg ? -q : q) * u;
    },
    floor(a, unit) { return (a >= 0n ? a / unit : -((-a + unit - 1n) / unit)) * unit; },
    ceil(a, unit) { return -Dec.floor(-a, unit); },
    str(a, dp = 2) {
      const r = Dec.q(a, dp), neg = r < 0n, x = neg ? -r : r;
      const i = x / ONE, f = (x % ONE).toString().padStart(12, "0").slice(0, dp);
      return (neg ? "-" : "") + i.toString() + (dp ? "." + f : "");
    },
    num: (a) => Number(a) / 1e12,
    min: (a, b) => (a < b ? a : b), max: (a, b) => (a > b ? a : b),
    abs: (a) => (a < 0n ? -a : a),
  };
  const D = (x) => Dec.from(x);
  const money = (a) => Dec.q(a, 2);

  /* ═══ dates (ISO strings, UTC, no time zones) ════════════════════════════════════════════════════════════════════════════════ */
  const MS = 86400000;
  const P = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); if (!m) throw new Error("bad date " + iso); return { y: +m[1], m: +m[2], d: +m[3] }; };
  const ord = (iso) => { const p = P(iso); return Math.round(Date.UTC(p.y, p.m - 1, p.d) / MS); };
  const iso = (o) => new Date(o * MS).toISOString().slice(0, 10);
  const daysBetween = (a, b) => ord(b) - ord(a);
  const addDays = (s, n) => iso(ord(s) + n);
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const addMonths = (s, n) => { const p = P(s); const t = p.y * 12 + p.m - 1 + n; const y = Math.floor(t / 12), m = t - y * 12 + 1; const d = Math.min(p.d, daysInMonth(y, m)); return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
  const ageOn = (dob, on) => { const a = P(dob), b = P(on); return b.y - a.y - ((b.m < a.m || (b.m === a.m && b.d < a.d)) ? 1 : 0); };
  const validIso = (s) => { try { const p = P(s); return p.m >= 1 && p.m <= 12 && p.d >= 1 && p.d <= daysInMonth(p.y, p.m); } catch (e) { return false; } };

  /* ═══ pro-rata and rounding (apps/computation/pro_rata.py) ═══════════════════════════════════════════════════════════════════ */
  const KINDS = ["DAILY", "MONTHLY", "NONE"];
  function roundAmount(d, kind, unit) {
    kind = kind || "NONE"; unit = Math.max(Math.trunc(unit || 1), 1);
    if (kind !== "FLOOR" && kind !== "CEIL" && kind !== "ROUND") return money(d);
    const u = D(unit);
    const q = Dec.div(d, u);                                  // d / unit, to a whole number by the chosen rule
    const n = kind === "FLOOR" ? Dec.floor(q, ONE) : kind === "CEIL" ? Dec.ceil(q, ONE) : Dec.q(q, 0);
    return money(Dec.mul(n, u));
  }
  function monthsFloor(a, b) {
    if (ord(b) <= ord(a)) return 0;
    const pa = P(a), pb = P(b); const m = (pb.y - pa.y) * 12 + pb.m - pa.m;
    return ord(addMonths(a, m)) <= ord(b) ? m : m - 1;
  }
  function monthsCeil(a, b) {
    if (ord(b) <= ord(a)) return 0;
    const m = monthsFloor(a, b); return m + (ord(addMonths(a, m)) < ord(b) ? 1 : 0);
  }
  /* min(max(n/d, 0), 1) to six places, half up -> scaled by 1e6 */
  function q6(n, d) { if (d <= 0) return 0n; let v = (2n * BigInt(n) * 1000000n + BigInt(d)) / (2n * BigInt(d)); if (n < 0) v = 0n; return v > 1000000n ? 1000000n : v; }
  const f6 = (v) => v * 1000000n;                              // a six-place factor, as a 1e12-scaled decimal
  function check(kind) { if (!KINDS.includes(kind)) throw new Error("unknown pro-rata type " + kind); }

  function joinerFactor(kind, start, end, memberStart, inception) {
    check(kind);
    if (inception || kind === "NONE" || ord(memberStart) <= ord(start)) return f6(1000000n);
    if (ord(memberStart) > ord(end)) return 0n;
    if (kind === "DAILY") return f6(q6(daysBetween(memberStart, end) + 1, daysBetween(start, end) + 1));
    return f6(q6(monthsCeil(memberStart, end), monthsCeil(start, end)));
  }
  function removalFactor(kind, start, end, leaving, coverStart, opts) {
    opts = opts || {}; const includesLeavingDay = opts.includesLeavingDay !== false, whenDisabled = opts.whenDisabled || "DAILY";
    check(kind);
    const cs = ord(coverStart || start) > ord(start) ? coverStart : start;
    if (kind === "NONE") {
      if (whenDisabled === "FULL") return f6(1000000n);
      if (whenDisabled === "NONE") return 0n;
      kind = "DAILY";
    }
    if (ord(leaving) > ord(end)) return 0n;
    const totalDays = daysBetween(start, end) + 1;
    if (kind === "DAILY") {
      let lastCovered = leaving;
      if (!includesLeavingDay && leaving === cs) lastCovered = addDays(cs, -1);
      const csm1 = addDays(cs, -1);
      const refundDays = daysBetween(ord(lastCovered) > ord(csm1) ? lastCovered : csm1, end);
      return f6(q6(Math.min(refundDays, daysBetween(cs, end) + 1), totalDays));
    }
    const total = monthsCeil(start, end), span = monthsCeil(cs, end);
    const covered = monthsCeil(start, leaving) - monthsFloor(start, cs);
    const refund = covered <= 0 ? span : Math.max(0, span - covered);
    return f6(q6(refund, total));
  }

  /* ═══ who pays (apps/computation/contribution.py) ════════════════════════════════════════════════════════════════════════════ */
  const PARENTS = new Set(["FATHER", "MOTHER", "STEP_FATHER", "STEP_MOTHER", "GRANDFATHER", "GRANDMOTHER"]);
  const IN_LAWS = new Set(["FATHER_IN_LAW", "MOTHER_IN_LAW"]);
  const SPOUSES = new Set(["SPOUSE", "HUSBAND", "WIFE", "DOMESTIC_PARTNER"]);
  function kindOf(rc) {
    if (rc === "SELF") return "SELF";
    if (SPOUSES.has(rc)) return "SPOUSE";
    if (rc.startsWith("SON") || rc.startsWith("DAUGHTER") || rc === "ADOPTED_CHILD" || rc === "STEP_CHILD") return "CHILD";
    if (PARENTS.has(rc)) return "PARENT";
    if (IN_LAWS.has(rc)) return "PARENT_IN_LAW";
    return "OTHERS";
  }
  function groupOf(rc, family) {
    const k = kindOf(rc);
    if (k === "PARENT" || k === "PARENT_IN_LAW") return k + "_" + (family.filter((r) => kindOf(r) === k).length > 1 ? "DOUBLE" : "SINGLE");
    return k;
  }
  class ContributionPlan {
    constructor(type, groups) {
      this.type = type === "PERCENT" || type === "FIXED" ? type : "NONE";
      this.groups = {}; for (const k of Object.keys(groups || {})) this.groups[k] = D(groups[k]);
    }
    get enabled() { return this.type !== "NONE"; }
    value(g) {
      if (g in this.groups) return this.groups[g];
      if (g.endsWith("_DOUBLE") && g.replace("_DOUBLE", "_SINGLE") in this.groups) return this.groups[g.replace("_DOUBLE", "_SINGLE")];
      return 0n;
    }
    employeeShare(g, premium) {
      if (premium <= 0n) return 0n;
      const v = this.value(g);
      if (this.type === "PERCENT") return Dec.div(Dec.mul(premium, Dec.min(Dec.max(v, 0n), D(100))), D(100));
      return Dec.min(premium, Dec.max(v, 0n));
    }
  }

  const api = { Dec, D, money, MS, P, ord, iso, daysBetween, addDays, addMonths, ageOn, validIso, daysInMonth,
    KINDS, roundAmount, monthsFloor, monthsCeil, joinerFactor, removalFactor, kindOf, groupOf, ContributionPlan, f6 };
  /*__PART2__*/
  /* ═══ premium raters (policy-service engine/*.java) ══════════════════════════════════════════════════════════════════════════ */
  /* The premium types the explorer offers. `familyUnit`: one premium for the whole family, booked on the employee's row (Rates.isFamilyUnit). */
  const PREMIUM_TYPES = {
    FLAT:                  { name: "Flat per member",                rater: "flat",   familyUnit: false, table: { flat: 1000 } },
    FAMILY_FLOATER:        { name: "Family floater (flat per family)", rater: "flat", familyUnit: true,  table: { flat: 3000 } },
    FLAT_EMPLOYEE_PLUS_2:  { name: "Employee + up to 2 dependants",  rater: "flat",   familyUnit: true,  cap: 2, table: { flat: 2500 } },
    FLAT_FAMILY_DEFINITION:{ name: "Flat by number of dependants",   rater: "flatdef", familyUnit: false, table: { family_definitions: { "0": 900, "1": 1500, "2": 2000 } } },
    AGE_BAND:              { name: "Age band per member",            rater: "age",    familyUnit: false, table: { age_bands: [{ from: 0, to: 17, premium: 500 }, { from: 18, to: 45, premium: 1000 }, { from: 46, to: 60, premium: 1500 }, { from: 61, to: 99, premium: 2500 }] } },
    FAMILY_FLOATER_AGE:    { name: "Family floater by eldest age",   rater: "age",    familyUnit: true,  table: { age_bands: [{ from: 0, to: 45, premium: 3000 }, { from: 46, to: 60, premium: 4500 }, { from: 61, to: 99, premium: 7000 }] } },
    GRADE:                 { name: "Grade based per member",         rater: "grade",  familyUnit: false, table: { grades: { A: 5000, B: 4000 } } },
    FAMILY_FLOATER_GRADE:  { name: "Family floater by employee grade", rater: "grade", familyUnit: true, table: { grades: { A: 9000, B: 7000 } } },
    PERMILLY:              { name: "Per mille of sum insured",       rater: "permille", familyUnit: false, table: { permille: "3.5" } },
  };
  class RatingError extends Error {}
  const num = (v) => { if (v === null || v === undefined || v === "" || typeof v === "object") throw new RatingError("not a number: " + v); return D(v); };
  const selfIndex = (ms) => { const i = ms.findIndex((m) => m.relation === "SELF"); return i < 0 ? 0 : i; };
  const charge = (ms, idx, p) => ms.map((_, i) => (i === idx ? p : 0n));
  const gradeOf = (m, all) => (m.grade && String(m.grade).trim() ? m.grade : all[selfIndex(all)].grade);
  const lookup = (tbl, key, what) => { if (key === null || key === undefined || !tbl || tbl[key] === undefined || tbl[key] === null) throw new RatingError("no rate for " + what + " '" + key + "'"); return num(tbl[key]); };
  const band = (bands, age, what) => { for (const b of bands) if (age >= Number(b.from) && age <= Number(b.to)) return num(b.premium); throw new RatingError("no " + what + " band for age " + age); };

  function validateTable(typeCode, table) {
    const t = PREMIUM_TYPES[typeCode], p = [];
    const reqDec = (key) => { try { const v = table[key]; if (v === undefined || v === null) p.push("'" + key + "' is required"); else if (num(v) < 0n) p.push("'" + key + "' must not be negative"); } catch (e) { p.push("'" + key + "' must be a number"); } };
    const reqMap = (key) => { const m = table[key]; if (!m || typeof m !== "object" || Array.isArray(m) || !Object.keys(m).length) { p.push("'" + key + "' must be a non-empty object"); return; }
      for (const k of Object.keys(m)) { try { if (num(m[k]) < 0n) p.push(key + "." + k + " must not be negative"); } catch (e) { p.push(key + "." + k + " must be a number"); } } };
    if (!t) return ["unknown premium type " + typeCode];
    if (t.rater === "flat") reqDec("flat"); else if (t.rater === "flatdef") reqMap("family_definitions"); else if (t.rater === "grade") reqMap("grades"); else if (t.rater === "permille") reqDec("permille");
    else if (t.rater === "age") {
      const bands = table.age_bands;
      if (!Array.isArray(bands) || !bands.length) p.push("'age_bands' must be a non-empty list of {from,to,premium}");
      else { const ranges = []; let ok = true;
        for (const b of bands) { if (!Number.isInteger(+b.from) || !Number.isInteger(+b.to) || b.premium === undefined || isNaN(Number(b.premium))) { p.push("age_bands: each band needs integer 'from','to' and numeric 'premium'"); ok = false; break; }
          if (Number(b.premium) < 0) p.push("age_bands: negative premium"); if (+b.from > +b.to) p.push("age_bands: band " + b.from + "-" + b.to + " has from > to"); ranges.push([+b.from, +b.to]); }
        if (ok) { ranges.sort((a, b) => a[0] - b[0]); for (let i = 1; i < ranges.length; i++) if (ranges[i][0] <= ranges[i - 1][1]) p.push("age_bands: overlapping age bands"); } }
    }
    return p;
  }
  /* Annual, pre-tax premium per member (2 places) and the tax on the total: PremiumEngine.quote */
  function quote(typeCode, table, taxRatePercent, members) {
    const t = PREMIUM_TYPES[typeCode];
    if (!members.length) throw new RatingError("at least one member is required");
    const problems = validateTable(typeCode, table); if (problems.length) throw new RatingError("rate card problems: " + problems.join("; "));
    let raw;
    if (t.rater === "flat") {
      const flat = num(table.flat);
      if (t.familyUnit) { if (t.cap !== undefined && members.length - 1 > t.cap) throw new RatingError(typeCode + " covers at most " + t.cap + " dependent(s), got " + (members.length - 1)); raw = charge(members, selfIndex(members), flat); }
      else raw = members.map(() => flat);
    } else if (t.rater === "flatdef") raw = charge(members, selfIndex(members), lookup(table.family_definitions, String(members.length - 1), "family definition (dependents)"));
    else if (t.rater === "age") {
      if (t.familyUnit) raw = charge(members, selfIndex(members), band(table.age_bands, Math.max(...members.map((m) => m.age)), "age"));
      else raw = members.map((m) => band(table.age_bands, m.age, "age"));
    } else if (t.rater === "grade") {
      if (t.familyUnit) { const s = selfIndex(members); raw = charge(members, s, lookup(table.grades, gradeOf(members[s], members), "grade")); }
      else raw = members.map((m) => lookup(table.grades, gradeOf(m, members), "grade"));
    } else if (t.rater === "permille") {
      const pm = num(table.permille);
      raw = members.map((m) => { if (m.sumInsured === null || m.sumInsured === undefined) throw new RatingError("sum insured required for permille rating"); return Dec.div(Dec.mul(m.sumInsured, pm), D(1000)); });
    }
    let subtotal = 0n; const byRef = {}, list = [];
    members.forEach((m, i) => { const p = money(raw[i]); subtotal += p; byRef[m.ref] = p; list.push({ ref: m.ref, premium: p }); });
    const tax = money(Dec.div(Dec.mul(subtotal, D(taxRatePercent)), D(100)));
    return { members: list, byRef, subtotal, taxRate: D(taxRatePercent), tax, total: subtotal + tax };
  }

  /* ═══ pricing one family's endorsement (apps/computation/pricing.py: price_chunk, for a single employee) ════════════════════ */
  function priceFamily(inp) {
    const pol = inp.policy, plan = new ContributionPlan(pol.contribution && pol.contribution.type, pol.contribution && pol.contribution.groups);
    const kinds = pol.relationProrata || {}, kindFor = (rc) => kinds[rc] || pol.proRata || "NONE";
    const eff = inp.eff, ref = (rc, dob) => ageOn(dob, eff);
    const mk = (r, rel, dob, grade, desig, si) => ({ ref: r, relation: rel, age: ref(rel, dob), grade: grade || null, designation: desig || null, sumInsured: si === null || si === undefined || si === "" ? null : D(si) });
    const existing = inp.existing || [], rows = inp.rows || [], coverStart = {};
    const before = existing.map((m, i) => { coverStart["m:" + i] = m.coverStart || pol.start; return mk("m:" + i, m.relation, m.dob, m.grade, m.designation, m.sumInsured); });
    let after = before.slice();
    if (inp.op === "REMOVE" || inp.op === "UPDATE") {
      const have = new Set(existing.map((m) => m.relation));
      const missing = rows.map((r) => r.relation).filter((r) => !have.has(r));
      if (missing.length) throw new RatingError("employee " + (inp.employeeCode || "") + ": " + missing.join(", ") + " is no longer an active member");
    }
    if (inp.op === "ADD") rows.forEach((r, i) => { after.push(mk("r:" + i, r.relation, r.dob, r.grade, r.designation, r.sumInsured)); coverStart["r:" + i] = eff; });
    else if (inp.op === "REMOVE") { const gone = new Set(rows.map((r) => r.relation)); after = before.filter((m, i) => !gone.has(existing[i].relation)); }
    else if (inp.op === "UPDATE") {
      const edits = {}; rows.forEach((r) => { edits[r.relation] = r; });
      after = existing.map((m, i) => { const r = edits[m.relation] || {}; return mk("m:" + i, m.relation, r.dob || m.dob, r.grade || m.grade, r.designation || m.designation, (r.sumInsured !== undefined && r.sumInsured !== null && r.sumInsured !== "") ? r.sumInsured : m.sumInsured); });
    }
    const rate = inp.rate;
    const b = before.length ? quote(rate.type, rate.table, rate.tax, before) : null;
    const a = after.length ? quote(rate.type, rate.table, rate.tax, after) : null;
    const beforeAmt = b ? b.subtotal : 0n, afterAmt = a ? a.subtotal : 0n, bBy = b ? b.byRef : {}, aBy = a ? a.byRef : {};
    const relOf = {}; before.concat(after).forEach((m) => { relOf[m.ref] = m.relation; });
    const bRels = before.map((m) => m.relation), aRels = after.map((m) => m.relation);
    const leavingDay = pol.removalIncludesLeavingDay !== false;
    let raw = 0n, rawEmp = 0n; const lines = [];
    const refs = Array.from(new Set(Object.keys(bBy).concat(Object.keys(aBy))));
    for (const r of refs) {
      const delta = (aBy[r] || 0n) - (bBy[r] || 0n);
      const eB = plan.enabled && r in bBy ? plan.employeeShare(groupOf(relOf[r], bRels), bBy[r]) : 0n;
      const eA = plan.enabled && r in aBy ? plan.employeeShare(groupOf(relOf[r], aRels), aBy[r]) : 0n;
      if (delta === 0n && eA === eB) continue;
      const kind = kindFor(relOf[r]); let f, how;
      if (inp.op === "REMOVE" && !(r in aBy)) { f = removalFactor(kind, pol.start, pol.end, eff, coverStart[r], { includesLeavingDay: leavingDay, whenDisabled: pol.removalWhenDisabled || "DAILY" }); how = "refund for the unused part of the year"; }
      else { const from = inp.op === "REMOVE" && leavingDay ? addDays(eff, 1) : eff; f = joinerFactor(kind, pol.start, pol.end, from, !!pol.inception); how = "the part of the year still to run"; }
      raw += Dec.mul(delta, f); rawEmp += Dec.mul(eA - eB, f);
      lines.push({ ref: r, relation: relOf[r], kind, delta, factor: f, amount: Dec.mul(delta, f), how });
    }
    const charged = roundAmount(raw, pol.rounding || "NONE", pol.roundingUnit || 1);
    let employee = null, employer = null;
    if (plan.enabled) {
      employee = roundAmount(rawEmp, pol.rounding || "NONE", pol.roundingUnit || 1);
      employee = charged >= 0n ? Dec.min(employee, charged) : Dec.max(employee, charged);   // rounding must not make one side pay more than the whole
      employer = charged - employee;
    }
    const totalDelta = afterAmt - beforeAmt;
    const factor = totalDelta !== 0n ? Dec.q(Dec.div(charged, totalDelta), 6) : ONE;
    const rateTax = (a || b).taxRate, tax = money(Dec.div(Dec.mul(charged, rateTax), D(100)));
    return { before: beforeAmt, after: afterAmt, factor, charged, employee, employer, taxRate: rateTax, tax, total: charged + tax, lines, beforeQuote: b, afterQuote: a, rawBeforeRounding: raw };
  }

  Object.assign(api, { PREMIUM_TYPES, RatingError, validateTable, quote, priceFamily });
  /*__PART3__*/
  /* ═══ relations and the family construct (policy-service FamilyConstructService + relation_types) ═══════════════════════════════ */
  const RELATION_TYPES = [
    [1, "SELF", "Self / Employee", "SELF", false, null], [2, "SPOUSE", "Spouse", "SPOUSE", true, null], [3, "HUSBAND", "Husband", "SPOUSE", true, null], [4, "WIFE", "Wife", "SPOUSE", true, null],
    [5, "SON", "Son", "CHILD", true, 25], [6, "SON_II", "Son (2nd)", "CHILD", true, 25], [7, "SON_III", "Son (3rd)", "CHILD", true, 25], [8, "SON_IV", "Son (4th)", "CHILD", true, 25],
    [9, "DAUGHTER", "Daughter", "CHILD", true, 25], [10, "DAUGHTER_II", "Daughter (2nd)", "CHILD", true, 25], [11, "DAUGHTER_III", "Daughter (3rd)", "CHILD", true, 25],
    [12, "FATHER", "Father", "PARENT", true, null], [13, "MOTHER", "Mother", "PARENT", true, null], [14, "FATHER_IN_LAW", "Father-in-Law", "PARENT_IN_LAW", true, null], [15, "MOTHER_IN_LAW", "Mother-in-Law", "PARENT_IN_LAW", true, null],
    [16, "BROTHER", "Brother", "SIBLING", true, null], [17, "SISTER", "Sister", "SIBLING", true, null], [18, "GRANDFATHER", "Grandfather", "PARENT", true, null], [19, "GRANDMOTHER", "Grandmother", "PARENT", true, null],
    [20, "DOMESTIC_PARTNER", "Domestic Partner", "SPOUSE", true, null], [21, "ADOPTED_CHILD", "Adopted Child", "CHILD", true, 25], [22, "STEP_CHILD", "Step Child", "CHILD", true, 25],
    [23, "STEP_FATHER", "Step Father", "PARENT", true, null], [24, "STEP_MOTHER", "Step Mother", "PARENT", true, null], [25, "DEPENDENT", "Generic Dependent", "CHILD", true, null],
  ].map(([id, code, name, group, dependent, maxAge]) => ({ id, code, name, group, dependent, maxAge }));
  const REL = {}; RELATION_TYPES.forEach((r) => { REL[r.code] = r; });
  const ADULT_GROUPS = new Set(["SELF", "SPOUSE", "PARENT", "PARENT_IN_LAW"]);

  function checkRelationRules(out, i, p, r, rule, people) {
    const min = rule && rule.minAge != null ? rule.minAge : null, max = rule && rule.maxAge != null ? rule.maxAge : null;
    if (min === null && ADULT_GROUPS.has(r.group) && p.age < 18) out.push({ code: "ADULT_UNDER_18", message: "member " + i + ": " + r.code + " must be at least 18, is " + p.age, member: i });
    if (min !== null && p.age < min) out.push({ code: "RELATION_AGE_BELOW_MIN", message: "member " + i + ": " + r.code + " age " + p.age + " is below " + min, member: i });
    if (max !== null && p.age > max) out.push({ code: "RELATION_AGE_ABOVE_MAX", message: "member " + i + ": " + r.code + " age " + p.age + " is above " + max, member: i });
    if (rule && rule.ageDifference != null) {
      const from = rule.differenceFromRelation;
      for (let j = 0; j < people.length; j++) {
        const other = REL[people[j].relation];
        if (j === i || !other || (from === "SELF" ? "SELF" : "SPOUSE") !== other.group) continue;
        if (Math.abs(people[j].age - p.age) < rule.ageDifference) {
          out.push({ code: "AGE_GAP_TOO_SMALL", message: "member " + i + ": " + r.code + " must be at least " + rule.ageDifference + " years " + (people[j].age >= p.age ? "younger than" : "older than") + " " + from + " (ages are whole years)", member: i });
          break;
        }
      }
    }
  }
  function checkTwins(out, people, rules) {
    const byDob = new Map();
    people.forEach((p, i) => { const r = REL[p.relation]; if (p.dob && String(p.dob).trim() && r && r.group === "CHILD") { if (!byDob.has(p.dob)) byDob.set(p.dob, []); byDob.get(p.dob).push(i); } });
    byDob.forEach((idx, dob) => {
      if (idx.length < 2) return;
      const limits = idx.map((i) => rules[people[i].relation]).filter(Boolean).map((r) => Math.max(1, r.maxTwins || 0));
      if (!limits.length) return;
      const limit = Math.min(...limits);
      if (idx.length > limit) out.push({ code: "TWINS_EXCEEDED", message: idx.length + " children share the birth date " + dob + " but the policy allows " + limit + " (relation rules: max_twins)", member: idx[limit] });
    });
  }
  /* construct: {allowedRelations:[ids], maxMembers, maxChildren, maxParents, ageMin, ageMax}; rules: {RELATION_CODE: {minAge,maxAge,ageDifference,differenceFromRelation,maxTwins}}; people: [{relation, age, dob}] */
  function checkFamily(construct, rules, people) {
    const out = []; const allowed = new Set(construct.allowedRelations || []);
    let children = 0, parents = 0, selves = 0;
    people.forEach((p, i) => {
      const r = REL[p.relation];
      if (!r) { out.push({ code: "UNKNOWN_RELATION", message: "member " + i + ": unknown relation '" + p.relation + "'", member: i }); return; }
      if (r.code === "SELF") selves++;
      else if (!allowed.has(r.id)) out.push({ code: "RELATION_NOT_ALLOWED", message: "member " + i + ": " + r.code + " not covered", member: i });
      if (r.group === "CHILD") children++;
      if (r.group === "PARENT" || r.group === "PARENT_IN_LAW") parents++;
      if (r.maxAge != null && p.age > r.maxAge) out.push({ code: "DEPENDENT_OVER_MAX_AGE", message: "member " + i + ": " + r.code + " age " + p.age + " exceeds " + r.maxAge, member: i });
      checkRelationRules(out, i, p, r, rules[r.code], people);
      const lo = construct.ageMin, hi = construct.ageMax;
      if ((lo != null && p.age < lo) || (hi != null && p.age > hi)) out.push({ code: "AGE_OUT_OF_RANGE", message: "member " + i + ": age " + p.age + " outside " + (lo == null ? "null" : lo) + "-" + (hi == null ? "null" : hi), member: i });
    });
    if (selves !== 1) out.push({ code: "SELF_COUNT", message: "exactly one SELF member is required, got " + selves, member: -1 });
    if (people.length > construct.maxMembers) out.push({ code: "MAX_MEMBERS_EXCEEDED", message: people.length + " members, max " + construct.maxMembers, member: -1 });
    checkTwins(out, people, rules);
    if (construct.maxChildren != null && children > construct.maxChildren) out.push({ code: "MAX_CHILDREN_EXCEEDED", message: children + " children, max " + construct.maxChildren, member: -1 });
    if (construct.maxParents != null && parents > construct.maxParents) out.push({ code: "MAX_PARENTS_EXCEEDED", message: parents + " parents/in-laws, max " + construct.maxParents, member: -1 });
    return out;
  }

  Object.assign(api, { RELATION_TYPES, REL, checkFamily });
  /*__PART4__*/
  /* ═══ turning messy cells into canonical ones (apps/intake/normalize.py) ══════════════════════════════════════════════════════ */
  const NORM = {
    relationCodes: ["SELF","SPOUSE","HUSBAND","WIFE","SON","SON_II","SON_III","SON_IV","DAUGHTER","DAUGHTER_II","DAUGHTER_III","FATHER","MOTHER","FATHER_IN_LAW","MOTHER_IN_LAW","BROTHER","SISTER","GRANDFATHER","GRANDMOTHER","DOMESTIC_PARTNER","ADOPTED_CHILD","STEP_CHILD","STEP_FATHER","STEP_MOTHER","DEPENDENT"],
    synonyms: { SELF:"SELF",EMPLOYEE:"SELF",EMP:"SELF",PRINCIPAL:"SELF",MEMBER:"SELF",PRIMARY:"SELF",SPOUSE:"SPOUSE",PARTNER:"SPOUSE",HUSBAND:"HUSBAND",WIFE:"WIFE",SON:"SON",DAUGHTER:"DAUGHTER",FATHER:"FATHER",MOTHER:"MOTHER",DAD:"FATHER",MOM:"MOTHER",FATHER_IN_LAW:"FATHER_IN_LAW",MOTHER_IN_LAW:"MOTHER_IN_LAW",F_IN_LAW:"FATHER_IN_LAW",M_IN_LAW:"MOTHER_IN_LAW",FIL:"FATHER_IN_LAW",MIL:"MOTHER_IN_LAW",BROTHER:"BROTHER",SISTER:"SISTER",GRAND_FATHER:"GRANDFATHER",GRANDFATHER:"GRANDFATHER",GRAND_MOTHER:"GRANDMOTHER",GRANDMOTHER:"GRANDMOTHER",DOMESTIC_PARTNER:"DOMESTIC_PARTNER",ADOPTED:"ADOPTED_CHILD",ADOPTED_CHILD:"ADOPTED_CHILD",STEP_CHILD:"STEP_CHILD",STEP_FATHER:"STEP_FATHER",STEP_MOTHER:"STEP_MOTHER",DEPENDENT:"DEPENDENT",DEPENDANT:"DEPENDENT",CHILD:"DEPENDENT" },
    bySource: {
      CARE: { SELF:"SELF",SPOUSE:"SPOUSE",SON:"SON",DAUGHTER:"DAUGHTER",FATHER:"FATHER",MOTHER:"MOTHER",FATHER_IN_LAW:"FATHER_IN_LAW",MOTHER_IN_LAW:"MOTHER_IN_LAW",BROTHER:"BROTHER",SISTER:"SISTER",GRANDFATHER:"GRANDFATHER",GRANDMOTHER:"GRANDMOTHER",DOMESTIC_PARTNER:"DOMESTIC_PARTNER",ADOPTED:"ADOPTED_CHILD",STEP_CHILD:"STEP_CHILD",STEP_FATHER:"STEP_FATHER",STEP_MOTHER:"STEP_MOTHER",DEPENDENT:"DEPENDENT" },
      MEDIASSIST: { SELF:"SELF",SPOUSE:"SPOUSE",SON:"SON",DAUGHTER:"DAUGHTER",FATHER:"FATHER",MOTHER:"MOTHER",FATHER_IN_LAW:"FATHER_IN_LAW",MOTHER_IN_LAW:"MOTHER_IN_LAW",BROTHER:"BROTHER",SISTER:"SISTER",GRAND_FATHER:"GRANDFATHER",GRAND_MOTHER:"GRANDMOTHER",DOMESTIC_PARTNER:"DOMESTIC_PARTNER",ADOPTED_CHILD:"ADOPTED_CHILD",STEP_CHILD:"STEP_CHILD",STEP_FATHER:"STEP_FATHER",STEP_MOTHER:"STEP_MOTHER",DEPENDENT:"DEPENDENT" },
      FHPL: { EMP:"SELF",SP:"SPOUSE",S:"SON",D:"DAUGHTER",F:"FATHER",M:"MOTHER",FIL:"FATHER_IN_LAW",MIL:"MOTHER_IN_LAW",BR:"BROTHER",SI:"SISTER",GF:"GRANDFATHER",GM:"GRANDMOTHER",DP:"DOMESTIC_PARTNER",AC:"ADOPTED_CHILD",SC:"STEP_CHILD",SF:"STEP_FATHER",SM:"STEP_MOTHER",DEP:"DEPENDENT" } },
    suffixes: { I:1,"1":1,II:2,"2":2,III:3,"3":3,IV:4,"4":4 },
    dateFormats: ["%Y-%m-%d","%d/%m/%Y","%d-%m-%Y","%d.%m.%Y","%d-%b-%Y","%d %b %Y","%d-%B-%Y","%d/%m/%y","%d-%m-%y"],
    gender: { M:"M",MALE:"M",F:"F",FEMALE:"F",O:"O",OTHER:"O",TRANSGENDER:"O",T:"O" },
    amountPrefixes: ["INR", "RS.", "RS", "₹"],
  };
  const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
  const nkey = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  function normalizeRelation(raw, source) {
    const text = clean(raw); if (!text) return [null, null];
    const k = nkey(text);
    if (NORM.relationCodes.includes(k)) return [k, null];
    const per = NORM.bySource[(source || "").toUpperCase()] || {};
    if (Object.prototype.hasOwnProperty.call(per, k)) return [per[k], null];
    const m = /^(SON|DAUGHTER)_?(I{1,3}|IV|[1-4])$/.exec(k);
    if (m) { const n = NORM.suffixes[m[2]]; return [n === 1 ? m[1] : m[1] + "_" + ["", "I", "II", "III", "IV"][n], null]; }
    if (Object.prototype.hasOwnProperty.call(NORM.synonyms, k)) return [NORM.synonyms[k], null];
    return [null, "unrecognised relation '" + text + "'"];
  }
  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  /* Python's datetime.strptime, for the handful of directives the rules file uses. Must consume the whole string. */
  function strptime(text, fmt) {
    let rx = "", order = [];
    for (let i = 0; i < fmt.length; i++) {
      const c = fmt[i];
      if (c === "%") { const d = fmt[++i];
        if (d === "Y") { rx += "(\\d\\d\\d\\d)"; order.push("Y"); } else if (d === "y") { rx += "(\\d\\d)"; order.push("y"); }
        else if (d === "m") { rx += "(1[0-2]|0[1-9]|[1-9])"; order.push("m"); } else if (d === "d") { rx += "(3[01]|[12]\\d|0[1-9]|[1-9]| [1-9])"; order.push("d"); }
        else if (d === "b") { rx += "(" + MONTHS.map((m) => m.slice(0, 3)).join("|") + ")"; order.push("b"); } else if (d === "B") { rx += "(" + MONTHS.join("|") + ")"; order.push("B"); }
        else throw new Error("unsupported directive %" + d);
      } else if (/\s/.test(c)) rx += "\\s+"; else rx += c.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
    }
    const m = new RegExp("^" + rx, "i").exec(text); if (!m || m[0].length !== text.length) return null;
    let y = null, mo = null, d = null;
    order.forEach((k, i) => { const v = m[i + 1]; if (k === "Y") y = +v; else if (k === "y") y = +v <= 68 ? 2000 + +v : 1900 + +v; else if (k === "m") mo = +v; else if (k === "d") d = +v;
      else if (k === "b") mo = MONTHS.findIndex((x) => x.slice(0, 3) === v.toLowerCase()) + 1; else if (k === "B") mo = MONTHS.indexOf(v.toLowerCase()) + 1; });
    if (y === null || y < 1 || mo === null || d === null || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    return { y, m: mo, d };
  }
  const p2 = (n) => String(n).padStart(2, "0"), isoYMD = (y, m, d) => String(y).padStart(4, "0") + "-" + p2(m) + "-" + p2(d);
  function normalizeDate(raw, dobFormat, today) {
    const text = clean(raw); if (!text) return [null, null];
    today = today || new Date().toISOString().slice(0, 10);
    if (/^\d{5}(\.0+)?$/.test(text)) { const serial = parseInt(text, 10); if (serial >= 1 && serial <= 80000) return [addDays("1899-12-30", serial), null]; }
    const formats = (dobFormat ? [dobFormat] : []).concat(NORM.dateFormats);
    for (const fmt of formats) {
      const d = strptime(text, fmt); if (!d) continue;
      if (fmt.includes("%y") && d.y > P(today).y) d.y -= 100;
      return [isoYMD(d.y, d.m, d.d), null];
    }
    return [null, "unreadable date '" + text + "'"];
  }
  const normalizeEmployeeCode = (raw) => { let t = clean(raw).replace(/^'+/, ""); if (/^\d+\.0+$/.test(t)) t = t.split(".")[0]; t = t.replace(/\s+/g, ""); return t || null; };
  const normalizeGender = (raw) => { const t = clean(raw); if (!t) return [null, null]; const g = NORM.gender[nkey(t)]; return g ? [g, null] : [null, "unrecognised gender '" + t + "'"]; };
  function normalizeAmount(raw) {
    const text = clean(raw); if (!text) return [null, null];
    let t = text; for (const p of NORM.amountPrefixes) if (t.toUpperCase().startsWith(p.toUpperCase())) t = t.slice(p.length);
    t = t.replace(/,/g, "").trim();
    if (/^[+-]?(inf(inity)?|nan|snan)$/i.test(t)) return [null, "not a usable amount '" + text + "'"];
    const m = /^([+-]?)(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d+))?$/.exec(t); if (!m) return [null, "not a number '" + text + "'"];
    const neg = m[1] === "-"; let [ip, fp = ""] = m[2].split("."); let exp = m[3] ? parseInt(m[3], 10) : 0;
    if (Math.abs(exp) > 40) return [null, "not a usable amount '" + text + "'"];
    let digits = (ip + fp), scale = fp.length - exp;                      // value = digits / 10^scale
    let v = BigInt(digits || "0");
    // to 12 places
    const shift = 12 - scale; v = shift >= 0 ? v * 10n ** BigInt(shift) : Dec.roundDiv(v, 10n ** BigInt(-shift));
    if (v >= 10n ** 12n * ONE) return [null, "not a usable amount '" + text + "'"];
    const r = Dec.qEven(v, 2);
    return [(neg ? "-" : "") + Dec.str(r, 2), null];
  }
  const normalizePan = (raw) => clean(raw).replace(/\s+/g, "").toUpperCase() || null;
  const normalizeMobile = (raw) => { let d = clean(raw).replace(/\D/g, ""); if (d.length === 12 && d.startsWith("91")) d = d.slice(2); else if (d.length === 11 && d.startsWith("0")) d = d.slice(1); return d || null; };
  const normalizeEmail = (raw) => clean(raw).toLowerCase() || null;
  function splitFullName(raw) { const parts = clean(raw).split(/\s+/).filter(Boolean); if (!parts.length) return [null, null]; return [parts.slice(0, -1).join(" ") || parts[0], parts.length > 1 ? parts[parts.length - 1] : null]; }
  const AMOUNT_FIELDS = ["sum_insured","annual_salary","salary_variables","number_of_time_salary","no_of_time_suminsured","employee_premium","employer_premium","opd_sum_insured","opd_employee_premium","opd_employer_premium","ctc"];
  const TEXT_FIELDS = ["state","city","pincode","location","zone","flex_plan","self_si_selection","cover_type","member_existing_claim","endorsement_number","type_of_correction"];
  function normalizeRow(raw, o) {
    o = o || {}; const options = o.options || {}, errors = [];
    const keep = (field, value, err) => { if (err) errors.push({ field, rule: "INVALID_" + field.toUpperCase(), message: err, value: clean(raw[field]) }); return value; };
    const out = { employee_code: normalizeEmployeeCode(raw.employee_code) };
    let [rel, err] = normalizeRelation(raw.relation, o.sourceKey || ""); out.relation_code = keep("relation", rel, err);
    let first = clean(raw.first_name) || null, last = clean(raw.last_name) || null;
    if (!first && raw.full_name) [first, last] = splitFullName(raw.full_name);
    out.first_name = first; out.last_name = last;
    let v; [v, err] = normalizeDate(raw.dob, options.dob_format, o.today); out.dob = keep("dob", v, err);
    [v, err] = normalizeDate(raw.date_of_marriage, options.dob_format, o.today); out.date_of_marriage = keep("date_of_marriage", v, err);
    [v, err] = normalizeDate(raw.effective_date, options.date_format, o.today); out.effective_date = keep("effective_date", v, err) || o.defaultEffectiveDate || null;
    [v, err] = normalizeGender(raw.gender); out.gender = keep("gender", v, err);
    for (const f of AMOUNT_FIELDS) { [v, err] = normalizeAmount(raw[f]); out[f] = keep(f, v, err); }
    for (const f of TEXT_FIELDS) out[f] = clean(raw[f]) || null;
    out.pan = normalizePan(raw.pan); out.mobile = normalizeMobile(raw.mobile); out.email = normalizeEmail(raw.email);
    out.grade = clean(raw.grade) || null; out.designation = clean(raw.designation) || null;
    return [out, errors];
  }

  /* ═══ row rules (apps/validation/rules.py: issues_scalar) ═════════════════════════════════════════════════════════════════════ */
  const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/, EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, MOBILE_RE = /^[6-9][0-9]{9}$/, MAX_AGE = 100;
  const REQUIRED = { ADD: ["employee_code","relation_code","first_name","dob","sum_insured","effective_date"], REMOVE: ["employee_code","relation_code","effective_date"], UPDATE: ["employee_code","relation_code"] };
  const UPDATABLE = ["first_name","last_name","dob","gender","pan","mobile","email","grade","designation","annual_salary","sum_insured"];
  const PARSE_FIELD = { relation: "relation_code", dob: "dob", effective_date: "effective_date", gender: "gender", sum_insured: "sum_insured", annual_salary: "annual_salary", employee_code: "employee_code", number_of_time_salary: "number_of_time_salary", employee_premium: "employee_premium", employer_premium: "employer_premium" };
  const blank = (v) => v === null || v === undefined || (typeof v === "number" && v !== v) || String(v).trim() === "";
  function issuesScalar(row, op, today, rowIndex) {
    rowIndex = rowIndex || 0; const out = [], bad = new Set();
    for (const e of row._errors || []) { out.push({ row: rowIndex, field: e.field, rule: e.rule, severity: "ERROR", message: e.message, value: String(e.value === undefined ? "" : e.value) }); bad.add(PARSE_FIELD[e.field] || e.field); }
    const add = (field, rule, msg, sev) => out.push({ row: rowIndex, field, rule, severity: sev || "ERROR", message: msg, value: blank(row[field]) ? "" : String(row[field]) });
    const derived = !blank(row.annual_salary) && !blank(row.number_of_time_salary) && !bad.has("annual_salary") && !bad.has("number_of_time_salary");
    for (const f of REQUIRED[op]) { if (f === "sum_insured" && derived) continue; if (blank(row[f]) && !bad.has(f)) add(f, "REQUIRED_FIELD", f + " is required for " + op); }
    if (op === "UPDATE" && UPDATABLE.every((f) => blank(row[f])) && !UPDATABLE.some((f) => bad.has(f))) add("", "NOTHING_TO_UPDATE", "UPDATE row changes nothing");
    const dob = !blank(row.dob) && !bad.has("dob") ? row.dob : null, eff = !blank(row.effective_date) && !bad.has("effective_date") ? row.effective_date : null;
    if (dob) {
      if (ord(dob) > ord(today)) add("dob", "DOB_IN_FUTURE", "date of birth is in the future");
      else if (eff && ord(dob) > ord(eff)) add("dob", "DOB_AFTER_EFFECTIVE_DATE", "date of birth is after the effective date");
      else if (ageOn(dob, eff || today) > MAX_AGE) add("dob", "AGE_OUT_OF_RANGE", "age exceeds " + MAX_AGE);
    }
    if (!blank(row.pan) && !PAN_RE.test(String(row.pan))) add("pan", "INVALID_PAN", "PAN must look like ABCDE1234F");
    if (!blank(row.email) && !EMAIL_RE.test(String(row.email))) add("email", "INVALID_EMAIL", "email address looks invalid", "WARN");
    if (!blank(row.mobile) && !MOBILE_RE.test(String(row.mobile))) add("mobile", "INVALID_MOBILE", "mobile must be 10 digits starting 6-9", "WARN");
    if (op === "ADD" && !blank(row.sum_insured) && !bad.has("sum_insured") && parseFloat(row.sum_insured) <= 0) add("sum_insured", "SUM_INSURED_NOT_POSITIVE", "sum insured must be greater than zero");
    if (!blank(row.annual_salary) && !bad.has("annual_salary") && parseFloat(row.annual_salary) < 0) add("annual_salary", "SALARY_NEGATIVE", "annual salary cannot be negative");
    if (!blank(row.number_of_time_salary) && !bad.has("number_of_time_salary") && parseFloat(row.number_of_time_salary) <= 0) add("number_of_time_salary", "MULTIPLE_NOT_POSITIVE", "number of times salary must be greater than zero");
    for (const f of ["employee_premium", "employer_premium"]) if (!blank(row[f]) && !bad.has(f) && parseFloat(row[f]) < 0) add(f, "PREMIUM_NEGATIVE", f.replace("_", " ") + " cannot be negative");
    return out;
  }

  /* ═══ dependants joining mid-term (apps/validation/midterm.py) ═════════════════════════════════════════════════════════════════ */
  const midGroup = (rc) => { rc = rc || ""; if (["SPOUSE", "HUSBAND", "WIFE"].includes(rc)) return "SPOUSE"; if (rc === "DOMESTIC_PARTNER") return "PARTNER"; if (rc.startsWith("SON") || rc.startsWith("DAUGHTER")) return "KIDS"; return null; };
  /* One dependant of an employee who is already covered. rule: {allowed, windowDays, startBasis}. Returns {issues, coverStart}. */
  function dependantMidterm(a) {
    const g = midGroup(a.relation), rule = a.rule, out = { issues: [], coverStart: null, group: g };
    if (!g || !rule) return out;
    if (rule.allowed === false) { out.issues.push({ rule: "MIDTERM_DEPENDANT_NOT_ALLOWED", severity: "ERROR", message: "this policy does not allow a " + g.toLowerCase() + " to be added after the employee is covered" }); return out; }
    const eventField = g === "KIDS" ? "dob" : "date_of_marriage", word = g === "KIDS" ? "birth" : "marriage", event = a.eventDate || null;
    let start;
    if (rule.startBasis === "EVENT") {
      if (!event) { out.issues.push({ rule: "MIDTERM_EVENT_DATE_REQUIRED", severity: "ERROR", message: "cover starts from the " + (g === "KIDS" ? "date of birth" : "date of marriage") + ", which is missing" }); return out; }
      if (ord(event) > ord(a.today)) { out.issues.push({ rule: "MIDTERM_EVENT_IN_FUTURE", severity: "ERROR", message: "the date of " + word + " is in the future" }); return out; }
      start = ord(event) > ord(a.policyStart) ? event : a.policyStart;
    } else start = ord(a.uploadDay) > ord(a.policyStart) ? a.uploadDay : a.policyStart;
    if (rule.windowDays != null && event && daysBetween(event, a.today) > rule.windowDays)
      out.issues.push({ rule: "MIDTERM_APPROVAL_REQUIRED", severity: "WARN", message: "added more than " + rule.windowDays + " days after the " + word + ": HR approval is required for mid-term cover" });
    out.coverStart = start; out.eventField = eventField; return out;
  }

  /* ═══ whole-file rules that look across rows (apps/validation/batch.py), without the parts that need the live roster service ═════ */
  function validateFile(rows, o) {
    const op = o.op, today = o.today, issues = [];
    const norm = rows.map((raw, i) => { const [r, errs] = normalizeRow(raw, { sourceKey: o.sourceKey, today, defaultEffectiveDate: o.defaultEffectiveDate }); r._errors = errs; return r; });
    norm.forEach((r, i) => { for (const x of issuesScalar(r, op, today, i)) issues.push(x); });
    const key = norm.map((r) => (r.employee_code && r.relation_code ? r.employee_code + "|" + r.relation_code : null));
    const add = (i, field, rule, message, severity, value) => issues.push({ row: i, field, rule, severity: severity || "ERROR", message, value: value === undefined || value === null ? "" : String(value) });
    const seen = new Set(); key.forEach((k, i) => { if (k === null) return; if (seen.has(k)) add(i, "employee_code", "DUPLICATE_ROW_IN_FILE", "same employee and relation appears more than once", "ERROR", k); else seen.add(k); });
    if (op === "ADD" && o.midtermBasis === "NO_MIDTERM" && !o.inception && o.policyStart)
      norm.forEach((r, i) => { if (r.effective_date && r.effective_date > o.policyStart) add(i, "effective_date", "MIDTERM_NOT_ALLOWED", "this policy does not accept mid-term joiners (it started on " + o.policyStart + ")", "ERROR", r.effective_date); });
    const firstKeyOfPan = {}; norm.forEach((r, i) => { if (r.pan && key[i] !== null && !(r.pan in firstKeyOfPan)) firstKeyOfPan[r.pan] = key[i]; });
    norm.forEach((r, i) => { if (r.pan && key[i] !== null && firstKeyOfPan[r.pan] !== key[i]) add(i, "pan", "DUPLICATE_PAN_IN_FILE", "this PAN is used by another person in the file", "ERROR", r.pan); });
    const roster = o.roster || [], have = new Set(roster.map((m) => m.employee_code + "|" + m.relation_code));
    key.forEach((k, i) => { if (k === null) return; const exists = have.has(k);
      if (op === "ADD" && exists) add(i, "employee_code", "MEMBER_ALREADY_EXISTS", "member is already covered under this policy", "ERROR", norm[i].employee_code);
      else if ((op === "REMOVE" || op === "UPDATE") && !exists) add(i, "employee_code", "MEMBER_NOT_FOUND", "no active member with this employee code and relation", "ERROR", norm[i].employee_code); });
    if (op === "REMOVE") { const removing = new Set(key.filter(Boolean));
      norm.forEach((r, i) => { if (key[i] !== null && r.relation_code === "SELF") { const left = roster.filter((m) => m.employee_code === r.employee_code && m.relation_code !== "SELF" && !removing.has(r.employee_code + "|" + m.relation_code));
        if (left.length) add(i, "relation_code", "DEPENDENTS_REMAIN_ACTIVE", left.length + " dependent(s) stay covered after the employee is removed", "WARN", r.employee_code); } }); }
    if (op === "ADD" && o.construct) {                                        // family constraints, for each employee whose own rows are otherwise clean
      const bad = new Set(issues.filter((x) => x.severity === "ERROR").map((x) => x.row)), order = new Map();
      key.forEach((k, i) => { if (k !== null) { if (!order.has(norm[i].employee_code)) order.set(norm[i].employee_code, []); order.get(norm[i].employee_code).push(i); } });
      for (const [code, idxs] of order) {
        if (idxs.some((i) => bad.has(i)) || !norm[idxs[0]].effective_date) continue;
        const ref = norm[idxs[0]].effective_date, people = [], owners = [];
        for (const m of roster.filter((m) => m.employee_code === code)) { people.push({ relation: m.relation_code, age: ageOn(m.dob, ref), dob: m.dob }); owners.push(null); }
        for (const i of idxs) { people.push({ relation: norm[i].relation_code, age: ageOn(norm[i].dob, norm[i].effective_date), dob: norm[i].dob }); owners.push(i); }
        for (const v of checkFamily(o.construct, o.rules || {}, people)) { const idx = v.member >= 0 && v.member < owners.length ? owners[v.member] : null; add(idx !== null ? idx : idxs[0], "", v.code, v.message); }
      }
    }
    return { rows: norm, issues };
  }

  Object.assign(api, { NORM, normalizeRelation, normalizeDate, normalizeAmount, normalizeGender, normalizeEmployeeCode, normalizePan, normalizeMobile, normalizeEmail, splitFullName, normalizeRow, issuesScalar, dependantMidterm, midGroup, validateFile, strptime });
  /*__PART5__*/
  /* ═══ enrollment windows (policy-service EnrollmentWindowEvaluator; the numbers in the trace are the legacy rule codes) ══════════ */
function addDaysIso(iso, n) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function evaluateWindow(s, policyStart, policyEnd, basis, today, e) {
  const w = { status: "CLOSED", start: null, end: null, confirmed: false, window: true, midterm: true, endterm: false, custom: false, closeDate: e.custom ? e.custom.closeDate || null : null };
  const trace = [];
  const t = (code, msg) => trace.push([code, msg]);
  const within = (d, a, b) => a && b && d >= a && d <= b;
  const c = e.confirmation;
  const o = e.custom;

  function midterm() {
    const from = basis === "DATE_OF_JOINING" ? e.doj : basis === "DATE_OF_UPLOAD" ? e.dou : null;
    if (!from) return;
    const until = addDaysIso(from, s.midtermDays - 1);
    w.start = from; w.end = until;
    if (w.closeDate && today > w.closeDate) { w.status = "CLOSED"; t(731, "the employee's hard close date has passed"); }
    else if (basis === "DATE_OF_JOINING") {
      w.status = until >= today && from <= today ? "OPEN" : "CLOSED";
      t(w.status === "OPEN" ? 721 : 731, "mid-term window from date of joining: " + from + " for " + s.midtermDays + " days");
    } else {
      w.status = until >= today ? "OPEN" : "CLOSED";
      t(w.status === "OPEN" ? 761 : 771, "mid-term window from date of upload: " + from + " for " + s.midtermDays + " days");
    }
  }

  function policyLevel() {
    w.status = "CLOSED"; w.window = true; w.midterm = true;
    let need = false;
    const hasWindow = s.enabled && s.start && s.end;
    if (hasWindow) {
      const inside = within(today, s.start, s.end);
      if (w.closeDate && today > w.closeDate) { w.status = "CLOSED"; w.start = s.start; w.end = s.end; t(501, "the employee's hard close date has passed"); }
      else if (today < policyStart || inside) {
        w.status = "OPEN"; w.start = s.start; w.end = s.end; t(511, "inside the policy's enrollment window");
        if (today < policyStart && !inside) { w.status = "CLOSED"; t(521, "before the policy starts and before its window opens (pre-enrollment)"); }
      } else {
        w.status = "CLOSED"; w.start = s.start; w.end = s.end; t(531, "the policy's window has closed");
        if (basis === "DATE_OF_JOINING" && e.doj) { if (e.doj > policyStart && e.doj > s.end) { need = true; t(541, "joined after the window: mid-term applies (date of joining)"); } }
        else if (basis === "DATE_OF_UPLOAD" && e.dou) { if (e.dou > policyStart && e.dou > s.end) { need = true; t(551, "uploaded after the window: mid-term applies (date of upload)"); } }
      }
    } else { w.window = false; t(599, "the policy has no enrollment window"); }
    if (basis === "NO_MIDTERM") { w.midterm = false; need = false; t(599, "mid-term joining is switched off for this policy"); }
    if (!hasWindow) {
      if (basis === "DATE_OF_JOINING" && !e.inception && e.doj) { need = true; t(601, "no window: mid-term from date of joining is the only way in"); }
      else if (basis === "DATE_OF_UPLOAD" && !e.inception) { need = true; t(611, "no window: mid-term from date of upload is the only way in"); }
      if (e.inception) { w.midterm = false; t(621, "inception members never get a mid-term window"); }
    }
    if (e.doj && e.doj < policyStart) { need = false; w.midterm = false; t(651, "joined before the policy began: no mid-term window"); }
    if (need) midterm();
  }

  if (c && !e.hasMembers) { w.status = "CONFIRMED_BUT_NOT_OPTED"; t(100, "confirmed, but never opted in to any cover"); return { w, trace }; }
  if (c) { w.status = "CONFIRMED"; w.confirmed = true; w.start = c.start; w.end = c.end; t(302, "confirmed: the dates are frozen as they were on the day of confirmation"); }
  else policyLevel();

  if (o && o.enabled) {
    w.custom = true;
    const policyWide = w.end || "1900-01-01";
    if (o.end && o.end >= policyWide) {
      if (c) { w.status = "CONFIRMED"; w.start = c.start; w.end = c.end; t(323, "confirmed: a custom window changes nothing"); }
      else {
        w.start = o.start; w.end = o.end;
        if (o.closeDate && today > o.closeDate) { w.status = "CLOSED"; t(322, "custom window: its hard close date has passed"); }
        else if (today >= o.start && today <= o.end) { w.status = "OPEN"; t(331, "inside this employee's custom window"); }
        else { w.status = "CLOSED"; t(332, "outside this employee's custom window"); }
      }
    } else t(321, "custom window ends before the policy window, so it is ignored: a custom window can extend, never shorten");
  }

  if (w.end && w.end > policyEnd) {
    if (w.midterm && !w.custom && !s.allowAfterExpiry) {
      if (w.status === "OPEN") { if (today > policyEnd) { w.status = "CLOSED"; t(419, "the window runs past the policy end and the policy has ended"); } else { w.endterm = true; t(419, "the window runs past the policy end"); } }
    } else if (w.midterm && s.allowAfterExpiry && w.status !== "CONFIRMED") {
      const upload = e.dou || policyEnd, base = upload > policyEnd ? upload : policyEnd, validity = addDaysIso(base, s.daysAfterExpiry);
      if (w.end > validity) { w.status = today <= validity ? "OPEN" : "CLOSED"; w.end = validity; }
      else w.status = today <= w.end ? "OPEN" : "CLOSED";
      t(431, "joining is allowed for " + s.daysAfterExpiry + " days after the policy expires (until " + w.end + ")");
    } else { w.end = policyEnd; if (w.status === "OPEN" && today > policyEnd) w.status = "CLOSED"; t(421, "the window is cut at the policy's end date"); }
  }
  return { w, trace };
}
  Object.assign(api, { evaluateWindow });
  /*__PART6__*/
  /* ═══ matching a file's column names to our fields (apps/intake/schema.py: suggest_mapping) ═════════════════════════════════════ */
  const SCHEMA = () => (typeof module === "object" && module.exports ? require("./data.js") : self.ETDATA).schema;
  const normHeader = (h) => String(h).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  function levenshtein(a, b) {
    if (a === b) return 0; let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0))); prev = cur; }
    return prev[prev.length - 1];
  }
  /* Python's round(x, 3): an exact half goes to the even neighbour (0.5625 -> 0.562), anything else to the nearest */
  const pyRound3 = (x) => { const y = x * 1000, f = Math.floor(y); return (y - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(y)) / 1000; };
  const similarity = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
  function suggestMapping(headers) {
    const S = SCHEMA(), generic = new Set(S.genericPrefix);
    const core = (h) => h.split(" ").filter((t) => t && !generic.has(t)).join(" ");
    const score = (h, n) => { if (h === n) return 1; const ch = core(h); if (ch !== h) { const cn = core(n); return ch && cn ? Math.min(similarity(ch, cn), 0.85) : 0; } return similarity(h, n); };
    const best = (header) => { const h = normHeader(header); let bf = null, b = 0;
      for (const field of Object.keys(S.synonyms)) for (const n of S.synonyms[field]) { let s = score(h, n); if (h.length <= 3 && h !== n) s = Math.min(s, 0.5); if (s > b) { bf = field; b = s; } }
      return b >= S.minConfidence ? [bf, b] : [null, b]; };
    const raw = headers.map((h) => [h].concat(best(h))), winners = {};
    raw.forEach(([, field, conf], i) => { if (field && (!(field in winners) || conf > winners[field][1])) winners[field] = [i, conf]; });
    return raw.map(([h, field, conf], i) => ({ header: h, field: field && winners[field][0] === i ? field : null, confidence: pyRound3(conf) }));
  }
  function missingRequired(mapped, op) {
    const S = SCHEMA(), covered = new Set(mapped);
    for (const canon of Object.keys(S.dual)) if (S.dual[canon].some((f) => covered.has(f))) covered.add(canon);
    const missing = (S.required[op] || []).filter((f) => !covered.has(f));
    if (op === "ADD" && !(covered.has("first_name") || covered.has("full_name"))) missing.push("first_name");
    return missing;
  }
  const isAutoConfirmable = (sugs, op) => { const S = SCHEMA(); return !missingRequired(sugs.filter((s) => s.field).map((s) => s.field), op).length && sugs.filter((s) => s.field).every((s) => s.confidence >= S.autoConfirm); };
  Object.assign(api, { suggestMapping, missingRequired, isAutoConfirmable, normHeader, levenshtein });
  /*__PART7__*/
  return api;
});
