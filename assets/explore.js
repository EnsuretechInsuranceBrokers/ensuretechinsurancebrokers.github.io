/* The tools on explore.html. All logic is in assets/engine.js (ports of the platform's own rules, checked against it); this file is the interface. */
(function () {
  "use strict";
  var E = ET, Dec = E.Dec, D = E.D, DATA = ETDATA;

  /* ── small helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────── */
  function h(tag, attrs) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (k) { var v = attrs[k];
      if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, ""); else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v); });
    (function add(list) { list.forEach(function (c) { if (Array.isArray(c)) add(c); else if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); }); })(kids);
    return e;
  }
  var $ = function (id) { return document.getElementById(id); };
  function group(s) { var neg = s[0] === "-"; if (neg) s = s.slice(1); var p = s.split("."), i = p[0], last3 = i.slice(-3), rest = i.slice(0, -3);
    if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ","); return (neg ? "-" : "") + (rest ? rest + "," : "") + last3 + (p[1] !== undefined ? "." + p[1] : ""); }
  var inr = function (d, dp) { var s = Dec.str(d, dp === undefined ? 2 : dp); return (s[0] === "-" ? "−₹" : "₹") + group(s.replace("-", "")); };
  var pct = function (f6) { return (Dec.num(f6) * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "") + "%"; };
  var debounce = function (f, ms) { var t; return function () { clearTimeout(t); t = setTimeout(f, ms || 80); }; };
  function field(label, input, cls) { return h("label", { class: "f " + (cls || "") }, label, input); }
  function sel(options, value, onchange, attrs) { var s = h("select", attrs || {}, options.map(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return h("option", { value: v, selected: String(v) === String(value) }, t); })); s.addEventListener("change", function () { onchange(s.value); }); return s; }
  function inp(type, value, oninput, attrs) { var i = h("input", Object.assign({ type: type, value: value === null || value === undefined ? "" : value }, attrs || {})); i.addEventListener("input", function () { oninput(i.value); }); return i; }
  function chk(label, checked, onchange) { var c = h("input", { type: "checkbox", checked: !!checked }); c.addEventListener("change", function () { onchange(c.checked); }); return h("label", { class: "chk" }, c, label); }
  var REL_OPTIONS = E.RELATION_TYPES.map(function (r) { return [r.code, r.code.replace(/_/g, " ").toLowerCase()]; });
  var today = new Date().toISOString().slice(0, 10);

  /* An editable list of rows. columns: [{key,label,kind:'rel'|'date'|'text'|'num'|'sel',options,width,placeholder}] */
  function rowsEditor(host, rows, columns, onchange, blankRow, addLabel) {
    function render() {
      host.textContent = "";
      var tpl = columns.map(function (c) { return (c.width || "1fr"); }).join(" ") + " 38px";
      rows.forEach(function (row, i) {
        var line = h("div", { class: "rowline", style: "grid-template-columns:" + tpl });
        columns.forEach(function (c) {
          var el;
          if (c.kind === "rel") el = sel(REL_OPTIONS, row[c.key], function (v) { row[c.key] = v; onchange(); });
          else if (c.kind === "sel") el = sel(c.options, row[c.key], function (v) { row[c.key] = v; onchange(); });
          else el = inp(c.kind === "date" ? "date" : c.kind === "num" ? "number" : "text", row[c.key], function (v) { row[c.key] = v; onchange(); }, { placeholder: c.placeholder || "", step: c.step, min: c.min });
          line.append(h("label", { class: "f" }, i === 0 ? c.label : h("span", { class: "mut", style: "display:none" }, c.label), el));
        });
        line.append(h("button", { class: "btn x", type: "button", "aria-label": "Remove", title: "Remove", onclick: function () { rows.splice(i, 1); render(); onchange(); } }, "×"));
        host.append(line);
      });
      host.append(h("div", null, h("button", { class: "btn sm", type: "button", onclick: function () { rows.push(blankRow()); render(); onchange(); } }, "+ " + (addLabel || "Add"))));
    }
    render(); return render;
  }
  function presetBar(host, presets, apply) {
    var bar = h("div", { class: "presets", role: "group", "aria-label": "Examples" });
    presets.forEach(function (p) { bar.append(h("button", { class: "btn sm", type: "button", "aria-pressed": "false", onclick: function () { bar.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); this.setAttribute("aria-pressed", "true"); apply(p); } }, p.name)); });
    host.append(bar); return bar;
  }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* ═══ 01 — what will this endorsement cost ═══════════════════════════════════════════════════════════════════════════════════ */
  (function priceTool() {
    var host = $("t-price"); if (!host) return;
    var S, out = h("div", { "aria-live": "polite" }), tableBox, planBox, renderExisting, renderRows;
    var PRESETS = [
      { name: "A family joins mid-year", s: { start: "2030-04-01", end: "2031-03-31", proRata: "DAILY", inception: false, rounding: "NONE", unit: 10, type: "FLAT", tax: 18, plan: { type: "NONE", groups: {} }, op: "ADD", eff: "2030-07-01",
          existing: [], rows: [{ relation: "SELF", dob: "1985-01-01" }, { relation: "SPOUSE", dob: "1983-02-02" }, { relation: "SON", dob: "2015-01-01" }] } },
      { name: "A spouse leaves: refund", s: { start: "2030-04-01", end: "2031-03-31", proRata: "DAILY", inception: false, rounding: "NONE", unit: 10, type: "FLAT", tax: 18, plan: { type: "NONE", groups: {} }, op: "REMOVE", eff: "2030-09-30",
          existing: [{ relation: "SELF", dob: "1985-01-01" }, { relation: "SPOUSE", dob: "1983-02-02" }], rows: [{ relation: "SPOUSE" }] } },
      { name: "Second parent joins", s: { start: "2030-04-01", end: "2031-03-31", proRata: "NONE", inception: false, rounding: "NONE", unit: 10, type: "FLAT", tax: 18, plan: { type: "FIXED", groups: { PARENT_SINGLE: "400", PARENT_DOUBLE: "700" } }, op: "ADD", eff: "2030-04-01",
          existing: [{ relation: "SELF", dob: "1985-01-01" }, { relation: "FATHER", dob: "1955-01-01" }], rows: [{ relation: "MOTHER", dob: "1957-01-01" }] } },
      { name: "Rounded up, split by percent", s: { start: "2030-04-01", end: "2031-03-31", proRata: "DAILY", inception: false, rounding: "CEIL", unit: 10, type: "FLAT", tax: 18, plan: { type: "PERCENT", groups: { SELF: "0", SPOUSE: "50", CHILD: "50" } }, op: "ADD", eff: "2030-07-15",
          existing: [], rows: [{ relation: "SELF", dob: "1985-01-01" }, { relation: "SPOUSE", dob: "1983-02-02" }, { relation: "SON", dob: "2015-01-01" }] } },
      { name: "Age-banded, monthly pro-rata", s: { start: "2030-04-01", end: "2031-03-31", proRata: "MONTHLY", inception: false, rounding: "NONE", unit: 10, type: "AGE_BAND", tax: 18, plan: { type: "NONE", groups: {} }, op: "ADD", eff: "2030-10-12",
          existing: [{ relation: "SELF", dob: "1990-01-01" }], rows: [{ relation: "FATHER", dob: "1962-05-05" }] } },
    ];
    function load(p) { S = clone(p.s); S.table = JSON.stringify(E.PREMIUM_TYPES[S.type].table, null, 1); build(); compute(); }
    var HEAD_COLS = [{ key: "relation", label: "Relation", kind: "rel", width: "1.3fr" }, { key: "dob", label: "Date of birth", kind: "date", width: "1.2fr" }, { key: "grade", label: "Grade", kind: "text", width: ".6fr" }, { key: "sumInsured", label: "Sum insured", kind: "num", width: "1fr" }];
    function build() {
      var left = $("price-left"); left.textContent = "";
      var c = compute;
      left.append(
        h("div", { class: "grp" }, "The policy"),
        h("div", { class: "fields" },
          field("Starts", inp("date", S.start, function (v) { S.start = v; c(); })), field("Ends", inp("date", S.end, function (v) { S.end = v; c(); })),
          field("Pro-rata", sel(["DAILY", "MONTHLY", "NONE"], S.proRata, function (v) { S.proRata = v; c(); })),
          field("Rounding", sel([["NONE", "none (paise)"], ["FLOOR", "floor"], ["CEIL", "ceiling"], ["ROUND", "nearest"]], S.rounding, function (v) { S.rounding = v; c(); })),
          field("Round to ₹", inp("number", S.unit, function (v) { S.unit = v; c(); }, { min: 1 })), field("Tax %", inp("number", S.tax, function (v) { S.tax = v; c(); }, { step: "0.5", min: 0 })),
          h("div", { style: "grid-column:1/-1" }, chk("The policy is still in its inception window (nobody is a late joiner)", S.inception, function (v) { S.inception = v; c(); }))),
        h("div", { class: "grp" }, "Premium type and rate card"),
        h("div", { class: "fields", style: "grid-template-columns:1fr" }, field("Premium type", sel(Object.keys(E.PREMIUM_TYPES).map(function (k) { return [k, E.PREMIUM_TYPES[k].name]; }), S.type, function (v) { S.type = v; S.table = JSON.stringify(E.PREMIUM_TYPES[v].table, null, 1); tableBox.value = S.table; c(); })),
          field("Rate table (JSON, as the policy stores it)", (tableBox = h("textarea", { rows: 4, spellcheck: "false" }, S.table)))),
        h("div", { class: "grp" }, "Who pays"),
        h("div", { class: "fields" }, field("Contribution plan", sel([["NONE", "no split"], ["PERCENT", "employee pays a percent"], ["FIXED", "employee pays a fixed amount"]], S.plan.type, function (v) { S.plan.type = v; drawPlan(); c(); }))),
        (planBox = h("div", { class: "fields", style: "margin-top:12px" })),
        h("div", { class: "grp" }, "The endorsement"),
        h("div", { class: "fields" }, field("Operation", sel([["ADD", "add people"], ["REMOVE", "remove people"], ["UPDATE", "change details"]], S.op, function (v) { S.op = v; c(); })),
          field(S.op === "REMOVE" ? "Last day of cover" : "Effective date", inp("date", S.eff, function (v) { S.eff = v; c(); }))),
        h("div", { class: "grp" }, "Already covered under this employee"), h("div", { class: "rows", id: "price-existing" }),
        h("div", { class: "grp" }, S.op === "ADD" ? "People being added" : S.op === "REMOVE" ? "People being removed (by relation)" : "People being changed (by relation)"), h("div", { class: "rows", id: "price-rows" }));
      tableBox.addEventListener("input", debounce(function () { S.table = tableBox.value; c(); }));
      drawPlan();
      renderExisting = rowsEditor($("price-existing"), S.existing, HEAD_COLS.concat([{ key: "coverStart", label: "Cover since", kind: "date", width: "1.2fr" }]), c, function () { return { relation: "SPOUSE", dob: "1985-01-01" }; }, "Add a covered person");
      renderRows = rowsEditor($("price-rows"), S.rows, S.op === "ADD" ? HEAD_COLS : [{ key: "relation", label: "Relation", kind: "rel", width: "1.3fr" }], c, function () { return { relation: "SPOUSE", dob: "1985-01-01" }; }, "Add a person");
    }
    function drawPlan() {
      planBox.textContent = "";
      if (S.plan.type === "NONE") { planBox.append(h("div", { class: "mut", style: "grid-column:1/-1;font-size:13px" }, "No contribution plan: nobody has said who pays, so the amount is not split.")); return; }
      ["SELF", "SPOUSE", "CHILD", "PARENT_SINGLE", "PARENT_DOUBLE", "PARENT_IN_LAW_SINGLE", "PARENT_IN_LAW_DOUBLE", "OTHERS"].forEach(function (g) {
        planBox.append(field(g.replace(/_/g, " ").toLowerCase() + (S.plan.type === "PERCENT" ? " (%)" : " (₹)"), inp("number", S.plan.groups[g] === undefined ? "" : S.plan.groups[g], function (v) { if (v === "") delete S.plan.groups[g]; else S.plan.groups[g] = v; compute(); }, { min: 0 })));
      });
    }
    function people(list, withCover) { return list.map(function (m) { return { relation: m.relation, dob: m.dob, grade: m.grade, designation: m.designation, sumInsured: m.sumInsured === "" ? null : m.sumInsured, coverStart: m.coverStart || null }; }); }
    function compute() {
      out.textContent = "";
      var res;
      try {
        var table; try { table = JSON.parse(S.table); } catch (e) { throw new E.RatingError("the rate table is not valid JSON: " + e.message); }
        if (!E.validIso(S.start) || !E.validIso(S.end) || !E.validIso(S.eff)) throw new E.RatingError("check the dates");
        if (S.op !== "REMOVE" && S.rows.some(function (r) { return !E.validIso(r.dob || ""); })) throw new E.RatingError("every person being added needs a date of birth");
        if (S.existing.some(function (r) { return !E.validIso(r.dob || ""); })) throw new E.RatingError("everyone already covered needs a date of birth");
        res = E.priceFamily({ op: S.op, eff: S.eff, rate: { type: S.type, table: table, tax: S.tax }, existing: people(S.existing), rows: people(S.rows),
          policy: { start: S.start, end: S.end, proRata: S.proRata, inception: S.inception, rounding: S.rounding, roundingUnit: +S.unit || 1, contribution: S.plan.type === "NONE" ? null : S.plan } });
      } catch (e) { out.append(h("div", { class: "note bad" }, h("b", null, "Can't price this: "), e.message)); mount(); return; }
      var neg = res.charged < 0n;
      out.append(
        h("div", { class: "mono acid" }, neg ? "REFUND FOR THIS ENDORSEMENT" : "CHARGED FOR THIS ENDORSEMENT"),
        h("div", { class: "big " + (neg ? "neg" : "ok"), style: "margin:10px 0" }, inr(res.charged)),
        h("div", { class: "facts" },
          h("div", null, h("small", null, "Tax (" + Dec.str(res.taxRate, 2).replace(/\.00$/, "") + "%)"), inr(res.tax)), h("div", null, h("small", null, "Total"), inr(res.total)),
          h("div", null, h("small", null, "Annual premium before → after"), inr(res.before, 0) + " → " + inr(res.after, 0)),
          res.employee === null ? h("div", null, h("small", null, "Who pays"), "no plan, not split") : h("div", null, h("small", null, "Employee / employer"), inr(res.employee) + " / " + inr(res.employer))),
        h("div", { class: "scroll" }, h("table", { class: "tbl" }, h("thead", null, h("tr", null, ["Person", "Pro-rata", "Change in annual premium", "Share of year", "Amount"].map(function (t, i) { return h("th", { class: i > 1 ? "r" : "" }, t); }))),
          h("tbody", null, res.lines.length ? res.lines.map(function (l) { return h("tr", { class: l.amount < 0n ? "hl" : "" }, h("td", null, l.relation.replace(/_/g, " ").toLowerCase(), h("div", { class: "mut", style: "font-size:12px" }, l.how)), h("td", null, l.kind.toLowerCase()), h("td", { class: "r" }, inr(l.delta)), h("td", { class: "r" }, pct(l.factor)), h("td", { class: "r" }, inr(l.amount, 4))); })
            : h("tr", null, h("td", { colspan: 5, class: "mut" }, "Nobody's premium changes.")))))
      );
      var steps = [];
      steps.push("Before this endorsement the annual premium is <b>" + inr(res.before) + "</b>; after it, <b>" + inr(res.after) + "</b>.");
      res.lines.forEach(function (l) { steps.push("<b>" + l.relation.replace(/_/g, " ").toLowerCase() + "</b>: annual premium changes by " + inr(l.delta) + ". Pro-rata is " + l.kind.toLowerCase() + ", so " + (l.factor === 0n ? "none of the year applies" : "<b>" + pct(l.factor) + "</b> of it applies (" + l.how + ")") + ": <b>" + inr(l.amount, 4) + "</b>."); });
      steps.push("The changes add up to " + inr(res.rawBeforeRounding, 4) + "." + (S.rounding === "NONE" ? " With no rounding rule it is kept to the paise: <b>" + inr(res.charged) + "</b>." : " The policy rounds (" + ({ FLOOR: "down", CEIL: "up", ROUND: "to the nearest" })[S.rounding] + " ₹" + S.unit + "), giving <b>" + inr(res.charged) + "</b>."));
      steps.push("Tax at " + Dec.str(res.taxRate, 2).replace(/\.00$/, "") + "% is charged on the rounded amount: <b>" + inr(res.tax) + "</b>, for a total of <b>" + inr(res.total) + "</b>.");
      if (res.employee !== null) steps.push("The contribution plan splits the " + inr(res.charged) + ": the employee's part is <b>" + inr(res.employee) + "</b> and the employer's <b>" + inr(res.employer) + "</b>. Rounding cannot make either side pay more than the whole.");
      out.append(h("ol", { class: "explain", html: steps.map(function (s) { return "<li><span>" + s + "</span></li>"; }).join("") }));
      mount();
    }
    function mount() { var r = $("price-right"); r.textContent = ""; r.append(out); }
    host.append(h("div", { class: "cols" }, h("div", null, (function () { var w = h("div"); presetBar(w, PRESETS, load); w.append(h("div", { id: "price-left" })); return w; })()), h("div", { id: "price-right" })));
    load(PRESETS[0]); document.querySelector("#t-price .presets button").setAttribute("aria-pressed", "true");
  })();

  /* ═══ 02 — premium types side by side ════════════════════════════════════════════════════════════════════════════════════════ */
  (function typesTool() {
    var host = $("t-types"); if (!host) return;
    var fam = [{ relation: "SELF", age: 40, grade: "A", sumInsured: "500000" }, { relation: "SPOUSE", age: 38, grade: "", sumInsured: "500000" }, { relation: "SON", age: 10, grade: "", sumInsured: "500000" }];
    var tax = 18, out = h("div"), rows = h("div", { class: "rows" });
    var FAMS = [
      { name: "Employee, spouse, child", f: [["SELF", 40, "A"], ["SPOUSE", 38, ""], ["SON", 10, ""]] }, { name: "Employee alone", f: [["SELF", 29, "B"]] },
      { name: "Employee and two parents", f: [["SELF", 45, "A"], ["FATHER", 72, ""], ["MOTHER", 68, ""]] }, { name: "Large family (5)", f: [["SELF", 41, "A"], ["SPOUSE", 39, ""], ["SON", 14, ""], ["DAUGHTER", 11, ""], ["MOTHER", 66, ""]] },
      { name: "Age not in any band (104)", f: [["SELF", 104, "A"]] }, { name: "Unknown grade", f: [["SELF", 40, "Z"], ["SPOUSE", 38, ""]] } ];
    function setFam(f) { fam.length = 0; f.forEach(function (x) { fam.push({ relation: x[0], age: x[1], grade: x[2], sumInsured: "500000" }); }); renderRows(); compute(); }
    var renderRows = rowsEditor(rows, fam, [{ key: "relation", label: "Relation", kind: "rel", width: "1.4fr" }, { key: "age", label: "Age", kind: "num", width: ".7fr", min: 0 }, { key: "grade", label: "Grade", kind: "text", width: ".7fr" }, { key: "sumInsured", label: "Sum insured", kind: "num", width: "1fr" }], function () { compute(); }, function () { return { relation: "SON", age: 8, grade: "", sumInsured: "500000" }; }, "Add a person");
    function compute() {
      out.textContent = "";
      var members = fam.map(function (m, i) { return { ref: "p" + i, relation: m.relation, age: +m.age || 0, grade: m.grade || null, designation: null, sumInsured: m.sumInsured === "" ? null : D(m.sumInsured) }; });
      var body = Object.keys(E.PREMIUM_TYPES).map(function (code) {
        var t = E.PREMIUM_TYPES[code], cells;
        try { var q = E.quote(code, t.table, tax, members); cells = [h("td", { class: "r" }, inr(q.subtotal)), h("td", { class: "r" }, inr(q.total)), h("td", null, members.map(function (m, i) { return q.byRef["p" + i] === 0n ? null : h("span", { class: "chip", style: "margin:0 4px 4px 0" }, m.relation.toLowerCase().replace(/_/g, " ") + " " + inr(q.byRef["p" + i], 0)); }))]; }
        catch (e) { cells = [h("td", { colspan: 3 }, h("span", { class: "chip bad" }, "refused"), " ", h("span", { class: "mut" }, e.message))]; }
        return h("tr", null, h("td", null, h("b", null, t.name), h("div", { class: "mono mut", style: "margin-top:4px" }, code + (t.familyUnit ? " · one premium per family" : ""))), h("td", null, h("code", { class: "mut" }, JSON.stringify(t.table).slice(0, 78))), cells);
      });
      out.append(h("div", { class: "panel scroll" }, h("table", { class: "tbl" }, h("thead", null, h("tr", null, ["Premium type", "Rate card used", "Premium", "With tax", "Who it charges"].map(function (t, i) { return h("th", { class: i === 2 || i === 3 ? "r" : "" }, t); }))), h("tbody", null, body))));
    }
    var bar = h("div", { class: "presets" }, FAMS.map(function (f) { return h("button", { class: "btn sm", type: "button", onclick: function () { setFam(f.f); } }, f.name); }));
    host.append(h("div", { class: "cols", style: "grid-template-columns:.7fr 1.5fr" }, h("div", null, bar, rows, h("div", { class: "fields", style: "margin-top:16px" }, field("Tax %", inp("number", tax, function (v) { tax = +v || 0; compute(); }, { min: 0, step: "0.5" }))),
      h("div", { class: "note", style: "margin-top:18px" }, "Every premium here is annual and before pro-rata. Dependants inherit the employee's grade. A family-unit type charges once, on the employee's row.")), out));
    compute();
  })();

  /* ═══ 03 — will this file pass ═══════════════════════════════════════════════════════════════════════════════════════════════ */
  function parseCsv(text) {
    var rows = [], row = [], cell = "", q = false, i = 0;
    for (; i < text.length; i++) { var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row); row = []; }
      else cell += c; }
    row.push(cell); if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
    return rows;
  }
  (function fileTool() {
    var host = $("t-file"); if (!host) return;
    var SAMPLE = 'Emp Code,Relationship,Member Name,DOB,Gender,Sum Insured,Effective Date,PAN\n1001,Self,Asha Rao,17/05/1985,F,"₹ 5,00,000",,ABCDE1234F\n1001,Wife,Ravi Rao,02-Feb-1983,Male,500000,,\n1001,SON-II,Kid Rao,01/01/2015,M,500000,,\n1002,Self,Meera Nair,1990-03-03,Female,"Rs. 3,00,000",,PQRST5678K\n1002,Cousin,Odd Person,01/01/2000,M,100000,,\n1003,Self,Raj Shah,not-a-date,M,400000,,BAD\n1003,Self,Raj Shah,07/07/1980,M,-5,,ABCDE1234F\n';
    var S = { csv: SAMPLE, op: "ADD", today: "2026-10-09", src: "", dflt: "2030-04-01", basis: "DATE_OF_JOINING", pstart: "2030-04-01", inception: false, construct: true, roster: "" };
    var out = h("div", { "aria-live": "polite" }), ta;
    var CONSTRUCT = { allowedRelations: [2, 5, 9], maxMembers: 6, maxChildren: 3, maxParents: null, ageMin: null, ageMax: null };
    function compute() {
      out.textContent = "";
      var table = parseCsv(S.csv); if (table.length < 1) { out.append(h("div", { class: "note" }, "Paste a CSV with a header row.")); return; }
      var headers = table[0], sug = E.suggestMapping(headers), mapped = sug.filter(function (s) { return s.field; }).map(function (s) { return s.field; });
      var miss = E.missingRequired(mapped, S.op), auto = E.isAutoConfirmable(sug, S.op);
      out.append(h("div", { class: "grp" }, "1 · How the platform reads your column names"),
        h("div", { class: "scroll" }, h("table", { class: "tbl" }, h("thead", null, h("tr", null, ["Your column", "Our field", "Confidence"].map(function (t) { return h("th", null, t); }))),
          h("tbody", null, sug.map(function (s) { return h("tr", null, h("td", null, s.header), h("td", null, s.field ? h("code", { class: "acid" }, s.field) : h("span", { class: "chip bad" }, "not recognised")), h("td", null, h("span", { class: "chip " + (s.confidence >= 0.9 ? "ok" : s.field ? "warn" : "") }, s.confidence.toFixed(2)))); })))),
        miss.length ? h("div", { class: "note bad" }, h("b", null, "Can't continue: "), "no column matches " + miss.join(", ") + ", which " + S.op + " needs.") : h("div", { class: "note" }, auto ? "Every column is a confident match, so the platform would accept this mapping without asking anyone." : "Some matches are less than certain. The platform would show this mapping to the uploader to confirm (and remember it) before going on."));
      if (miss.length) return;
      var roster = S.roster.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { var p = l.split(",").map(function (x) { return x.trim(); }); return { employee_code: p[0], relation_code: (p[1] || "").toUpperCase(), dob: p[2] || "1985-01-01" }; });
      var rows = table.slice(1).map(function (cells) { var raw = {}; sug.forEach(function (s, i) { if (s.field && !/^(emp|mem)_/.test(s.field)) raw[s.field] = cells[i] === undefined ? "" : cells[i]; }); if (!String(raw.effective_date || "").trim() && raw.date_of_joining) raw.effective_date = raw.date_of_joining; return raw; });
      var r;
      try { r = E.validateFile(rows, { op: S.op, today: S.today, sourceKey: S.src, defaultEffectiveDate: S.dflt || null, midtermBasis: S.basis, policyStart: S.pstart, inception: S.inception, roster: roster, construct: S.construct ? CONSTRUCT : null, rules: {} }); }
      catch (e) { out.append(h("div", { class: "note bad" }, "Could not read the file: " + e.message)); return; }
      var bad = {}; r.issues.forEach(function (i) { if (i.severity === "ERROR") bad[i.row] = true; });
      var failed = Object.keys(bad).length, total = rows.length, outcome = failed === 0 ? "VALIDATION_PASSED" : failed >= total ? "VALIDATION_FAILED" : "VALIDATION_PARTIAL";
      var byRule = {}; r.issues.filter(function (i) { return i.severity === "ERROR"; }).forEach(function (i) { byRule[i.rule] = (byRule[i.rule] || 0) + 1; });
      out.append(h("div", { class: "grp" }, "2 · What happens to the file"),
        h("div", { class: "big " + (failed === 0 ? "ok" : failed >= total ? "bad" : ""), style: "font-size:clamp(24px,3vw,38px)" }, outcome.replace(/_/g, " ")),
        h("p", { class: "mut" }, total + " line(s) read, " + failed + " with at least one error" + (outcome === "VALIDATION_PARTIAL" ? ". HR can proceed with the " + (total - failed) + " good line(s), or fix the rest and re-upload them." : outcome === "VALIDATION_FAILED" ? ". Nothing can proceed until the file is fixed." : ". Pricing starts straight away.")),
        Object.keys(byRule).length ? h("div", { class: "chips", style: "margin-bottom:14px" }, Object.keys(byRule).map(function (k) { return h("span", { class: "chip bad" }, k + " × " + byRule[k]); })) : null,
        h("div", { class: "grp" }, "3 · Line by line, as the platform understood it"),
        h("div", { class: "scroll panel" }, h("table", { class: "tbl" }, h("thead", null, h("tr", null, ["Line", "Employee", "Relation", "Name", "Born", "Gender", "Sum insured", "Starts", "Problems"].map(function (t) { return h("th", null, t); }))),
          h("tbody", null, r.rows.map(function (n, i) { var iss = r.issues.filter(function (x) { return x.row === i; });
            return h("tr", { class: bad[i] ? "bad" : "" }, h("td", null, i + 2), h("td", null, n.employee_code || "—"), h("td", null, n.relation_code ? n.relation_code.toLowerCase().replace(/_/g, " ") : "—"), h("td", null, [n.first_name, n.last_name].filter(Boolean).join(" ") || "—"), h("td", null, n.dob || "—"), h("td", null, n.gender || "—"), h("td", { class: "r" }, n.sum_insured ? group(n.sum_insured) : "—"), h("td", null, n.effective_date || "—"),
              h("td", null, iss.length ? iss.map(function (x) { return h("div", { style: "margin-bottom:5px" }, h("span", { class: "chip " + (x.severity === "ERROR" ? "bad" : "warn") }, x.rule), " ", h("span", { class: "mut", style: "font-size:13px" }, x.message)); }) : h("span", { class: "chip ok" }, "ok"))); })))));
    }
    var left = h("div", null,
      h("div", { class: "presets" }, [["Messy sample", SAMPLE], ["Clean file", 'Employee ID,Relation,First Name,Last Name,Date of Birth,Sex,SI\n501,Self,Anil,Kumar,1988-02-14,M,500000\n501,Spouse,Sunita,Kumar,1990-07-01,F,500000\n501,Daughter,Tara,Kumar,2016-09-09,F,500000\n'], ["Wrong columns", 'Name,Mobile,Blood Group\nAsha Rao,9876543210,B+\n'], ["Removal file", 'Emp Code,Relationship,Date of Leaving\n1001,Self,2030-09-30\n1001,Spouse,2030-09-30\n']].map(function (p) { return h("button", { class: "btn sm", type: "button", onclick: function () { S.csv = p[1]; ta.value = p[1]; if (p[0] === "Removal file") { S.op = "REMOVE"; opSel.value = "REMOVE"; S.roster = "1001,SELF,1985-01-01\n1001,SPOUSE,1983-02-02"; rosterTa.value = S.roster; } compute(); } }, p[0]); })),
      field("Paste CSV", (ta = h("textarea", { rows: 9, spellcheck: "false" }, S.csv))),
      h("div", { class: "grp" }, "The upload"),
      h("div", { class: "fields" }, field("Operation", (function () { return (window._opSel = sel([["ADD", "add people"], ["REMOVE", "remove people"], ["UPDATE", "change details"]], S.op, function (v) { S.op = v; compute(); })); })()), field("Today", inp("date", S.today, function (v) { S.today = v; compute(); })),
        field("File from (column dialect)", sel([["", "generic"], ["CARE", "Care"], ["MEDIASSIST", "MediAssist"], ["FHPL", "FHPL"]], S.src, function (v) { S.src = v; compute(); })), field("Default effective date", inp("date", S.dflt, function (v) { S.dflt = v; compute(); }))),
      h("div", { class: "grp" }, "The policy"),
      h("div", { class: "fields" }, field("Policy starts", inp("date", S.pstart, function (v) { S.pstart = v; compute(); })), field("Mid-term joiners", sel([["DATE_OF_JOINING", "from date of joining"], ["DATE_OF_UPLOAD", "from date of upload"], ["NO_MIDTERM", "not allowed"]], S.basis, function (v) { S.basis = v; compute(); }))),
      h("div", { style: "margin-top:12px;display:grid;gap:8px" }, chk("Policy is in its inception window", S.inception, function (v) { S.inception = v; compute(); }), chk("Check family rules (spouse, son, daughter allowed; at most 6 people and 3 children)", S.construct, function (v) { S.construct = v; compute(); })),
      field("Already covered (code,relation,date of birth per line)", (window._rosterTa = h("textarea", { rows: 3, spellcheck: "false", placeholder: "1001,SELF,1985-05-17" }, S.roster)), "")
    );
    var opSel = window._opSel, rosterTa = window._rosterTa;
    ta.addEventListener("input", debounce(function () { S.csv = ta.value; compute(); }, 150)); rosterTa.addEventListener("input", debounce(function () { S.roster = rosterTa.value; compute(); }, 150));
    host.append(h("div", { class: "cols", style: "grid-template-columns:.8fr 1.2fr" }, left, out)); compute();
  })();

  /* ═══ 04 — who can be covered ════════════════════════════════════════════════════════════════════════════════════════════════ */
  (function familyTool() {
    var host = $("t-family"); if (!host) return;
    var C, R, F, out = h("div", { "aria-live": "polite" });
    var PRESETS = [
      { name: "A normal family", c: { allowed: [2, 5, 9], maxMembers: 6, maxChildren: 3, maxParents: null, ageMin: null, ageMax: null }, r: [], f: [["SELF", 40], ["SPOUSE", 37], ["SON", 9], ["DAUGHTER", 6]] },
      { name: "Too many children, parent not covered", c: { allowed: [2, 5, 9], maxMembers: 6, maxChildren: 2, maxParents: null, ageMin: null, ageMax: null }, r: [], f: [["SELF", 41], ["SPOUSE", 38], ["SON", 12], ["DAUGHTER", 9], ["DAUGHTER_II", 4], ["FATHER", 70]] },
      { name: "Twins", c: { allowed: [2, 5, 9, 6], maxMembers: 6, maxChildren: 4, maxParents: null, ageMin: null, ageMax: null }, r: [{ relation: "SON", maxTwins: 1 }, { relation: "SON_II", maxTwins: 1 }], f: [["SELF", 36], ["SPOUSE", 34], ["SON", 3, "2027-05-04"], ["SON_II", 3, "2027-05-04"]] },
      { name: "Child too old, age gap too small", c: { allowed: [2, 5, 9], maxMembers: 6, maxChildren: 3, maxParents: null, ageMin: null, ageMax: null }, r: [{ relation: "SON", minAge: 0, maxAge: 25, ageDifference: 18, differenceFromRelation: "SELF" }], f: [["SELF", 33], ["SPOUSE", 31], ["SON", 21], ["DAUGHTER", 27]] },
      { name: "No employee, an adult under 18", c: { allowed: [2, 5, 9], maxMembers: 6, maxChildren: 3, maxParents: null, ageMin: null, ageMax: null }, r: [], f: [["SPOUSE", 16], ["SON", 4]] } ];
    var cbox = h("div"), ruleHost = h("div", { class: "rows" }), famHost = h("div", { class: "rows" }), cfields = h("div");
    function load(p) { C = clone(p.c); R = clone(p.r).map(function (r) { return Object.assign({ minAge: "", maxAge: "", ageDifference: "", differenceFromRelation: "SELF", maxTwins: "" }, r); }); F = p.f.map(function (x) { return { relation: x[0], age: x[1], dob: x[2] || "" }; }); draw(); compute(); }
    function draw() {
      cbox.textContent = "";
      var groups = {}; E.RELATION_TYPES.filter(function (r) { return r.code !== "SELF"; }).forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r); });
      var allowed = h("div", { style: "display:grid;gap:12px" }, Object.keys(groups).map(function (g) { return h("div", null, h("div", { class: "mono mut", style: "margin-bottom:6px" }, g.replace(/_/g, " ")), h("div", { class: "chips" }, groups[g].map(function (r) { var on = C.allowed.indexOf(r.id) >= 0; var b = h("button", { class: "btn sm" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false", onclick: function () { var i = C.allowed.indexOf(r.id); if (i >= 0) C.allowed.splice(i, 1); else C.allowed.push(r.id); draw(); compute(); } }, r.name); return b; }))); }));
      var num = function (k, label) { return field(label, inp("number", C[k] === null ? "" : C[k], function (v) { C[k] = v === "" ? null : +v; compute(); }, { min: 0 })); };
      cbox.append(h("div", { class: "grp" }, "Who may be covered (besides the employee)"), allowed, h("div", { class: "fields", style: "margin-top:16px" }, num("maxMembers", "Max people"), num("maxChildren", "Max children"), num("maxParents", "Max parents / in-laws"), num("ageMin", "Youngest age"), num("ageMax", "Oldest age")),
        h("div", { class: "grp" }, "Rules for particular relations", h("span", { class: "mut", style: "text-transform:none;letter-spacing:0;font:500 12px Manrope" }, "optional")));
      rulesEditor();
      famHost.textContent = "";
      renderFam = rowsEditor(famHost, F, [{ key: "relation", label: "Relation", kind: "rel", width: "1.3fr" }, { key: "age", label: "Age", kind: "num", width: ".6fr", min: 0 }, { key: "dob", label: "Born (for twins)", kind: "date", width: "1.1fr" }], compute, function () { return { relation: "SON", age: 5, dob: "" }; }, "Add a person");
    }
    var renderFam;
    function rulesEditor() {
      ruleHost.textContent = ""; cbox.append(ruleHost);
      rowsEditor(ruleHost, R, [{ key: "relation", label: "Relation", kind: "rel", width: "1.2fr" }, { key: "minAge", label: "Min age", kind: "num", width: ".6fr" }, { key: "maxAge", label: "Max age", kind: "num", width: ".6fr" }, { key: "ageDifference", label: "Gap (yrs)", kind: "num", width: ".6fr" }, { key: "differenceFromRelation", label: "From", kind: "sel", options: ["SELF", "SPOUSE"], width: ".8fr" }, { key: "maxTwins", label: "Twins", kind: "num", width: ".5fr" }], compute, function () { return { relation: "SON", minAge: "", maxAge: "", ageDifference: "", differenceFromRelation: "SELF", maxTwins: "" }; }, "Add a rule");
    }
    function compute() {
      out.textContent = "";
      var rules = {}; R.forEach(function (r) { var n = function (v) { return v === "" || v === null || v === undefined ? null : +v; }; rules[r.relation] = { minAge: n(r.minAge), maxAge: n(r.maxAge), ageDifference: n(r.ageDifference), differenceFromRelation: n(r.ageDifference) === null ? null : r.differenceFromRelation, maxTwins: n(r.maxTwins) === null ? 0 : n(r.maxTwins) }; });
      var construct = { allowedRelations: C.allowed, maxMembers: C.maxMembers === null ? 99 : C.maxMembers, maxChildren: C.maxChildren, maxParents: C.maxParents, ageMin: C.ageMin, ageMax: C.ageMax };
      var people = F.map(function (p) { return { relation: p.relation, age: +p.age || 0, dob: p.dob || null }; });
      var v = E.checkFamily(construct, rules, people);
      var wide = v.filter(function (x) { return x.member < 0; });
      out.append(v.length ? h("div", { class: "big bad", style: "font-size:clamp(26px,3.4vw,44px)" }, v.length + " problem" + (v.length > 1 ? "s" : "")) : h("div", { class: "big ok", style: "font-size:clamp(26px,3.4vw,44px)" }, "This family is valid"),
        wide.length ? h("div", { class: "note bad" }, wide.map(function (x) { return h("div", null, h("span", { class: "chip bad" }, x.code), " ", x.message); })) : null,
        h("div", { class: "panel scroll", style: "margin-top:16px" }, h("table", { class: "tbl" }, h("thead", null, h("tr", null, ["#", "Person", "Age", "Verdict"].map(function (t) { return h("th", null, t); }))),
          h("tbody", null, people.map(function (p, i) { var mine = v.filter(function (x) { return x.member === i; });
            return h("tr", { class: mine.length ? "bad" : "" }, h("td", null, i), h("td", null, p.relation.replace(/_/g, " ").toLowerCase()), h("td", null, p.age), h("td", null, mine.length ? mine.map(function (x) { return h("div", { style: "margin-bottom:5px" }, h("span", { class: "chip bad" }, x.code), " ", h("span", { class: "mut", style: "font-size:13px" }, x.message.replace(/^member \d+: /, ""))); }) : h("span", { class: "chip ok" }, "fine"))); })))),
        h("p", { class: "mut", style: "font-size:13.5px;line-height:1.65;margin-top:14px" }, "Ages are whole years. Twins are only checked for people whose dates of birth you give, and only when the policy has a rule for them. Adults (employee, spouse, parents, in-laws) must be at least 18 unless a rule says otherwise."));
    }
    host.append(h("div", { class: "cols", style: "grid-template-columns:1.1fr 1fr" }, h("div", null, (function () { var w = h("div"); presetBar(w, PRESETS, load); return w; })(), cbox, h("div", { class: "grp" }, "The family"), famHost), out));
    load(PRESETS[0]);
  })();

  /* ═══ 05 — dependants joining after the employee ═════════════════════════════════════════════════════════════════════════════ */
  (function midtermTool() {
    var host = $("t-midterm"); if (!host) return;
    var S = { relation: "SPOUSE", allowed: true, window: "30", basis: "EVENT", event: "2026-09-20", pstart: "2026-04-01", upload: "2026-10-09", today: "2026-10-09" };
    var out = h("div", { "aria-live": "polite" });
    var PRESETS = [{ name: "Recent wedding, from the event", s: { relation: "SPOUSE", allowed: true, window: "30", basis: "EVENT", event: "2026-09-20" } }, { name: "Old wedding, from the upload day", s: { relation: "SPOUSE", allowed: true, window: "30", basis: "UPLOAD", event: "2026-04-10" } },
      { name: "A newborn", s: { relation: "DAUGHTER", allowed: true, window: "90", basis: "EVENT", event: "2026-08-02" } }, { name: "Not allowed at all", s: { relation: "DOMESTIC_PARTNER", allowed: false, window: "", basis: "EVENT", event: "" } }, { name: "Wedding date missing", s: { relation: "WIFE", allowed: true, window: "30", basis: "EVENT", event: "" } },
      { name: "Wedding before the policy began", s: { relation: "SPOUSE", allowed: true, window: "", basis: "EVENT", event: "2025-11-01" } }];
    var form = h("div");
    function draw() {
      form.textContent = ""; var c = compute;
      form.append(h("div", { class: "fields" }, field("Who is joining", sel(REL_OPTIONS.filter(function (o) { return E.midGroup(o[0]); }), S.relation, function (v) { S.relation = v; c(); })),
        field("Policy starts", inp("date", S.pstart, function (v) { S.pstart = v; c(); })), field("File uploaded on", inp("date", S.upload, function (v) { S.upload = v; c(); })), field("Today", inp("date", S.today, function (v) { S.today = v; c(); })),
        field(E.midGroup(S.relation) === "KIDS" ? "Date of birth" : "Date of marriage", inp("date", S.event, function (v) { S.event = v; c(); }))),
        h("div", { class: "grp" }, "The policy's rule for this kind of dependant"),
        h("div", { class: "fields" }, field("Cover starts from", sel([["EVENT", E.midGroup(S.relation) === "KIDS" ? "the birth" : "the marriage"], ["UPLOAD", "the upload day"]], S.basis, function (v) { S.basis = v; c(); })), field("Days allowed without approval", inp("number", S.window, function (v) { S.window = v; c(); }, { min: 0, placeholder: "no limit" }))),
        h("div", { style: "margin-top:12px" }, chk("Joining after the employee is allowed at all", S.allowed, function (v) { S.allowed = v; c(); })));
    }
    function compute() {
      out.textContent = "";
      var r = E.dependantMidterm({ relation: S.relation, rule: { allowed: S.allowed, windowDays: S.window === "" ? null : +S.window, startBasis: S.basis }, eventDate: S.event || null, today: S.today, policyStart: S.pstart, uploadDay: S.upload });
      var err = r.issues.filter(function (i) { return i.severity === "ERROR"; });
      out.append(h("div", { class: "mono acid" }, "COVER STARTS"), err.length ? h("div", { class: "big bad" }, "Rejected") : h("div", { class: "big ok" }, r.coverStart || "—"),
        h("div", { class: "facts" }, h("div", null, h("small", null, "Kind of dependant"), r.group ? r.group.toLowerCase() : "not a mid-term group"), h("div", null, h("small", null, "Rule used"), S.basis === "EVENT" ? "from the " + (r.group === "KIDS" ? "birth" : "marriage") : "from the upload day")),
        r.issues.length ? r.issues.map(function (i) { return h("div", { class: "note " + (i.severity === "ERROR" ? "bad" : "") }, h("span", { class: "chip " + (i.severity === "ERROR" ? "bad" : "warn") }, i.rule), " ", i.message); }) : h("div", { class: "note" }, "Nothing to flag."),
        h("ol", { class: "explain", html: ["<li><span>" + (r.group ? "A <b>" + S.relation.toLowerCase().replace(/_/g, " ") + "</b> belongs to the <b>" + r.group.toLowerCase() + "</b> group, which has its own rule." : "This relation has no mid-term rule, so the sheet's own effective date stands.") + "</span></li>",
          err.length ? "" : "<li><span>Cover would start <b>" + (r.coverStart || "—") + "</b>" + (S.basis === "EVENT" ? ": the " + (r.group === "KIDS" ? "date of birth" : "date of marriage") + ", but never before the policy starts." : ": the day the file is uploaded, but never before the policy starts.") + "</span></li>",
          S.window !== "" && S.event ? "<li><span>The window is counted from the " + (r.group === "KIDS" ? "birth" : "marriage") + " in both cases: <b>" + E.daysBetween(S.event, S.today) + " day(s)</b> have passed, against " + S.window + " allowed" + (E.daysBetween(S.event, S.today) > +S.window ? ", so HR approval is needed." : ", so no approval is needed.") + "</span></li>" : ""].join("") }));
    }
    host.append(h("div", { class: "cols", style: "grid-template-columns:1fr 1fr" }, h("div", null, (function () { var w = h("div"); presetBar(w, PRESETS, function (p) { Object.assign(S, p.s, { window: p.s.window }); draw(); compute(); }); w.append(form); return w; })()), out)); draw(); compute();
  })();

  /* ═══ 06 — enrollment windows, with a picture ════════════════════════════════════════════════════════════════════════════════ */
  (function windowTool() {
    var host = $("t-window"); if (!host) return;
    var P = {
      inside:    { ps: "2030-04-01", pe: "2031-03-31", en: 1, ws: "2030-03-01", we: "2030-04-30", basis: "DATE_OF_JOINING", md: 30, ae: 0, da: 0, doj: "2030-04-02", dou: "2030-04-02", inc: 0, cu: 0, cs: "", ce: "", cc: "", cf: 0, hm: 1, today: "2030-04-10" },
      late:      { ps: "2030-04-01", pe: "2031-03-31", en: 1, ws: "2030-03-01", we: "2030-04-30", basis: "DATE_OF_JOINING", md: 30, ae: 0, da: 0, doj: "2030-06-01", dou: "2030-06-01", inc: 0, cu: 0, cs: "", ce: "", cc: "", cf: 0, hm: 1, today: "2030-06-20" },
      custom:    { ps: "2030-04-01", pe: "2031-03-31", en: 1, ws: "2030-03-01", we: "2030-04-30", basis: "NO_MIDTERM", md: 30, ae: 0, da: 0, doj: "2030-04-02", dou: "2030-04-02", inc: 0, cu: 1, cs: "2030-05-01", ce: "2030-05-20", cc: "", cf: 0, hm: 1, today: "2030-05-10" },
      shorter:   { ps: "2030-04-01", pe: "2031-03-31", en: 1, ws: "2030-03-01", we: "2030-04-30", basis: "NO_MIDTERM", md: 30, ae: 0, da: 0, doj: "2030-04-02", dou: "2030-04-02", inc: 0, cu: 1, cs: "2030-04-01", ce: "2030-04-10", cc: "", cf: 0, hm: 1, today: "2030-04-20" },
      confirmed: { ps: "2030-04-01", pe: "2031-03-31", en: 1, ws: "2030-03-01", we: "2030-12-31", basis: "DATE_OF_JOINING", md: 30, ae: 0, da: 0, doj: "2030-04-02", dou: "2030-04-02", inc: 0, cu: 0, cs: "", ce: "", cc: "", cf: 1, hm: 1, today: "2030-04-15" },
      grace:     { ps: "2030-04-01", pe: "2031-03-31", en: 1, ws: "2030-03-01", we: "2031-06-30", basis: "DATE_OF_JOINING", md: 30, ae: 1, da: 20, doj: "2030-04-02", dou: "2030-04-02", inc: 0, cu: 0, cs: "", ce: "", cc: "", cf: 0, hm: 1, today: "2031-04-15" },
      nowindow:  { ps: "2030-04-01", pe: "2031-03-31", en: 0, ws: "", we: "", basis: "DATE_OF_JOINING", md: 30, ae: 0, da: 0, doj: "2030-06-01", dou: "2030-06-01", inc: 0, cu: 0, cs: "", ce: "", cc: "", cf: 0, hm: 1, today: "2030-06-10" } };
    var NAMES = { inside: "Inside the window", late: "A late joiner", custom: "HR extends one employee", shorter: "An extension that is too short", confirmed: "Confirmed, then widened", grace: "After the policy expires", nowindow: "No window at all" };
    var S = clone(P.late), out = h("div", { "aria-live": "polite" }), form = h("div");
    function draw() {
      form.textContent = ""; var c = compute, t = function (k, label, type) { return field(label, inp(type || "date", S[k], function (v) { S[k] = v; c(); }, type === "number" ? { min: 0 } : {})); }, k = function (key, label) { return chk(label, S[key], function (v) { S[key] = v ? 1 : 0; c(); }); };
      form.append(h("div", { class: "grp" }, "The policy"), h("div", { class: "fields" }, t("ps", "Policy starts"), t("pe", "Policy ends"), t("ws", "Window opens"), t("we", "Window closes"),
        field("Joining mid-term counts from", sel([["DATE_OF_JOINING", "date of joining"], ["DATE_OF_UPLOAD", "date of upload"], ["NO_MIDTERM", "not allowed"]], S.basis, function (v) { S.basis = v; c(); })), t("md", "Mid-term days", "number"), t("da", "Days after expiry", "number")),
        h("div", { style: "display:grid;gap:8px;margin-top:12px" }, k("en", "The policy has an enrollment window"), k("ae", "Allow joining after the policy expires")),
        h("div", { class: "grp" }, "The employee"), h("div", { class: "fields" }, t("doj", "Joined the company"), t("dou", "File uploaded on"), t("cs", "Custom window from"), t("ce", "Custom window until"), t("cc", "Hard close (optional)")),
        h("div", { style: "display:grid;gap:8px;margin-top:12px" }, k("cu", "Has a custom window"), k("cf", "Has confirmed"), k("hm", "Opted in to cover"), k("inc", "Inception member")),
        h("div", { class: "grp" }, "The day we ask"), h("div", { class: "fields" }, t("today", "As of"), h("label", { class: "f" }, " ", h("button", { class: "btn", type: "button", onclick: function () { S.today = new Date().toISOString().slice(0, 10); draw(); compute(); } }, "Use today's date"))));
    }
    function pos(d, a, b) { return Math.max(0, Math.min(100, (E.ord(d) - E.ord(a)) / Math.max(1, E.ord(b) - E.ord(a)) * 100)); }
    function compute() {
      out.textContent = "";
      var need = ["ps", "pe", "today"]; if (need.some(function (k) { return !E.validIso(S[k] || ""); })) { out.append(h("div", { class: "note" }, "Fill in the policy dates and the day to ask about.")); return; }
      var dates = [S.ps, S.pe, S.today, S.ws, S.we, S.doj, S.dou, S.cs, S.ce].filter(function (d) { return d && E.validIso(d); }).sort(); var a = E.addDays(dates[0], -20), b = E.addDays(dates[dates.length - 1], 20);
      var s = { enabled: !!S.en, start: S.ws || null, end: S.we || null, midtermDays: Math.max(1, +S.md || 30), allowAfterExpiry: !!S.ae, daysAfterExpiry: Math.max(0, +S.da || 0) };
      var e = { doj: S.doj || null, dou: S.dou || null, hasMembers: !!S.hm, inception: !!S.inc, custom: S.cu && S.cs && S.ce ? { enabled: true, start: S.cs, end: S.ce, closeDate: S.cc || null } : (S.cc ? { enabled: false, start: S.cs || S.ps, end: S.ce || S.pe, closeDate: S.cc } : null), confirmation: S.cf ? { start: "2030-03-01", end: "2030-04-30" } : null };
      var r = E.evaluateWindow(s, S.ps, S.pe, S.basis, S.today, e), w = r.w, V = { OPEN: ["Open", "ok"], CLOSED: ["Closed", "bad"], CONFIRMED: ["Confirmed", "ok"], CONFIRMED_BUT_NOT_OPTED: ["Confirmed, not opted in", "neg"] }[w.status];
      var seg = function (x, y, color, top, label) { if (!x || !y || !E.validIso(x) || !E.validIso(y)) return null; var l = pos(x, a, b), rr = pos(y, a, b); return [h("div", { class: "seg", style: "left:" + l + "%;width:" + Math.max(.6, rr - l) + "%;background:" + color + ";top:" + top + "px" }), h("div", { class: "lbl", style: "left:" + l + "%;top:" + (top + 18) + "px" }, label)]; };
      var mark = function (d, label, cls, dy) { return d && E.validIso(d) ? h("div", { class: "mark " + (cls || ""), style: "left:" + pos(d, a, b) + "%;top:" + (22 + (dy || 0)) + "px" }, h("span", null, label)) : null; };
      out.append(h("div", { class: "mono acid" }, "VERDICT"), h("div", { class: "big " + V[1] }, V[0]),
        h("div", { class: "timeline", "aria-hidden": "true" }, h("div", { class: "axis" }), seg(S.ps, S.pe, "color-mix(in srgb,var(--ink) 18%,transparent)", 46, "policy period"), S.en ? seg(S.ws, S.we, "var(--acid)", 28, "window") : null,
          w.status !== "CONFIRMED" && S.cu ? seg(S.cs, S.ce, "var(--warn)", 64, "custom") : null, w.start && w.end && w.midterm && !S.cf && E.ord(w.start) >= E.ord(S.ws || "0001-01-01") && S.basis !== "NO_MIDTERM" && w.start === (S.basis === "DATE_OF_JOINING" ? S.doj : S.dou) ? seg(w.start, w.end, "var(--accent2)", 64, "mid-term") : null,
          mark(S.today, "today", "today", 0), mark(S.doj, "joined", "", 24), mark(S.dou, "uploaded", "", 36)),
        h("div", { class: "legend" }, h("span", null, h("i", { style: "background:color-mix(in srgb,var(--ink) 18%,transparent)" }), "policy period"), h("span", null, h("i", { style: "background:var(--acid)" }), "policy window"), h("span", null, h("i", { style: "background:var(--warn)" }), "custom window"), h("span", null, h("i", { style: "background:var(--accent2)" }), "mid-term")),
        h("div", { class: "facts" }, h("div", null, h("small", null, "Window that applies"), w.start && w.end ? w.start + " → " + w.end : "—"), h("div", null, h("small", null, "Custom window"), w.custom ? "yes" : "no"), h("div", null, h("small", null, "Mid-term applies"), w.midterm ? "yes" : "no"), h("div", null, h("small", null, "Runs past policy end"), w.endterm ? "yes" : "no")),
        h("ol", { class: "explain", html: (r.trace.length ? r.trace : [["—", "No rule opens a window for this employee on this day."]]).map(function (t) { return "<li><span><b>rule " + t[0] + "</b> · " + t[1] + "</span></li>"; }).join("") }));
    }
    host.append(h("div", { class: "cols" }, h("div", null, (function () { var w = h("div"); presetBar(w, Object.keys(P).map(function (k) { return { name: NAMES[k], k: k }; }), function (p) { S = clone(P[p.k]); draw(); compute(); }); w.append(form); return w; })()), out)); draw(); compute();
  })();

  /* ═══ 07 — the state machine ═════════════════════════════════════════════════════════════════════════════════════════════════ */
  (function statesTool() {
    var host = $("t-states"); if (!host) return;
    var states = DATA.states, byName = {}; states.forEach(function (s) { byName[s.name] = s; });
    var ORDER = ["INIT", "VALIDATION", "PREMIUM", "CD", "EXECUTION", "INTEGRATION", "FINAL", "ERROR"], colW = 168, rowH = 38, top = 44, nodeW = 150;
    var byPhase = {}; ORDER.forEach(function (p) { byPhase[p] = states.filter(function (s) { return s.phase === p; }); });
    var pos = {}; ORDER.forEach(function (p, ci) { byPhase[p].forEach(function (s, ri) { pos[s.name] = { x: 14 + ci * colW, y: top + ri * rowH }; }); });
    var rows = Math.max.apply(null, ORDER.map(function (p) { return byPhase[p].length; })), W = 14 + ORDER.length * colW, H = top + rows * rowH + 14;
    var sel = null, current = null, trail = [], NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Endorsement state graph");
    var svgEl = function (n, a, t) { var e = document.createElementNS(NS, n); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); if (t) e.textContent = t; return e; };
    var info = h("div"), trailBox = h("ol", { class: "trail" });
    function edge(a, b, cls) {
      var A = pos[a], B = pos[b], x1 = A.x + nodeW, y1 = A.y + 14, x2 = B.x, y2 = B.y + 14, d;
      if (x2 > x1) { var mx = (x1 + x2) / 2; d = "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2; }
      else if (Math.abs(A.x - B.x) < 1) { d = "M" + (A.x + nodeW) + "," + y1 + " C" + (A.x + nodeW + 36) + "," + y1 + " " + (A.x + nodeW + 36) + "," + y2 + " " + (B.x + nodeW) + "," + y2; }
      else { var lift = H - 6; d = "M" + A.x + "," + y1 + " C" + (A.x - 40) + "," + lift + " " + (B.x + nodeW + 40) + "," + lift + " " + (B.x + nodeW) + "," + y2; }
      return svgEl("path", { d: d, class: "edge " + cls });
    }
    function draw() {
      svg.textContent = "";
      ORDER.forEach(function (p, ci) { svg.append(svgEl("text", { x: 14 + ci * colW, y: 22, class: "ph-label" }, p)); });
      var g = svgEl("g"), focus = sel || current;
      if (focus) { var s = byName[focus]; s.next.forEach(function (n) { g.append(edge(focus, n, "out")); }); states.forEach(function (o) { if (o.next.indexOf(focus) >= 0) g.append(edge(o.name, focus, "in")); }); }
      svg.append(g);
      states.forEach(function (s) {
        var p = pos[s.name], cls = "node cat-" + s.category + (s.terminal ? " term" : "") + (focus === s.name ? " sel" : "") + (focus && byName[focus].next.indexOf(s.name) >= 0 ? " out" : "") + (focus && s.next.indexOf(focus) >= 0 ? " in" : "");
        var n = svgEl("g", { class: cls, transform: "translate(" + p.x + "," + p.y + ")", tabindex: "0", role: "button", "aria-label": s.name });
        n.append(svgEl("rect", { width: nodeW, height: 28, rx: 0 }), svgEl("text", { x: 8, y: 18 }, s.name.length > 24 ? s.name.slice(0, 23) + "…" : s.name));
        n.addEventListener("click", function () { pick(s.name); }); n.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(s.name); } });
        svg.append(n);
      });
    }
    function pick(name) { sel = name; draw(); show(); }
    function chipRow(names, fn) { return h("div", { class: "chips" }, names.length ? names.map(function (n) { return h("button", { class: "chipbtn", type: "button", onclick: function () { fn(n); } }, n); }) : h("span", { class: "mut" }, "none")); }
    function show() {
      info.textContent = ""; var s = byName[sel || current]; if (!s) { info.append(h("div", { class: "note" }, "Select a state in the graph, or start a job below.")); return; }
      var from = states.filter(function (o) { return o.next.indexOf(s.name) >= 0; }).map(function (o) { return o.name; });
      info.append(h("div", { class: "mono acid" }, "STATE " + s.code), h("div", { class: "big", style: "font-size:clamp(22px,2.6vw,34px);margin:6px 0 12px;word-break:break-word" }, s.name),
        h("div", { class: "chips", style: "margin-bottom:16px" }, h("span", { class: "chip" }, "phase " + s.phase), h("span", { class: "chip " + (s.category === "ERROR" || s.category === "BLOCKED" ? "bad" : s.category === "SUCCESS" ? "ok" : s.category === "WAITING" || s.category === "PARTIAL" ? "warn" : "") }, s.category.toLowerCase()), s.terminal ? h("span", { class: "chip acid" }, "final: no way out") : null, s.lifecycle ? h("span", { class: "chip" }, "driven by the integration service") : null),
        h("div", { class: "mono mut", style: "margin:12px 0 8px" }, "CAN MOVE TO"), chipRow(s.next, pick), h("div", { class: "mono mut", style: "margin:16px 0 8px" }, "REACHED FROM"), chipRow(from, pick));
    }
    function startJob() { trail = []; current = "REQUEST_RAISED"; sel = null; step(null, "REQUEST_RAISED"); }
    function step(from, to) {
      var t0 = new Date(2030, 3, 1, 10, 0, 0).getTime() + trail.length * 17000 + Math.round(Math.random() * 4000); trail.push({ from: from, to: to, at: new Date(t0).toISOString().slice(11, 19) });
      current = to; sel = null; draw(); show(); walk();
    }
    function walk() {
      var s = byName[current], w = $("walk-box"); w.textContent = "";
      w.append(h("div", { class: "mono mut", style: "margin-bottom:8px" }, s.terminal ? "THE JOB HAS FINISHED" : "LEGAL NEXT STEPS"), s.terminal ? h("div", { class: "note" }, "A final state has no exits. Nothing can move this job again; anything further is a new job.") : chipRow(s.next, function (n) { step(current, n); }));
      trailBox.textContent = ""; trail.forEach(function (t, i) { trailBox.append(h("li", null, h("time", null, t.at), h("span", null, t.from ? t.from + " → " : "", h("b", null, t.to)), h("span", { class: "mono mut" }, byName[t.to].phase.toLowerCase()))); });
    }
    function shortest() { var q = [["REQUEST_RAISED", ["REQUEST_RAISED"]]], seen = new Set(["REQUEST_RAISED"]); while (q.length) { var cur = q.shift(); if (cur[0] === "ENDORSED") return cur[1]; byName[cur[0]].next.forEach(function (n) { if (n !== "MANUAL_INTERVENTION_REQUIRED" && !seen.has(n)) { seen.add(n); q.push([n, cur[1].concat(n)]); } }); } return []; }
    var sp = shortest();
    host.append(h("div", { class: "graph", role: "group", "aria-label": "State graph" }, svg),
      h("div", { class: "cols", style: "margin-top:2px;grid-template-columns:1fr 1fr" }, h("div", null, info), h("div", null,
        h("div", { class: "mono acid", style: "margin-bottom:10px" }, "WALK A JOB THROUGH IT"), h("button", { class: "btn", type: "button", onclick: startJob }, "Start a new job"), h("div", { id: "walk-box", style: "margin-top:16px" }, h("div", { class: "mut" }, "Start a job to move it one legal step at a time. A move the graph doesn't allow simply isn't offered.")),
        trailBox, h("p", { class: "mut", style: "font-size:13.5px;line-height:1.65;margin-top:14px" }, "The shortest path to ENDORSED that needs no manual intervention is " + (sp.length - 1) + " steps: " + sp.join(" → ").replace(/_/g, " ").toLowerCase() + "."))));
    draw(); show();
  })();
})();
