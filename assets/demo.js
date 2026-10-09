/* demo.html: a click-through prototype. Two stories. The HR story branches at "how many employees?": up to 100 goes to a live grid, more goes to a spreadsheet.
   The numbers on the screens are not typed in: the column matching, the file and grid checks and the cost come from the same engine as explore.html (assets/engine.js),
   run on the sample data below. The sample data is made up. */
(function () {
  "use strict";
  var E = ET, Dec = E.Dec;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function group(s) { var p = s.split("."), i = p[0], last3 = i.slice(-3), rest = i.slice(0, -3); if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ","); return (rest ? rest + "," : "") + last3 + (p[1] !== undefined ? "." + p[1] : ""); }
  var inr = function (d, dp) { var s = Dec.str(d, dp === undefined ? 2 : dp); return (s[0] === "-" ? "−₹" : "₹") + group(s.replace("-", "")); };
  var rupee = function (n) { return "₹" + group(String(n)); };
  var num = function (n) { return group(String(n)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── the policy and the day ──────────────────────────────────────────────────────────────────────────────────────────────── */
  var POLICY = { start: "2030-04-01", end: "2031-03-31", proRata: "DAILY", inception: false, rounding: "CEIL", roundingUnit: 10, contribution: { type: "PERCENT", groups: { SELF: "0", SPOUSE: "50", CHILD: "50" } } };
  var EFF = "2030-07-01", TODAY = "2030-06-20", BALANCE = 15000000, GRID_MAX = 100;
  var CONSTRUCT = { allowedRelations: [2, 5, 6, 7, 9, 10, 11], maxMembers: 6, maxChildren: 2, maxParents: null, ageMin: null, ageMax: null };
  var COLS = [["employee_code", "Employee code"], ["relation", "Relation"], ["first_name", "First name"], ["last_name", "Last name"], ["dob", "Date of birth"], ["gender", "Gender"], ["sum_insured", "Sum insured"]];
  var OPT = { op: "ADD", today: TODAY, sourceKey: "", defaultEffectiveDate: EFF, midtermBasis: "DATE_OF_JOINING", policyStart: POLICY.start, inception: false, roster: [], construct: CONSTRUCT, rules: {} };

  /* ── a scenario: rows -> the engine's verdict -> the engine's price ───────────────────────────────────────────────────────── */
  function scenario(raw) {
    var check = E.validateFile(raw, OPT), bad = {};
    check.issues.forEach(function (i) { if (i.severity === "ERROR") bad[i.row] = true; });
    var good = check.rows.filter(function (r, i) { return !bad[i]; }), byEmp = {}, order = [];
    good.forEach(function (r) { if (!byEmp[r.employee_code]) { byEmp[r.employee_code] = []; order.push(r.employee_code); } byEmp[r.employee_code].push(r); });
    var families = order.map(function (code) {
      var res = E.priceFamily({ op: "ADD", eff: EFF, rate: { type: "FLAT", table: { flat: 18000 }, tax: 18 }, existing: [], employeeCode: code,
        rows: byEmp[code].map(function (r) { return { relation: r.relation_code, dob: r.dob, sumInsured: r.sum_insured }; }), policy: POLICY });
      return { code: code, name: byEmp[code][0].first_name + " " + (byEmp[code][0].last_name || ""), people: byEmp[code].length, res: res };
    });
    var sum = function (f) { return families.reduce(function (a, x) { return a + f(x.res); }, 0n); };
    var total = { charged: sum(function (r) { return r.charged; }), tax: sum(function (r) { return r.tax; }), total: sum(function (r) { return r.total; }), employee: sum(function (r) { return r.employee; }), employer: sum(function (r) { return r.employer; }) };
    var byRule = {}; check.issues.filter(function (i) { return i.severity === "ERROR"; }).forEach(function (i) { byRule[i.rule] = (byRule[i.rule] || 0) + 1; });
    return { raw: raw, check: check, bad: bad, good: good, families: families, total: total, after: BigInt(BALANCE) * 1000000000000n - total.total, byRule: byRule,
      failing: Object.keys(bad).length, people: good.length };
  }
  function age(dobIso) { var d = dobIso.split("-").map(Number), e = EFF.split("-").map(Number); return e[0] - d[0] - ((e[1] * 100 + e[2]) < (d[1] * 100 + d[2]) ? 1 : 0); }
  /* what the grid's side panel shows (the real service computes the same with pandas) */
  function summary(sc) {
    var emp = {}, rel = {}, bands = { "0-17": 0, "18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "56-65": 0, "66+": 0 }, si = 0, n = 0;
    sc.check.rows.forEach(function (r) { if (r.employee_code) emp[r.employee_code] = 1; if (r.relation_code) rel[r.relation_code] = (rel[r.relation_code] || 0) + 1;
      if (r.dob) { var a = age(r.dob), k = a < 18 ? "0-17" : a < 26 ? "18-25" : a < 36 ? "26-35" : a < 46 ? "36-45" : a < 56 ? "46-55" : a < 66 ? "56-65" : "66+"; bands[k]++; }
      if (r.sum_insured && +r.sum_insured > 0) { si += +r.sum_insured; n++; } });
    return { employees: Object.keys(emp).length, rel: rel, bands: bands, si: si, siN: n };
  }

  /* the 4-employee grid: first as typed (three mistakes), then corrected */
  var GRID_A = [
    { employee_code: "2041", relation: "SELF", first_name: "Asha", last_name: "Rao", dob: "17/05/1985", gender: "F", sum_insured: "5,00,000" },
    { employee_code: "2041", relation: "SPOUSE", first_name: "Ravi", last_name: "Rao", dob: "02/02/1983", gender: "M", sum_insured: "500000" },
    { employee_code: "2041", relation: "SON", first_name: "Kabir", last_name: "Rao", dob: "01/01/2015", gender: "M", sum_insured: "500000" },
    { employee_code: "2042", relation: "SELF", first_name: "Meera", last_name: "Nair", dob: "03/03/1990", gender: "F", sum_insured: "3,00,000" },
    { employee_code: "2042", relation: "COUSIN", first_name: "Odd", last_name: "Person", dob: "01/01/2000", gender: "M", sum_insured: "100000" },
    { employee_code: "2043", relation: "SELF", first_name: "Raj", last_name: "Shah", dob: "31/02/1980", gender: "M", sum_insured: "400000" },
    { employee_code: "2044", relation: "SELF", first_name: "Dev", last_name: "Iyer", dob: "07/07/1982", gender: "M", sum_insured: "-5" }];
  var FIXES = { 4: { relation: "DAUGHTER", first_name: "Tina", last_name: "Nair", dob: "01/01/2012", gender: "F", sum_insured: "300000" }, 5: { dob: "07/07/1980" }, 6: { sum_insured: "450000" } };
  var GRID_B = GRID_A.map(function (r, i) { return Object.assign({}, r, FIXES[i] || {}); });
  var gridA = scenario(GRID_A), gridB = scenario(GRID_B);

  /* the spreadsheet: 220 made-up employees, a handful of deliberate mistakes */
  function lcg(seed) { var s = seed; return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
  function bigSheet(n) {
    var r = lcg(20300), rows = [], pad = function (x) { return (x < 10 ? "0" : "") + x; }, pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var M = ["Arjun", "Vikram", "Rohit", "Sanjay", "Imran", "Karan", "Nikhil", "Suresh", "Manoj", "Deepak"], F = ["Priya", "Anita", "Neha", "Kavita", "Sunita", "Pooja", "Divya", "Rekha", "Shreya", "Lata"], L = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Khan", "Patel", "Gupta", "Mehta", "Das"];
    var SI = ["300000", "500000", "1000000"];
    for (var i = 0; i < n; i++) {
      var code = String(3000 + i), last = pick(L), male = r() < .6, y = 1970 + Math.floor(r() * 28), si = pick(SI);
      rows.push({ employee_code: code, relation: "SELF", first_name: pick(male ? M : F), last_name: last, dob: pad(1 + Math.floor(r() * 28)) + "/" + pad(1 + Math.floor(r() * 12)) + "/" + y, gender: male ? "M" : "F", sum_insured: si });
      if (r() < .55) rows.push({ employee_code: code, relation: "SPOUSE", first_name: pick(male ? F : M), last_name: last, dob: pad(1 + Math.floor(r() * 28)) + "/" + pad(1 + Math.floor(r() * 12)) + "/" + (y + Math.floor(r() * 5) - 2), gender: male ? "F" : "M", sum_insured: si });
      var kids = r() < .35 ? 0 : r() < .6 ? 1 : r() < .92 ? 2 : 3;
      var nb = 0, ng = 0;
      for (var k = 0; k < kids; k++) { var boy = r() < .5, ord = boy ? nb++ : ng++; rows.push({ employee_code: code, relation: (boy ? "SON" : "DAUGHTER") + ["", "_II", "_III"][ord], first_name: pick(boy ? M : F), last_name: last, dob: pad(1 + Math.floor(r() * 28)) + "/" + pad(1 + Math.floor(r() * 12)) + "/" + (2008 + Math.floor(r() * 16)), gender: boy ? "M" : "F", sum_insured: si }); }
    }
    function firstOf(code) { for (var j = 0; j < rows.length; j++) if (rows[j].employee_code === code) return j; return -1; }
    rows[firstOf("3040")].dob = "31/02/1979"; rows[firstOf("3077")].sum_insured = "-5"; rows[firstOf("3130")].relation = "COUSIN";
    rows.splice(firstOf("3150") + 1, 0, Object.assign({}, rows[firstOf("3150")])); delete rows[firstOf("3201")].first_name;
    return rows;
  }
  var SHEET_ROWS = bigSheet(220), fileSc = scenario(SHEET_ROWS);
  var CHUNK = 500, slices = Math.ceil(SHEET_ROWS.length / CHUNK);

  /* ── screen furniture ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
  function shell(active, role, title, sub, right, body) {
    var items = role === "hr" ? ["Dashboard", "Policy", "Endorsements", "Deposit", "Reports"] : ["Employers", "Policies", "Endorsements", "Deposit", "Reports"];
    return '<div class="app"><div class="side"><div class="brand"><i></i>ENSURETECH</div>' + items.map(function (n) { return '<div class="it' + (n === active ? " on" : "") + '">' + n + "</div>"; }).join("") +
      '<div class="who">' + (role === "hr" ? "<b>Priya Menon</b>HR admin · Acme Industries" : "<b>Meera Kapoor</b>Broker admin · Northwind Brokers") + '</div></div>' +
      '<div class="main"><div class="h"><div><h2>' + title + '</h2><div class="sub">' + sub + "</div></div><div>" + (right || "") + "</div></div>" + body + "</div></div>";
  }
  function card(label, v, p, cls) { return '<div class="card"><small>' + label + '</small><div class="v ' + (cls || "") + '">' + v + "</div>" + (p ? "<p>" + p + "</p>" : "") + "</div>"; }
  function btn(label, go, tag, ghost, path) { return '<span class="btnx' + (ghost ? " ghost" : "") + '" data-go="' + go + '"' + (path ? ' data-path="' + path + '"' : "") + ' data-tag="' + esc(tag || label) + '">' + label + "</span>"; }
  function timeline(states, nowIdx, stopAt) {
    return '<ul class="tl">' + states.map(function (s, i) { var cls = stopAt === i ? "stop" : i < nowIdx ? "done" : i === nowIdx ? "now" : ""; return '<li class="' + cls + '"><i></i><span class="code">' + s[0] + '</span><span class="when">' + (s[1] || "") + "</span></li>"; }).join("") + "</ul>";
  }
  function bars(obj, cls) { var max = Math.max.apply(null, Object.keys(obj).map(function (k) { return obj[k]; }).concat([1])); return Object.keys(obj).filter(function (k) { return obj[k]; }).map(function (k) { return '<div class="gb"><span>' + esc(k.replace(/_/g, " ").toLowerCase()) + '</span><i><b class="' + (cls || "") + '" style="width:' + Math.max(4, obj[k] / max * 100) + '%"></b></i><em>' + obj[k] + "</em></div>"; }).join(""); }
  var HAPPY = [["REQUEST_RAISED", "10:02:11"], ["FILE_STREAMED", "10:02:12"], ["VALIDATION_QUEUED", "10:02:12"], ["VALIDATION_IN_PROGRESS", "10:02:13"], ["VALIDATION_PARTIAL", "10:02:14"], ["PREMIUM_CALC_QUEUED", "10:03:40"], ["PREMIUM_CALCULATED", "10:03:41"], ["CD_CHECK_INITIATED", "10:03:41"], ["CD_SUFFICIENT", "10:03:42"], ["ENDORSEMENT_QUEUED", "10:04:05"], ["ENDORSEMENT_IN_PROGRESS", "10:04:06"], ["ENDORSED", "10:04:08"]];
  var S = { path: "grid" };                     // which way the story went: "grid" or "file"
  var cur = function () { return S.path === "file" ? fileSc : gridB; };

  /* the live grid, drawn from a scenario; `upTo` says how many rows have been checked so far (the log fills in as they are) */
  function gridTable(sc, upTo, fixed) {
    var head = '<tr><th class="ix">#</th><th class="st"></th>' + COLS.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "</tr>";
    var body = sc.raw.map(function (r, i) {
      var issues = sc.check.issues.filter(function (x) { return x.row === i && x.severity === "ERROR"; }), flds = {}; issues.forEach(function (x) { flds[x.field === "relation_code" ? "relation" : x.field] = x.message; });
      var checked = i < upTo, mark = !checked ? '<span class="mk wait">…</span>' : issues.length ? '<span class="mk no">✕</span>' : '<span class="mk yes">✓</span>';
      return '<tr class="' + (checked && issues.length ? "bad" : "") + '"><td class="ix">' + (i + 1) + "</td><td class=\"st\">" + mark + "</td>" + COLS.map(function (c) {
        var v = r[c[0]] === undefined ? "" : r[c[0]], isErr = checked && flds[c[0]], isFixed = fixed && fixed[i] && fixed[i][c[0]] !== undefined;
        return '<td class="' + (isErr ? "ce" : isFixed ? "cf" : "") + '"' + (isErr ? ' title="' + esc(flds[c[0]]) + '"' : "") + ">" + esc(c[0] === "relation" ? String(v).toLowerCase().replace(/_/g, " ") : v) + "</td>"; }).join("") + "</tr>";
    }).join("");
    return '<div class="gridbox"><table class="gt"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>";
  }
  function gridSide(sc) {
    var s = summary(sc), errs = Object.keys(sc.byRule).length ? '<div class="sc"><h4>Mistakes by kind</h4>' + bars(sc.byRule, "e") + "</div>" : "";
    return '<div class="gside"><div class="sc"><h4>Progress</h4><div class="bigno">' + s.employees + '<span> of 4 employees</span></div><div class="mtr"><i style="width:100%"></i></div><div class="chips2"><span class="pill ok">' + (sc.check.rows.length - sc.failing) + ' good</span><span class="pill bad">' + sc.failing + ' to fix</span></div></div>' + errs +
      '<div class="sc"><h4>Ages on the day cover starts</h4>' + bars(s.bands) + '</div><div class="sc"><h4>Sum insured</h4><div class="bigno sm">' + rupee(s.si) + "</div><p>across " + s.siN + " people</p></div></div>";
  }
  /* what would have been sent: one row, versus the whole sheet */
  function reqBytes(sc, i) { return JSON.stringify({ op_type: "ADD", row: sc.raw[i], position: i, grid_rows: sc.raw.length, v: 1 }).length; }
  function wholeBytes(sc) { return JSON.stringify({ op_type: "ADD", rows: sc.raw }).length; }

  /* ── the stories ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
  var FLOWS = {
    hr: { title: "Priya · HR at Acme", screens: [
      { id: "signin", name: "Sign in", solo: true, next: "dash", html: function () { return '<div class="app solo"><div class="login"><div class="box"><div class="mono acid" style="margin-bottom:14px">ENSURETECH · EMPLOYER PORTAL</div><h2>Welcome back.</h2><div class="sub" style="color:var(--muted);margin-bottom:22px">Sign in to manage Acme Industries\' cover.</div><div class="field"><label>Work email</label><div class="in">priya.menon@acme.example</div></div><div class="field"><label>Password</label><div class="in">••••••••••••</div></div>' + btn("Sign in →", "dash", "Sign in") + "</div></div></div>"; },
        note: { title: "Sign-in is the only door", body: "<p>The portal exchanges the password for a token, but <b>keeps the token on the server</b>, in an encrypted session. The browser only holds a session cookie.</p><ul><li>The employer's identity comes from the token, never from the address bar.</li><li>Every core service re-checks the role and refuses calls that skip the gateway.</li></ul><span class='chip acid'>identity-service</span><span class='chip acid'>gateway</span>" } },
      { id: "dash", name: "Policy dashboard", next: "count", html: function () { return shell("Dashboard", "hr", "Acme Industries", "Group Mediclaim · FY 2030–31 · 1 Apr 2030 – 31 Mar 2031", '<span class="pill ok">Live</span>',
          '<div class="grid g4" style="margin-bottom:14px">' + card("Members covered", "1,240", "410 employees, 830 dependants") + card("Deposit balance", rupee(BALANCE), "Low-balance alert at ₹10,00,000") + card("Enrollment window", "Closed", "Joiners are priced from their date of joining", "sm") + card("Open endorsements", "0", "Last one ended 12 Jun", "sm") + "</div>" +
          '<div class="card" style="margin-bottom:14px"><small>What you can do</small><div style="display:flex;gap:10px;margin-top:6px">' + btn("+ Add or remove people", "count", "Start here") + btn("Download roster", "count", "Not in this demo", true) + "</div></div>" +
          '<table class="t"><thead><tr><th>Recent</th><th>Type</th><th>Lines</th><th class="r">Charged</th><th>State</th></tr></thead><tbody><tr><td>12 Jun</td><td>Add people</td><td>3</td><td class="r">₹21,400.00</td><td><span class="pill ok">ENDORSED</span></td></tr><tr><td>28 May</td><td>Remove</td><td>1</td><td class="r">−₹6,150.00</td><td><span class="pill ok">ENDORSED</span></td></tr></tbody></table>'); },
        note: { title: "One call, two services", body: "<p>This page is a <b>composite</b>: the gateway asks the policy service for the policy and the billing service for the deposit, and returns one answer.</p><ul><li>Fields the page doesn't need are stripped by an allow-list before they leave the gateway.</li><li>The balance is read from the ledger, not computed on the page.</li></ul><span class='chip acid'>policies.overview</span><span class='chip'>billing-service</span>" } },
      { id: "count", name: "How many employees?", next: "grid1", html: function () { return shell("Add or remove people", "hr", "Add or remove people", "How many employees are you changing?", "",
          '<div class="card" style="margin-bottom:14px"><small>Number of employees</small><div class="v">4 <span class="sub" style="font-size:13px;font-weight:500">or</span> 220</div><p>Up to ' + GRID_MAX + ' you type them into a grid that checks every row as you go. More than that, you get a spreadsheet made for your policy. Try both.</p></div>' +
          '<div class="bigrow"><div class="opcard" data-go="grid1" data-path="grid" data-tag="4 employees: the grid"><span class="pill acid">4 employees</span><h3>A grid, checked as you type</h3><p>Four families, typed or pasted from Excel. Each row is checked against the policy the moment you pause.</p></div>' +
          '<div class="opcard" data-go="sheet1" data-path="file" data-tag="220 employees: the spreadsheet"><span class="pill acid">220 employees</span><h3>A spreadsheet made for the policy</h3><p>Over ' + GRID_MAX + ' is quicker in Excel: drop-downs and checks built in, then one upload.</p></div></div>' +
          '<div class="callout"><b>Who can do this.</b> Admins and non-admin HR staff can enter or upload. Only admins can proceed, retry, cancel or close an endorsement afterwards.</div>'); },
        note: { title: "The count decides the way in", body: "<p>One question up front picks the quickest route. The line is a setting (<code>GRID_MAX_EMPLOYEES</code>, 100 by default), not a rule baked into the screens.</p><ul><li>Up to 100: a grid session opens on the engine, sized for the count.</li><li>Above: nothing is opened; you get a sheet, and the upload goes through the chunked file path.</li></ul><span class='chip acid'>intake/plan</span>" } },

      { id: "grid1", name: "Type or paste", grp: "grid", next: "grid2", html: function () { return shell("Add or remove people", "hr", "Enter 4 employees", "Type or paste from Excel. Every row is checked against the policy as you go; nothing is saved until you submit.", '<span class="pill warn" id="g-pill">checking…</span>',
          '<div class="gridrow">' + '<div id="g-table">' + gridTable(gridA, 0) + '</div>' + '<div id="g-side">' + "" + "</div></div>" +
          '<div class="reqlog" id="g-log"><div class="rl-h"><span>What goes over the wire</span><b id="g-tot"></b></div><div id="g-lines"></div></div>' +
          '<div id="g-act" hidden style="margin-top:10px;display:flex;gap:10px;align-items:center"><span class="mut" id="g-msg" style="font-size:13px"></span>' + btn("Fix the three rows", "grid2", "Correct them") + "</div>"); },
        enter: function (frame, done) {
          var n = gridA.raw.length, i = 0, sent = 0, lines = frame.querySelector("#g-lines"), act = frame.querySelector("#g-act"), tot = frame.querySelector("#g-tot");
          function paint() { frame.querySelector("#g-table").innerHTML = gridTable(gridA, i); }
          function line(k) { var errs = gridA.check.issues.filter(function (x) { return x.row === k && x.severity === "ERROR"; }), b = reqBytes(gridA, k); sent += b;
            lines.insertAdjacentHTML("beforeend", '<div class="rl"><code>PUT /grid/rows/r' + (k + 1) + "</code><span>" + b + " B</span><em class=\"" + (errs.length ? "bad" : "ok") + '">' + (errs.length ? errs[0].rule : "✓ passes") + "</em></div>"); tot.textContent = sent + " B sent, not " + wholeBytes(gridA) + " B × " + (k + 1); }
          function finish() { frame.querySelector("#g-side").innerHTML = gridSide(gridA); frame.querySelector("#g-pill").textContent = gridA.failing + " rows to fix"; frame.querySelector("#g-msg").textContent = gridA.failing + " rows need fixing before you can submit."; act.hidden = false; rehot(); }
          if (reduced) { i = n; paint(); for (var k = 0; k < n; k++) line(k); finish(); return; }
          done.timer = setInterval(function () { if (i < n) { line(i); i++; paint(); } else { clearInterval(done.timer); finish(); } }, 520); },
        note: { title: "Only the row you changed is sent", body: "<p>The engine holds the grid. When you pause on a row, <b>just that row</b> goes over (the log shows its real size), and the answer says whether it is fine, whether it changed any other row (a duplicate, a family), and the new summary.</p><ul><li>Cousin isn't an allowed relation, 31/02 isn't a date, −5 isn't a sum insured: the engine's own verdicts.</li><li>It checks the same rules as a file upload, so a clean grid cannot fail later for a reason it could have known.</li></ul><span class='chip acid'>PUT grid/rows/{key}</span><span class='chip ok'>same rule book as the file path</span>" } },
      { id: "grid2", name: "Every row passes", grp: "grid", next: "cost", html: function () { return shell("Add or remove people", "hr", "Enter 4 employees", "Three rows were corrected. Only those three rows were sent again.", '<span class="pill ok">All ' + gridB.raw.length + " rows pass</span>",
          '<div class="gridrow"><div id="g-table">' + gridTable(gridB, 99, { 4: FIXES[4], 5: FIXES[5], 6: FIXES[6] }) + '</div><div id="g-side">' + gridSide(gridB) + "</div></div>" +
          '<div class="reqlog"><div class="rl-h"><span>The three corrections</span><b>' + [4, 5, 6].map(function (k) { return reqBytes(gridB, k); }).reduce(function (a, b) { return a + b; }, 0) + ' B in all</b></div>' + [4, 5, 6].map(function (k) { return '<div class="rl"><code>PUT /grid/rows/r' + (k + 1) + "</code><span>" + reqBytes(gridB, k) + ' B</span><em class="ok">✓ passes</em></div>'; }).join("") + "</div>" +
          '<div style="margin-top:10px;display:flex;gap:10px;align-items:center"><span class="pill ok">Ready to submit</span>' + btn("Submit for processing", "cost", "Submit", false, "grid") + "</div>"); },
        note: { title: "Cleared by the engine, not the page", body: "<p>The three rows that were wrong are now right, and the engine says so row by row. A paste or a reload sends the whole grid once; typing never does.</p><ul><li>Submit saves the grid and only then promotes it to a job. A grid with an error cannot be submitted.</li></ul><span class='chip acid'>PUT grid · POST submit</span>" } },

      { id: "sheet1", name: "Download the sheet", grp: "file", next: "sheet2", html: function () { return shell("Add or remove people", "hr", "220 employees: use the spreadsheet", "Over " + GRID_MAX + " employees is quicker in Excel. This sheet is made for your policy.", '<span class="pill acid">Step 1 of 3</span>',
          '<div class="xl"><div class="xl-bar"><span>endorsement-add-POL-7.xlsx</span><i>Endorsement</i><i class="dim">Instructions</i></div><table class="xt"><thead><tr><th></th>' + ["Employee code", "Relation", "First name", "Last name", "Date of birth", "Gender", "Sum insured", "Effective date"].map(function (h, k) { return "<th>" + String.fromCharCode(65 + k) + "<small>" + h + "</small></th>"; }).join("") + "</tr></thead><tbody>" +
          [["1", "3000", "self", "Arjun", "Sharma", "17-May-1985", "M", "5,00,000"], ["2", "3000", "spouse ▾", "Priya", "Sharma", "02-Feb-1987", "F", "5,00,000"], ["3", "3001", "self", "Kavita", "Iyer", "<b class=\"xe\">not-a-date</b>", "F", "3,00,000"], ["4", "", "", "", "", "", "", ""], ["5", "", "", "", "", "", "", ""]].map(function (r) { return "<tr><td class=\"rn\">" + r[0] + "</td>" + r.slice(1).map(function (c) { return "<td>" + c + "</td>"; }).join("") + "<td></td></tr>"; }).join("") +
          '</tbody></table><div class="xl-pop"><b>Relation</b>self · spouse · son · daughter · father …</div><div class="xl-err">Excel refuses it: <b>Enter a date.</b></div></div>' +
          '<div class="grid g3" style="margin-top:12px">' + card("Drop-downs", "relation, gender", "Pick from a list, no spelling") + card("Refuses wrong values", "dates, amounts, PAN", "Text in a date cell is stopped in Excel") + card("Empty rows", "ignored", "Fill only the people you have") + "</div>" +
          '<div style="display:flex;gap:10px;margin-top:12px">' + btn("I filled it in: upload", "sheet2", "Upload the sheet") + btn("Use my own file instead", "own1", "Your own CSV", true, "file") + "</div>"); },
        note: { title: "Most mistakes cannot be typed", body: "<p>The sheet is built for this policy: the column names are exactly the ones our reader matches with full confidence, so the upload needs <b>no mapping step</b>. Relation and gender are drop-downs; dates, amounts and PANs refuse the wrong kind of value.</p><ul><li>The data rows are left empty on purpose: a placeholder you didn't use would otherwise be reported as an error.</li><li>The cover start date is asked at upload.</li></ul><span class='chip acid'>intake/template</span>" } },
      { id: "sheet2", name: "Upload it", grp: "file", next: "validation", html: function () { return shell("Add or remove people", "hr", "Reading your sheet", "endorsement-add-POL-7.xlsx · " + num(SHEET_ROWS.length) + " rows · cover starts 1 Jul 2030", '<span class="pill acid">Step 3 of 3</span>',
          '<div class="card"><small>Read in slices of ' + CHUNK + ' rows, each checked on its own</small><div id="sl">' + Array.apply(null, Array(slices)).map(function (_, k) { var from = k * CHUNK + 1, to = Math.min((k + 1) * CHUNK, SHEET_ROWS.length); return '<div class="sli"><span>slice ' + (k + 1) + " · rows " + num(from) + "–" + num(to) + '</span><i><b id="sb' + k + '" style="width:0%"></b></i><em id="se' + k + '">waiting</em></div>'; }).join("") + "</div></div>" +
          '<div class="callout" id="sdone" hidden><b>Read.</b> ' + num(SHEET_ROWS.length) + ' rows: <span class="ok2">' + num(SHEET_ROWS.length - fileSc.failing) + ' good</span>, <span class="bad2">' + fileSc.failing + ' to fix</span>.</div><div id="snext" hidden>' + btn("See what the sheet said", "validation", "Results", false, "file") + "</div>"); },
        enter: function (frame, done) { var k = 0, p = 0, total = slices;
          function setBar(j, pct, txt) { var b = frame.querySelector("#sb" + j), e = frame.querySelector("#se" + j); if (b) { b.style.width = pct + "%"; e.textContent = txt; } }
          if (reduced) { for (var j = 0; j < total; j++) setBar(j, 100, "checked"); frame.querySelector("#sdone").hidden = false; frame.querySelector("#snext").hidden = false; rehot(); return; }
          done.timer = setInterval(function () { p += 8; for (var j = 0; j < total; j++) { var q = Math.max(0, Math.min(100, p - j * 12)); setBar(j, q, q >= 100 ? "checked" : q > 0 ? "checking…" : "waiting"); }
            if (p - (total - 1) * 12 >= 100) { clearInterval(done.timer); frame.querySelector("#sdone").hidden = false; frame.querySelector("#snext").hidden = false; rehot(); } }, 120); },
        note: { title: "A big sheet is checked in slices", body: "<p>The sheet is read as a stream and cut into slices of " + CHUNK + " rows, <b>never splitting a family</b>. Each slice is its own job for a worker, so several can run at once and a million-row file is bounded by one slice of memory, not the whole file.</p><ul><li>The row rules run vectorised over each slice.</li><li>Family rules are asked of the policy service once per slice.</li></ul><span class='chip acid'>csv/upload</span><span class='chip'>chunked pipeline</span>" } },

      { id: "validation", name: "What the sheet said", grp: "file", next: "cost", html: function () { var sc = fileSc, fail = Object.keys(sc.bad).slice(0, 6).map(Number);
          return shell("Add or remove people", "hr", num(sc.failing) + " lines need fixing, " + num(SHEET_ROWS.length - sc.failing) + " are good", num(SHEET_ROWS.length) + " lines read. You can go on with the good ones.", '<span class="pill warn">VALIDATION_PARTIAL</span>',
          '<div class="chips2" style="margin-bottom:10px">' + Object.keys(sc.byRule).map(function (k) { return '<span class="pill bad">' + k + " × " + sc.byRule[k] + "</span>"; }).join("") + "</div>" +
          '<table class="t"><thead><tr><th>Line</th><th>Employee</th><th>Person</th><th>What we found</th></tr></thead><tbody>' + fail.map(function (i) { var r = sc.check.rows[i], iss = sc.check.issues.filter(function (x) { return x.row === i; });
            return '<tr class="bad"><td>' + (i + 2) + "</td><td>" + (r.employee_code || "—") + "</td><td>" + esc([r.first_name, r.last_name].filter(Boolean).join(" ") || "—") + " · " + (r.relation_code ? r.relation_code.toLowerCase() : "?") + "</td><td>" + iss.slice(0, 1).map(function (x) { return '<span class="pill bad">' + x.rule + "</span> " + esc(x.message); }).join("") + "</td></tr>"; }).join("") + (sc.failing > fail.length ? '<tr><td colspan="4" class="mut">… and ' + (sc.failing - fail.length) + " more lines, listed by number</td></tr>" : "") + "</tbody></table>" +
          '<div style="display:flex;gap:10px;margin-top:14px">' + btn("Continue with " + num(sc.good.length) + " good lines", "cost", "Proceed", false, "file") + btn("Download the problem lines", "cost", "Not in this demo", true) + "</div>"); },
        note: { title: "A bad cell is a row error, never a failed job", body: "<p>Every cell is normalised, then checked: required fields, ages, duplicates, the policy's family rules. These are the engine's own verdicts on the sample sheet: an invalid date, a negative sum insured, a relation that isn't allowed, a duplicated row, a missing name, and families over the child limit.</p><ul><li>Good lines are never held hostage by bad ones.</li></ul><span class='chip acid'>VALIDATION_PARTIAL</span><span class='chip ok'>2,500 messy rows checked</span>" } },

      { id: "own1", name: "Your own file", grp: "own", next: "own2", html: function () { return shell("Add or remove people", "hr", "Upload your own file", "Already have a sheet from your HR system? Excel or CSV works too.", "",
          '<div class="drop"><b>joiners_july.csv</b><span>' + (SHEET_ROWS.length) + ' lines · 7 columns · from your HR export</span></div><div class="callout" style="margin-top:16px"><b>No template needed.</b> Column names, date formats and relations like “Wife” or “Son-I” are understood. We show you how we read the columns first.</div><div style="display:flex;gap:10px;margin-top:14px">' + btn("Upload and read", "own2", "Upload") + btn("Back to the made-for-you sheet", "sheet1", "Back", true) + "</div>"); },
        note: { title: "Legacy files still work", body: "<p>You are never forced into the template. Any sheet is accepted; we negotiate the columns with you once and remember the answer.</p><span class='chip acid'>csv/preview</span>" } },
      { id: "own2", name: "Check the columns", grp: "own", next: "validation", html: function () { var m = E.suggestMapping(["Emp Code", "Relationship", "Member Name", "DOB", "Gender", "Sum Insured", "Effective Date"]); return shell("Add or remove people", "hr", "Does this look right?", "We matched your columns to ours. Confirm once; we remember it.", '<span class="pill ok">' + m.filter(function (x) { return x.field; }).length + " of " + m.length + " matched</span>",
          '<table class="t"><thead><tr><th>Your column</th><th>Our field</th><th class="r">Confidence</th></tr></thead><tbody>' + m.map(function (x) { return "<tr><td>" + esc(x.header) + '</td><td><code class="acid">' + (x.field || "—") + '</code></td><td class="r">' + x.confidence.toFixed(2) + "</td></tr>"; }).join("") + "</tbody></table>" +
          '<div class="callout"><b>Every column is a confident match.</b> Less certain ones would be shown here for you to fix before anything runs.</div><div style="display:flex;gap:10px">' + btn("Looks right, continue", "validation", "Confirm mapping", false, "file") + "</div>"); },
        note: { title: "Reading messy headers", body: "<p>Matching is by name similarity and a list of known synonyms (“Emp Code”, “Employee ID”, “Staff ID”…), plus per-TPA dialects. Anything below the confidence floor is left for a human.</p><span class='chip ok'>1,200 matches checked against the Python</span>" } },

      { id: "cost", name: "Cost and deposit", next: "run", html: function () { var sc = cur(), many = sc.families.length > 4;
          return shell("Add or remove people", "hr", "Here is what it will cost", num(sc.families.length) + " employees · " + num(sc.people) + " people · effective 1 Jul 2030", '<span class="pill ok">Deposit covers it</span>',
          '<div class="grid g4" style="margin-bottom:14px">' + card("Premium for the rest of the year", inr(sc.total.charged), "Pro-rata daily: 275 of 366 days, rounded up to ₹10") + card("Tax (18%)", inr(sc.total.tax)) + card("Total", inr(sc.total.total)) + card("Deposit after", inr(sc.after, 0), "from " + rupee(BALANCE), "sm") + "</div>" +
          '<table class="t"><thead><tr><th>Employee</th><th>People</th><th class="r">Charged</th><th class="r">Employee pays</th><th class="r">Employer pays</th></tr></thead><tbody>' + sc.families.slice(0, many ? 5 : 8).map(function (f) { return "<tr><td>" + esc(f.name) + " (" + f.code + ")</td><td>" + f.people + '</td><td class="r">' + inr(f.res.charged) + '</td><td class="r">' + inr(f.res.employee) + '</td><td class="r">' + inr(f.res.employer) + "</td></tr>"; }).join("") + (many ? '<tr><td colspan="5" class="mut">… and ' + num(sc.families.length - 5) + " more employees</td></tr>" : "") + "</tbody></table>" +
          '<div class="callout"><b>Nothing has been charged yet.</b> The money is reserved when you confirm, and committed only when the endorsement is applied. If it fails or you cancel, it is released.</div><div style="display:flex;gap:10px">' + btn("Confirm and proceed", "run", "Proceed") + btn("Cancel", "dash", "Cancel", true) + "</div>"); },
        note: { title: "The number is computed, not typed", body: "<p>Each person's change in premium is multiplied by their relation's pro-rata factor, summed, <b>rounded once</b>, taxed, then split by the policy's contribution plan. These figures are the engine's, run on the sample data you just saw.</p><ul><li>Open <b>Explore</b> to change any input and see why the total moves.</li><li>The deposit check is a reservation: CD_CHECK_INITIATED → CD_SUFFICIENT.</li></ul><span class='chip ok'>7,500 cases checked against the Python</span>" } },
      { id: "run", name: "It runs", next: "done", html: function () { return shell("Endorsements", "hr", "Endorsement #E-3071", (S.path === "file" ? "endorsement-add-POL-7.xlsx" : "typed in the grid") + " · started by Priya Menon", '<span class="pill acid" id="live-pill">RUNNING</span>',
          '<div class="grid g2"><div class="card"><small>Where it is</small><div id="tlbox">' + timeline(HAPPY, 0) + '</div></div><div><div class="card"><small>What each step means</small><p id="tlmean" style="margin:0;color:var(--ink);font-size:14px;line-height:1.6">Raised.</p></div><div class="callout"><b>After the roster is updated</b> the job moves on to the TPA and insurer steps. Those need a live connection to each TPA, which this demo does not have, so it stops at ENDORSED.</div><div style="margin-top:10px" id="tlnext" hidden>' + btn("See the result", "done", "Continue") + "</div></div></div>"); },
        enter: function (frame, done) { var tl = frame.querySelector("#tlbox"), mean = frame.querySelector("#tlmean"), nxt = frame.querySelector("#tlnext"), pill = frame.querySelector("#live-pill");
          var means = ["The request exists.", "The file is stored.", "Waiting for a validation worker.", "Checking every line.", "Some lines were not good. HR chose to go on with the rest.", "Waiting for a pricing worker.", "Premiums computed from the rate card.", "Asking billing for the money.", "Reserved: the deposit covers it.", "Queued for execution. It can't be cancelled from here on.", "Updating the roster.", "Done: the people are now covered."];
          var i = 0, t = done.timer = setInterval(function () { i++; tl.innerHTML = timeline(HAPPY, i); mean.textContent = means[i]; if (i >= HAPPY.length - 1) { clearInterval(t); tl.innerHTML = timeline(HAPPY, HAPPY.length); pill.textContent = "ENDORSED"; pill.className = "pill ok"; nxt.hidden = false; rehot(); } }, reduced ? 40 : 520); },
        note: { title: "A state machine, not a spinner", body: "<p>The job has 36 possible states and only legal moves are accepted. Each move is recorded with who or what caused it, so the audit trail is the timeline you see.</p><ul><li>Once ENDORSEMENT_QUEUED, HR can no longer cancel: the money is committed.</li><li>A failure at any step lands somewhere you can act on it, never in silence.</li></ul><span class='chip acid'>states.py</span>" } },
      { id: "done", name: "Done", next: null, html: function () { var sc = cur(); return shell("Endorsements", "hr", num(sc.people) + " people are covered", "From 1 Jul 2030 · reference E-3071", '<span class="pill ok">ENDORSED</span>',
          '<div class="grid g3" style="margin-bottom:14px">' + card("Members covered", num(1240 + sc.people), "was 1,240") + card("Deposit", inr(sc.after, 0), inr(sc.total.total) + " debited, reference E-3071", "sm") + card("Still to fix", (S.path === "file" ? num(fileSc.failing) : "0") + " lines", S.path === "file" ? "Download the problem lines, correct them, upload again" : "Every row passed before submit", "sm") + "</div>" +
          '<table class="t"><thead><tr><th>Ledger</th><th>Reference</th><th class="r">Amount</th></tr></thead><tbody><tr><td>Reserved</td><td>E-3071</td><td class="r">' + inr(sc.total.total) + '</td></tr><tr><td>Committed (debited)</td><td>E-3071</td><td class="r">' + inr(sc.total.total) + '</td></tr></tbody></table>' +
          '<div class="callout"><b>That is the whole HR side, by either route.</b> Next, see how the broker set this policy up.</div><div style="display:flex;gap:10px">' + btn("Switch to the broker's story →", "broker", "Next story") + btn("Try the other route", "count", "Back to the choice", true) + "</div>"); },
        note: { title: "What changed, and where", body: "<p>Three services reacted to one event, <b>EndorsementApplied</b>, without being called:</p><ul><li><b>Billing</b> committed the reservation as a debit, with the endorsement id as the reference.</li><li><b>Integration</b> would create a sync job for the changed members.</li><li><b>Read service</b> updated the dashboards.</li></ul><span class='chip acid'>endorsement.events</span>" } }
    ] },
    broker: { title: "Meera · Broker", screens: [
      { name: "Your employers", html: function () { return shell("Employers", "broker", "Northwind Brokers", "3 employers · 4 live policies", btn("+ New policy", 1, "Set up a policy"),
          '<div class="grid g4" style="margin-bottom:14px">' + card("Employers", "3") + card("Live policies", "4") + card("Needs attention", "1", "Deposit too low for a pending job", "sm") + card("Open endorsements", "2", "", "sm") + "</div>" +
          '<table class="t"><thead><tr><th>Employer</th><th>Policies</th><th class="r">Deposit</th><th>Status</th></tr></thead><tbody><tr><td>Acme Industries</td><td>2</td><td class="r">' + inr(gridB.after, 0) + '</td><td><span class="pill ok">Healthy</span></td></tr><tr><td>Bluebird Logistics</td><td>1</td><td class="r">₹62,000</td><td><span class="pill warn">Below threshold</span></td></tr><tr><td>Cedar Foods</td><td>1</td><td class="r">₹4,80,000</td><td><span class="pill ok">Healthy</span></td></tr></tbody></table>'); },
        note: { title: "Your tenant, nobody else's", body: "<p>A broker sees only its own employers. The scope comes from the token on every read, in every service.</p><ul><li>BROKER_ADMIN configures and approves.</li><li>BROKER_SPECIALIZER runs endorsements.</li><li>BROKER_NON_ADMIN reads.</li></ul><span class='chip acid'>roles</span>" } },
      { name: "Set up a policy", html: function () { return shell("Policies", "broker", "New policy · Bluebird Logistics", "Group Mediclaim FY 2030–31", '<span class="pill warn">Not approved</span>',
          '<div class="grid g3"><div class="card"><small>Rate card</small><div class="v sm">Flat per member</div><p>₹18,000 a year, the same for everyone</p></div><div class="card"><small>Pro-rata</small><div class="v sm">Daily</div><p>Per relation, spouse and children can differ</p></div><div class="card"><small>Who pays</small><div class="v sm">By percentage</div><p>Employee 0% · spouse 50% · children 50%</p></div>' +
          '<div class="card"><small>Family rules</small><div class="v sm">Self, spouse, children</div><p>At most 6 people, 3 children, age gaps per relation</p></div><div class="card"><small>Enrollment window</small><div class="v sm">1 – 30 Apr 2030</div><p>Later joiners priced from date of joining</p></div><div class="card"><small>Rounding</small><div class="v sm">Up to ₹10</div><p>Applied once, on the total</p></div></div>' +
          '<div style="display:flex;gap:10px;margin-top:16px">' + btn("Approve policy", 2, "Approve") + btn("Save as draft", 2, "Not in this demo", true) + "</div>"); },
        note: { title: "Rules live on the policy", body: "<p>Rate card, pro-rata, contribution, family rules and windows are <b>data on the policy</b>, not code. Every endorsement is checked against them automatically.</p><ul><li>Only BROKER_ADMIN can write them.</li><li>Open <b>Explore</b> to try any rate card, family rule or window.</li></ul><span class='chip acid'>policy-service</span>" } },
      { name: "Approve", html: function () { return shell("Policies", "broker", "Policy approved", "Bluebird Logistics · Group Mediclaim FY 2030–31", '<span class="pill ok">Live</span>',
          '<div class="callout"><b>Approving published one event: PolicyApproved.</b> Nobody was called. Two services were listening.</div><div class="grid g2"><div class="card"><small>Billing service</small><div class="v sm">Opened a deposit account</div><p>Linked to this policy (or to a company pool, if you chose one). Balance ₹0 until you record money received.</p></div><div class="card"><small>Integration service</small><div class="v sm">Routed to the TPA</div><p>Using the TPA recorded on the policy, if there is one. Live TPA connections are not part of this demo.</p></div></div><div style="margin-top:16px">' + btn("Record the first deposit", 3, "Next") + "</div>"); },
        note: { title: "Events, not phone calls", body: "<p>The policy service writes <b>PolicyApproved</b> next to the change itself; a relay publishes it; billing and integration each react in their own time.</p><ul><li>If billing is down, the event waits. Nothing is lost.</li></ul><span class='chip acid'>policy.events</span><span class='chip'>outbox</span>" } },
      { name: "Record a deposit", html: function () { return shell("Deposit", "broker", "Deposit · Bluebird Logistics", "Money received from the employer", '<span class="pill acid">BROKER_ADMIN</span>',
          '<div class="grid g2"><div><div class="field"><label>Amount received</label><div class="in">₹5,00,000.00</div></div><div class="field"><label>Reference</label><div class="in">NEFT-48820931</div></div><div class="field"><label>Low-balance alert at</label><div class="in">₹1,00,000</div></div>' + btn("Record credit", 4, "Record") + '</div><div class="card"><small>Balance after</small><div class="v">₹5,62,000</div><p>₹62,000 existing + ₹5,00,000. The threshold flag clears: the balance is above ₹1,00,000.</p></div></div>'); },
        note: { title: "A ledger, not a counter", body: "<p>The deposit is an append-only ledger: credits, reservations, debits, releases. The balance is derived from it.</p><ul><li>Only BROKER_ADMIN records money received.</li><li>The ledger records money; it doesn't collect it. Payments are not built.</li></ul><span class='chip acid'>billing-service</span>" } },
      { name: "Watch the work", html: function () { return shell("Endorsements", "broker", "Endorsements", "Across all your employers", "",
          '<table class="t"><thead><tr><th>Employer</th><th>Request</th><th>State</th><th>What it needs</th></tr></thead><tbody><tr><td>Acme Industries</td><td>E-3071 · add 4</td><td><span class="pill ok">ENDORSED</span></td><td>Nothing</td></tr><tr class="bad"><td>Bluebird Logistics</td><td>E-3074 · add 9</td><td><span class="pill bad">CD_INSUFFICIENT</span></td><td>The deposit does not cover ₹1,12,400. It will re-check after you top up.</td></tr><tr><td>Cedar Foods</td><td>E-3075 · remove 1</td><td><span class="pill warn">VALIDATION_PARTIAL</span></td><td>HR to decide: go on with the good lines, or cancel</td></tr></tbody></table>' +
          '<div class="callout"><b>Nothing is stuck without a reason.</b> Every state says what it is waiting for, and who can move it.</div><div style="display:flex;gap:10px">' + btn("Finish the tour", 5, "Done") + "</div>"); },
        note: { title: "Chasing, replaced by reading", body: "<p>This is the screen that replaces the email thread. Each row's state comes from the engine's own graph, and the reason is plain.</p><ul><li>CD_INSUFFICIENT can go back to CD_CHECK_INITIATED once money arrives.</li><li>Read service builds this from events.</li></ul><span class='chip acid'>read-service</span>" } },
      { name: "That's the tour", solo: true, html: function () { return '<div class="app solo"><div class="login"><div class="box" style="width:520px"><div class="mono acid" style="margin-bottom:14px">END OF DEMO</div><h2>Now try the real rules.</h2><div class="sub" style="color:var(--muted);margin:0 0 22px;line-height:1.6">What you just clicked through is a prototype, but its numbers weren\'t typed in: the column matching, the file checking and the cost came from the same logic the platform runs.</div><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btnx" href="explore.html" style="text-decoration:none">Explore the rules →</a><a class="btnx ghost" href="reference.html" style="text-decoration:none">Read the reference</a><span class="btnx ghost" data-go="hr" data-tag="Replay HR story">Replay HR story</span></div></div></div></div>'; },
        note: { title: "What this demo is not", body: "<p>It is a click-through of real screens' worth of behaviour, not the production portal. TPA and insurer connections, e-cards, payments and SMS are not live. See <b>Reference</b> for the honest list.</p>" } }
    ] }
  };

  /* ── the player ───────────────────────────────────────────────────────────────────────────────────────────────────────────── */
  var frame = $("frame"), wrap = $("frame-wrap"), layers = $("layers"), pos = $("pos"), nT = $("n-title"), nB = $("n-body");
  var flowKey = "hr", idx = 0, seen = {}, done = {}, hint = false, history = [], cursor = document.createElement("div");
  cursor.className = "cursor"; cursor.setAttribute("aria-hidden", "true");
  function screens() { return FLOWS[flowKey].screens; }
  function indexOf(t) { var L = screens(); if (/^\d+$/.test(String(t))) return Math.max(0, Math.min(L.length - 1, +t)); for (var i = 0; i < L.length; i++) if (L[i].id === t) return i; return -1; }
  function rehot() { frame.querySelectorAll(".hs").forEach(function (b) { b.remove(); });
    frame.querySelectorAll("[data-go]").forEach(function (el) { if (el.closest("[hidden]")) return; var fr = frame.getBoundingClientRect(), r = el.getBoundingClientRect(), sc = fr.width / frame.offsetWidth || 1;
      var b = document.createElement("button"); b.type = "button"; b.className = "hs"; b.setAttribute("aria-label", el.getAttribute("data-tag") || "Continue");
      b.style.left = (r.left - fr.left) / sc + "px"; b.style.top = (r.top - fr.top) / sc + "px"; b.style.width = r.width / sc + "px"; b.style.height = r.height / sc + "px";
      b.innerHTML = '<span class="tag">' + esc(el.getAttribute("data-tag") || "Continue") + "</span>"; b.dataset.go = el.getAttribute("data-go"); if (el.getAttribute("data-path")) b.dataset.path = el.getAttribute("data-path");
      b.addEventListener("click", function (e) { e.stopPropagation(); go(b.dataset.go, b, b.dataset.path); }); frame.append(b); }); }
  function go(target, from, path) {
    function jump() { if (path) S.path = path;
      if (target === "hr" || target === "broker") { flowKey = target; idx = 0; history = []; }
      else { var i = indexOf(target); if (i < 0) return; history.push(idx); idx = i; }
      render(); }
    if (from && !reduced) { cursor.style.left = from.offsetLeft + from.offsetWidth / 2 + "px"; cursor.style.top = from.offsetTop + from.offsetHeight / 2 + "px"; cursor.classList.remove("click"); void cursor.offsetWidth; cursor.classList.add("click"); setTimeout(jump, 260); } else jump(); }
  function render() {
    var F = FLOWS[flowKey], S0 = F.screens[idx];
    if (done.timer) { clearInterval(done.timer); done.timer = null; }
    frame.innerHTML = S0.html(); frame.append(cursor); frame.classList.toggle("hint", hint);
    seen[flowKey + idx] = true;
    requestAnimationFrame(function () { rehot(); var first = frame.querySelector(".hs"); if (first) { cursor.style.left = first.offsetLeft - 60 + "px"; cursor.style.top = first.offsetTop + first.offsetHeight + 30 + "px"; requestAnimationFrame(function () { cursor.style.left = first.offsetLeft + first.offsetWidth / 2 + "px"; cursor.style.top = first.offsetTop + first.offsetHeight / 2 + "px"; }); } else { cursor.style.left = "-40px"; } });
    if (S0.enter) S0.enter(frame, done);
    nT.textContent = S0.note.title; nB.innerHTML = S0.note.body;
    var onPath = F.screens.filter(function (s) { return !s.grp || s.grp === S.path || (s.grp === "own" && S.path === "file"); });
    pos.textContent = flowKey === "hr" ? "step " + (onPath.indexOf(S0) + 1 || "–") + " of " + onPath.length : (idx + 1) + " / " + F.screens.length;
    document.querySelectorAll(".flows button").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.flow === flowKey)); });
    layers.textContent = "";
    var lastGrp = null;
    F.screens.forEach(function (s, i) { if (s.grp !== lastGrp && s.grp) { var h = document.createElement("li"); h.className = "grp"; h.textContent = { grid: "Up to " + GRID_MAX + ": the grid", file: "Over " + GRID_MAX + ": the spreadsheet", own: "Your own file" }[s.grp]; layers.append(h); } lastGrp = s.grp || null;
      var li = document.createElement("li"); if (s.grp) li.className = "in"; if (seen[flowKey + i] && i !== idx) li.className += " seen"; var b = document.createElement("button"); b.type = "button"; b.textContent = s.name; if (i === idx) b.setAttribute("aria-current", "step");
      b.addEventListener("click", function () { if (s.grp && s.grp !== "own") S.path = s.grp; history.push(idx); idx = i; render(); }); li.append(b); layers.append(li); });
    $("prev").disabled = !history.length && idx === 0; $("next").disabled = S0.next === null || (S0.next === undefined && idx === F.screens.length - 1);
    try { history_.replaceState(null, "", "#" + flowKey + "/" + (S0.id || (idx + 1))); } catch (e) {}
  }
  var history_ = window.history;
  function fit() { var w = wrap.clientWidth - 36, hgt = wrap.clientHeight - 36, s = Math.min(w / 1100, hgt / 680, 1.25); if (!isFinite(s) || s <= 0) s = 1; frame.style.transform = "translate(-50%,-50%) scale(" + s + ")"; setTimeout(rehot, 0); }
  function step(dir) { var S0 = screens()[idx];
    if (dir > 0) { var t = S0.next !== undefined ? S0.next : idx + 1; if (t === null || t === undefined) return; var i = typeof t === "number" ? t : indexOf(t); if (i < 0 || i >= screens().length) return; if (S0.grp && S0.grp !== "own") S.path = S0.grp; history.push(idx); idx = i; render(); }
    else if (history.length) { idx = history.pop(); render(); } else if (idx > 0) { idx--; render(); } }
  document.querySelectorAll(".flows button").forEach(function (b) { b.addEventListener("click", function () { flowKey = b.dataset.flow; idx = 0; history = []; render(); }); });
  $("prev").addEventListener("click", function () { step(-1); }); $("next").addEventListener("click", function () { step(1); });
  $("restart").addEventListener("click", function () { idx = 0; history = []; seen = {}; S.path = "grid"; render(); });
  $("hint").addEventListener("click", function () { hint = !hint; $("hint").setAttribute("aria-pressed", String(hint)); frame.classList.toggle("hint", hint); });
  frame.addEventListener("click", function () { if (!hint) { frame.classList.add("hint"); setTimeout(function () { if (!hint) frame.classList.remove("hint"); }, 900); } });
  document.addEventListener("keydown", function (e) { if (e.target.closest && e.target.closest("input,textarea")) return; if (e.key === "ArrowRight") $("next").click(); else if (e.key === "ArrowLeft") $("prev").click(); });
  addEventListener("resize", fit);
  var m = /^#(hr|broker)\/([A-Za-z0-9_-]+)$/.exec(location.hash); if (m) { flowKey = m[1]; var i0 = indexOf(/^\d+$/.test(m[2]) ? String(+m[2] - 1) : m[2]); if (i0 >= 0) idx = i0; var gp = screens()[idx].grp; if (gp && gp !== "own") S.path = gp; }
  render(); fit(); setTimeout(fit, 300);
})();
