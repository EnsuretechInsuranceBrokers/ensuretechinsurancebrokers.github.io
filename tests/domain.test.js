// Mid-term dependants (cases from the platform's tests/test_dependant_midterm.py), whole-file rules, and the generated state graph. Run: node tests/domain.test.js
const assert = require("assert"); const E = require("../assets/engine.js"); const D = require("../assets/data.js");
let n = 0; const ok = (f) => { f(); n++; };
const base = { policyStart: "2026-04-01", today: "2026-10-09", uploadDay: "2026-10-09" };
ok(() => assert.deepEqual(["SPOUSE", "WIFE", "HUSBAND", "DOMESTIC_PARTNER", "SON", "DAUGHTER_II", "FATHER", "SELF", "STEP_CHILD", null].map(E.midGroup), ["SPOUSE", "SPOUSE", "SPOUSE", "PARTNER", "KIDS", "KIDS", null, null, null, null]));
ok(() => { const r = E.dependantMidterm({ ...base, relation: "SPOUSE", eventDate: "2026-08-20", rule: { allowed: true, windowDays: 90, startBasis: "EVENT" } }); assert.equal(r.coverStart, "2026-08-20"); assert.equal(r.issues.length, 0); });      // a spouse starts at the marriage
ok(() => { const r = E.dependantMidterm({ ...base, relation: "SPOUSE", eventDate: "2026-04-10", rule: { allowed: true, windowDays: 30, startBasis: "UPLOAD" } }); assert.equal(r.coverStart, "2026-10-09"); assert.equal(r.issues[0].rule, "MIDTERM_APPROVAL_REQUIRED"); assert.equal(r.issues[0].severity, "WARN"); }); // upload basis, window still counts from the marriage
ok(() => { const r = E.dependantMidterm({ ...base, relation: "SON", eventDate: "2026-07-01", rule: { allowed: true, startBasis: "EVENT" } }); assert.equal(r.coverStart, "2026-07-01"); });                                   // a child starts at birth
ok(() => assert.equal(E.dependantMidterm({ ...base, relation: "WIFE", rule: { allowed: false } }).issues[0].rule, "MIDTERM_DEPENDANT_NOT_ALLOWED"));
ok(() => assert.equal(E.dependantMidterm({ ...base, relation: "SPOUSE", eventDate: null, rule: { allowed: true, startBasis: "EVENT" } }).issues[0].rule, "MIDTERM_EVENT_DATE_REQUIRED"));
ok(() => assert.equal(E.dependantMidterm({ ...base, relation: "SPOUSE", eventDate: "2026-12-01", rule: { allowed: true, startBasis: "EVENT" } }).issues[0].rule, "MIDTERM_EVENT_IN_FUTURE"));
ok(() => assert.equal(E.dependantMidterm({ ...base, relation: "SPOUSE", eventDate: "2020-05-05", rule: { allowed: true, startBasis: "EVENT" } }).coverStart, "2026-04-01"));                                            // never before the policy starts
ok(() => assert.equal(E.dependantMidterm({ ...base, relation: "FATHER", rule: { allowed: false } }).issues.length, 0));                                                                                                 // groups without a rule are untouched
// whole-file rules
ok(() => { const rows = [{ employee_code: "1", relation: "Self", full_name: "Asha Rao", dob: "1985-05-17", gender: "F", sum_insured: "500000", pan: "ABCDE1234F", effective_date: "2026-11-01" },
  { employee_code: "1", relation: "self", full_name: "Asha Rao", dob: "1985-05-17", gender: "F", sum_insured: "500000", pan: "ABCDE1234F", effective_date: "2026-11-01" },
  { employee_code: "2", relation: "Self", full_name: "Meera Nair", dob: "1990-03-03", gender: "F", sum_insured: "300000", pan: "ABCDE1234F", effective_date: "2026-11-01" }];
  const r = E.validateFile(rows, { op: "ADD", today: "2026-10-09", midtermBasis: "NO_MIDTERM", policyStart: "2026-04-01", roster: [{ employee_code: "1", relation_code: "SELF", dob: "1985-05-17" }] });
  const codes = r.issues.map((i) => i.rule + "@" + i.row); for (const c of ["DUPLICATE_ROW_IN_FILE@1", "DUPLICATE_PAN_IN_FILE@2", "MEMBER_ALREADY_EXISTS@0", "MIDTERM_NOT_ALLOWED@0"]) assert(codes.includes(c), c + " missing from " + codes); });
ok(() => { const r = E.validateFile([{ employee_code: "5", relation: "Self", full_name: "Raj Shah", dob: "1980-07-07", sum_insured: "400000", effective_date: "2030-04-01" }, { employee_code: "5", relation: "Cousin", full_name: "X Y", dob: "2000-01-01", sum_insured: "400000", effective_date: "2030-04-01" },
  { employee_code: "6", relation: "Self", full_name: "A B", dob: "1980-07-07", sum_insured: "1", effective_date: "2030-04-01" }, { employee_code: "6", relation: "Mother", full_name: "M B", dob: "1957-01-01", sum_insured: "1", effective_date: "2030-04-01" }],
  { op: "ADD", today: "2026-10-09", construct: { allowedRelations: [2, 5, 9], maxMembers: 6 }, rules: {} });
  const by = (code) => r.issues.filter((i) => i.rule === code); assert.equal(by("INVALID_RELATION").length, 1); assert.equal(by("RELATION_NOT_ALLOWED").length, 1); assert.equal(by("RELATION_NOT_ALLOWED")[0].row, 3);       // the clean family is checked, the broken one is not (row problems are reported, no noise)
});
// the state graph is the engine's own, and closed
ok(() => { const names = new Set(D.states.map((s) => s.name)); assert.equal(D.states.length, 36);
  for (const s of D.states) { for (const t of s.next) assert(names.has(t), s.name + " -> " + t); if (s.terminal) assert.equal(s.next.length, 0, s.name + " is terminal"); }
  assert.deepEqual(D.states.find((s) => s.name === "CD_INSUFFICIENT").next, ["CANCELLED_BY_HR", "CD_CHECK_INITIATED"]);
  assert.deepEqual(D.states.find((s) => s.name === "ENDORSEMENT_QUEUED").next, ["ENDORSEMENT_IN_PROGRESS"]);       // no cancel once execution is queued
  assert(!D.states.find((s) => s.name === "ENDORSEMENT_QUEUED").next.includes("CANCELLED_BY_HR")); });
console.log(n + " domain cases pass");
