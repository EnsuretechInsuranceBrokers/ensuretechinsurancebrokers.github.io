/* reference.html: the access matrix, the event flow, the endpoint catalogue and the written sections. Data is generated into data.js from the platform repository. */
(function () {
  "use strict";
  var D = ETDATA;
  function h(tag, attrs) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (k) { var v = attrs[k];
      if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, ""); else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v); });
    (function add(list) { list.forEach(function (c) { if (Array.isArray(c)) add(c); else if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); }); })(kids);
    return e;
  }
  var $ = function (id) { return document.getElementById(id); };
  var nice = function (s) { return s.replace(/_/g, " ").toLowerCase(); };

  /* ═══ 01 who can do what ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
  (function () {
    var host = $("r-access"); if (!host) return;
    var role = "ALL";
    var chips = h("div", { class: "presets", role: "group", "aria-label": "Role" });
    var body = h("div", { class: "panel scroll" });
    function draw() {
      chips.textContent = "";
      ["ALL"].concat(D.roles).forEach(function (r) {
        chips.append(h("button", { type: "button", class: "btn sm", "aria-pressed": String(role === r), onclick: function () { role = r; draw(); } }, r === "ALL" ? "show all roles" : nice(r)));
      });
      var can = role === "ALL" ? null : D.access.filter(function (a) { return a[1].split(" ").indexOf(role) >= 0; }).length;
      body.textContent = "";
      var head = h("tr", null, h("th", null, "What you want to do"), D.roles.map(function (r) { return h("th", { class: role === r ? "col-hl" : "" }, nice(r).replace(" ", " ").replace(/ /g, "\n")); }));
      var rows = D.access.map(function (a) {
        var who = a[1].split(" ");
        return h("tr", null, h("td", null, a[0], h("small", null, a[2])), D.roles.map(function (r) { var y = who.indexOf(r) >= 0; return h("td", { class: role === r ? "col-hl" : "" }, h("span", { class: y ? "y" : "n", "aria-label": y ? "allowed" : "not allowed" }, y ? "✓" : "–")); }));
      });
      body.append(h("table", { class: "matrix" }, h("thead", null, head), h("tbody", null, rows)));
      sum.textContent = role === "ALL" ? "Every row is one decision in the code. A tick means the role passes that route's check." : nice(role) + " can do " + can + " of the " + D.access.length + " things listed.";
    }
    var sum = h("p", { class: "mut", style: "font-size:14px;margin:0 0 14px" });
    host.append(chips, sum, body); draw();
  })();

  /* ═══ 02 events ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  (function () {
    var host = $("r-events"); if (!host) return;
    var topics = []; D.events.forEach(function (e) { if (e[0].indexOf("+") < 0 && topics.indexOf(e[0]) < 0) topics.push(e[0]); });
    var services = []; D.events.forEach(function (e) { [e[2], e[3]].forEach(function (s) { if (s && s !== "various" && services.indexOf(s) < 0) services.push(s); }); });
    var pick = topics[0];
    var flow = h("div"), tbl = h("div", { class: "panel scroll", style: "margin-top:22px" });
    function draw() {
      flow.textContent = ""; tbl.textContent = "";
      var rel = D.events.filter(function (e) { return e[0] === pick; });
      var prod = [], cons = [];
      rel.forEach(function (e) { if (prod.indexOf(e[2]) < 0) prod.push(e[2]); if (cons.indexOf(e[3]) < 0) cons.push(e[3]); });
      flow.append(h("div", { class: "presets" }, topics.map(function (t) { return h("button", { type: "button", class: "btn sm", "aria-pressed": String(t === pick), onclick: function () { pick = t; draw(); } }, t); })),
        h("div", { class: "flow" },
          h("div", { class: "col" }, h("div", { class: "mono mut" }, "written by"), prod.map(function (p) { return h("div", { class: "box on" }, h("b", null, p), "producer"); })),
          h("div", { class: "gap" }),
          h("div", { class: "col" }, h("div", { class: "mono mut" }, "topic"), h("div", { class: "box topic" }, h("b", null, pick), rel.map(function (e) { return h("div", { style: "margin-top:6px;text-transform:none;letter-spacing:0;font-size:11.5px;color:var(--muted)" }, e[1]); }))),
          h("div", { class: "gap" }),
          h("div", { class: "col" }, h("div", { class: "mono mut" }, "read by"), cons.map(function (c) { return h("div", { class: "box on" }, h("b", null, c), "consumer"); }))));
      var all = D.events;
      tbl.append(h("table", { class: "tbl" }, h("thead", null, h("tr", null, ["Topic", "Events", "Written by", "Read by", "What the reader does"].map(function (t) { return h("th", null, t); }))),
        h("tbody", null, all.map(function (e) { return h("tr", { class: e[0] === pick ? "" : "", style: e[0] === pick ? "background:var(--soft)" : "" }, h("td", { class: "code" }, e[0].replace(/ \+ /g, " + ")), h("td", { style: "font-size:13px;color:var(--muted)" }, e[1]), h("td", null, e[2]), h("td", null, e[3]), h("td", { style: "font-size:13.5px;color:var(--muted);line-height:1.6" }, e[4])); }))));
    }
    host.append(flow, tbl); draw();
  })();

  /* ═══ 03 api catalogue ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
  (function () {
    var host = $("r-api"); if (!host) return;
    var q = "", svc = "all", gw = "all", verb = "all", shown = 40;
    var svcs = []; D.api.forEach(function (a) { if (svcs.indexOf(a.service) < 0) svcs.push(a.service); }); svcs.sort();
    var count = h("p", { class: "mono mut", style: "margin:0 0 10px", "aria-live": "polite" });
    var list = h("div", { class: "panel" }), more = h("div", { style: "margin-top:14px" });
    function mk(label, opts, get, set) {
      var s = h("select", { "aria-label": label, onchange: function () { set(s.value); shown = 40; draw(); } }, opts.map(function (o) { return h("option", { value: o }, o === "all" ? label + ": all" : o); }));
      return s;
    }
    var search = h("input", { type: "search", placeholder: "Search by name, path or service, e.g. policy, credits, upload", "aria-label": "Search endpoints", oninput: function () { q = search.value.trim().toLowerCase(); shown = 40; draw(); } });
    host.append(h("div", { class: "search" }, search, mk("service", ["all"].concat(svcs), null, function (v) { svc = v; }), mk("gateway", ["all", "broker", "employer"], null, function (v) { gw = v; }), mk("method", ["all", "GET", "POST", "PUT", "PATCH", "DELETE"], null, function (v) { verb = v; })), count, list, more);
    function matches(a) {
      if (svc !== "all" && a.service !== svc) return false;
      if (gw !== "all" && a.gateways.indexOf(gw) < 0) return false;
      if (verb !== "all" && a.methods.indexOf(verb) < 0) return false;
      if (q && (a.name + " " + a.path + " " + a.service).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }
    function row(a) {
      var m = a.methods[0];
      var flags = [];
      if (a.heavy) flags.push("heavy"); if (a.stream) flags.push("streamed"); if (a.multipart) flags.push("file upload"); if (a.download) flags.push("download");
      var inputs = a.input.length ? h("table", { class: "tbl" }, h("thead", null, h("tr", null, ["Field", "Type", "Required"].map(function (t) { return h("th", null, t); }))),
        h("tbody", null, a.input.map(function (f) { return h("tr", null, h("td", { class: "code" }, f.name), h("td", null, f.type), h("td", null, f.required ? "yes" : "no")); }))) : h("p", { style: "margin:6px 0 0" }, "No body fields: the path alone says what to do.");
      return h("details", { class: "api-row" },
        h("summary", null, h("span", { class: "verb " + m }, a.methods.join("/")), h("span", null, h("span", { class: "code", style: "color:var(--ink)" }, "/" + a.path), h("span", { class: "mut", style: "margin-left:12px;font-size:13px" }, a.name)),
          h("span", { class: "chip" }, a.service)),
        h("div", { class: "api-body" }, h("div", null, "Open to: ", a.gateways.map(function (g) { return h("span", { class: "chip acid", style: "margin-right:6px" }, g); }), flags.map(function (f) { return h("span", { class: "chip", style: "margin-right:6px" }, f); })), inputs));
    }
    function draw() {
      var m = D.api.filter(matches);
      count.textContent = m.length + " of " + D.api.length + " endpoints";
      list.textContent = ""; more.textContent = "";
      if (!m.length) list.append(h("p", { class: "mut", style: "padding:24px" }, "Nothing matches. Try a shorter word, or clear a filter."));
      m.slice(0, shown).forEach(function (a) { list.append(row(a)); });
      if (m.length > shown) more.append(h("button", { type: "button", class: "btn", onclick: function () { shown += 40; draw(); } }, "Show " + Math.min(40, m.length - shown) + " more"));
    }
    draw();
  })();

  /* ═══ 05 legacy ledger ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
  (function () {
    var host = $("r-legacy"); if (!host) return;
    var ST = { ported: ["Came over", "var(--acid)"], changed: ["Came over, changed", "var(--warn,#ffb347)"], partial: ["Partly", "var(--warn,#ffb347)"], not: ["Not yet", "var(--bad,#ff7a59)"] };
    var rows = [
      ["Pro-rata by day or by month, per relation", "ported", "The platform prices each person by their own relation's rule. Monthly rounds the fractional months up, as the old code did. Quarterly and half-yearly were never finished in the old system and are not offered."],
      ["Premium rate cards", "partial", "Flat, age band, grade, per-mille of sum insured and family-floater cards work and are checked against the Java. The old system has about thirty premium types; some map only approximately, and each such one is flagged in the lookup."],
      ["Family rules per relation", "ported", "Allowed relations, age windows, the age gap a child must have, twins and parent counts, now enforced both when a policy is set up and when a file is checked."],
      ["Who pays: employee and employer split", "ported", "By percentage or by value, per relation, and pro-rata applies to both parts. Rounding can never make one side pay more than the whole."],
      ["Premium rounding", "changed", "Floor, ceiling or nearest to a unit, set per policy. The old system rounded for one portal only, so which policies should round is still a business decision."],
      ["Endorsement lifecycle", "changed", "The old workflow became a 36-state machine with only legal moves allowed, and every move audited. The steps after the roster update exist and can be driven; the insurer and TPA adapters behind them are not built."],
      ["Enrollment windows", "partial", "Policy-wide windows, per-employee extensions (the later date wins, never shortens), confirmation, mid-term joining by date of joining or of upload, and windows past policy end. Not ported: base-policy chains, white-label switches, mail triggers on change, bulk extension from a spreadsheet."],
      ["Announcements", "partial", "Banners, carousels and notices targeted at all employers or a list, with a start date and a time to live. An image URL is stored instead of an image library."],
      ["Reading messy files", "changed", "Column names, relations (\"Wife\", \"Son-II\"), dates, Excel serial dates and rupee amounts are normalised, and a bad cell becomes a row error, never a failed job."],
      ["Deposit (CD) accounts", "partial", "One account per policy with credits, thresholds, shared pools and a reserve-then-commit ledger. The old policy / group / company / multiple account types are only partly modelled."],
      ["Parent and child employers", "not", "The organization service has no notion of child companies yet; it needs a decision on who owns what."],
      ["TPA pull and reconcile", "partial", "A generic connector and reconciliation exist and run against a fake TPA in tests. Individual TPA adapters need each TPA's credentials."],
      ["Security shortcuts", "not", "Deliberately not carried over: hard-coded encryption keys, partner credentials logged in token requests, and test endpoints doing production work. Keys and secrets belong in a secret store, and every call goes through the gateway and per-service checks described above."]
    ];
    var filter = "all";
    var bar = h("div", { class: "presets" }), tbl = h("div", { class: "panel scroll" });
    function draw() {
      bar.textContent = ""; tbl.textContent = "";
      [["all", "all"]].concat(Object.keys(ST).map(function (k) { return [k, ST[k][0]]; })).forEach(function (o) { bar.append(h("button", { type: "button", class: "btn sm", "aria-pressed": String(filter === o[0]), onclick: function () { filter = o[0]; draw(); } }, o[1])); });
      tbl.append(h("table", { class: "tbl" }, h("thead", null, h("tr", null, h("th", null, "Legacy capability"), h("th", null, "Status"), h("th", null, "What it is now"))),
        h("tbody", null, rows.filter(function (r) { return filter === "all" || r[1] === filter; }).map(function (r) { var s = ST[r[1]];
          return h("tr", null, h("td", { style: "font-weight:700;min-width:190px" }, r[0]), h("td", null, h("span", { class: "legacy-status", style: "color:" + s[1] }, s[0])), h("td", { style: "color:var(--muted);line-height:1.65;font-size:14px;min-width:300px" }, r[2])); }))));
    }
    host.append(bar, tbl); draw();
  })();

  /* ═══ 06 stakeholders ══════════════════════════════════════════════════════════════════════════════════════════════════════ */
  (function () {
    var host = $("r-people"); if (!host) return;
    var P = [
      ["Broker", "Your clients' policies, in one place, and the paperwork between you and the TPA and insurer made visible.",
        ["Set up employers, policies, rate cards, family rules and enrollment windows once; every endorsement is then checked against them automatically.", "See every endorsement's state and the reason it is stuck, instead of chasing it by email.", "Track each client's deposit balance, with a low-balance flag before it blocks work.", "Different grades of staff get different powers: admins configure and approve, specialists run endorsements, others read."],
        ["Policies you create wait for an admin's approval before going live.", "Insurer and TPA hand-offs are driven by the platform's states, but live adapters are not built yet."]],
      ["HR / employer", "Add, remove and correct members without learning the insurer's file format, and know the cost before you commit.",
        ["Upload the file you already have. Column names, date formats and relations like \"Wife\" are understood.", "See exactly which lines failed and why, fix them, and proceed with the good ones if you choose.", "See the pro-rata premium for the change, who pays what, and whether the deposit covers it before anything is submitted.", "Enrollment window dates and an employee's own extension are visible, not a phone call."],
        ["Staff with the non-admin employer role can upload but cannot proceed, retry, cancel or close.", "An upload for someone whose window has closed is not yet refused automatically."]],
      ["Insurer", "Cleaner, earlier data: fewer rejected files and fewer corrections after the fact.",
        ["Members arrive already checked against the policy's family rules and age limits.", "Every change has a reference, an effective date and an audit trail.", "Amounts are computed by one set of rules, the same ones HR saw before they submitted."],
        ["Direct submission to an insurer's own system is not built; it needs your onboarding and API access."]],
      ["TPA", "A predictable feed of what changed, with a sync you can see succeed or fail.",
        ["A sync job is created for exactly the members that changed after an endorsement is applied.", "Failed syncs stay visible and wait for an operator; they are not silently dropped.", "Reconciliation compares what you hold with what the platform holds."],
        ["Each TPA's own credentials, formats and sandbox are required before a live connection exists; today a generic connector is tested against a fake."]],
      ["Operations / engineering", "Every moving part is named, observable and replaceable.",
        ["Nine services, each with one job; they talk through events and a few direct calls, never by reading each other's tables.", "A gateway with a contract, so what the portals can call is one readable file.", "Every state change is audited; the state graph is generated from code, not drawn by hand.", "A step-by-step local setup with a SQL file and a copy-paste environment."],
        ["Real mail, SMS and payment providers are outside the repository and need accounts."]]
    ];
    var cur = 0, tabs = h("div", { class: "tabs", role: "tablist" }), pane = h("div");
    function draw() {
      tabs.textContent = ""; pane.textContent = "";
      P.forEach(function (p, i) { tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(i === cur), onclick: function () { cur = i; draw(); } }, p[0])); });
      var p = P[cur];
      pane.append(h("p", { style: "font-size:clamp(18px,2vw,24px);letter-spacing:-.03em;line-height:1.4;margin:0 0 22px;max-width:760px" }, p[1]),
        h("div", { class: "two" }, h("div", null, h("h3", null, "Where it is not finished"), h("ul", null, p[3].map(function (t) { return h("li", null, t); }))), h("div", null, h("h3", null, "What you get"), h("ul", null, p[2].map(function (t) { return h("li", null, t); })))));
    }
    host.append(tabs, pane); draw();
  })();

  /* ═══ 07 glossary ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  (function () {
    var host = $("r-glossary"); if (!host) return;
    var G = [
      ["Endorsement", "A change to who is covered or their details, during the policy year: adding, removing or updating people. Each one is a job that moves through the state machine."],
      ["Pro-rata", "Charging only for the part of the year that applies. Someone who joins in October pays for October to March, not the whole year. Daily counts days; monthly counts whole months, rounded up."],
      ["Effective date", "The day the change starts. For a joiner the premium runs from here; for a removal the part of the year after cover ended is refunded."],
      ["CD (client deposit)", "The balance the broker or employer holds with the platform to pay for endorsements. A job reserves money before it runs and commits it when it is applied, or releases it if the job is cancelled."],
      ["Enrollment window", "The period in which employees may join without it being treated as a mid-term change. A policy has one; HR can give an individual employee their own."],
      ["Mid-term joiner", "Someone who joins after the window closes. Depending on the policy they are priced from their date of joining or the date HR uploaded them, or not allowed at all."],
      ["Family construct", "The policy's rules about who can be covered: which relations, how many children and parents, age limits, the gap a child must have from the parent, twins."],
      ["Rate card", "The table that turns a person into an annual premium: flat, by age band, by grade, by sum insured or by family."],
      ["TPA", "Third-party administrator: the company that handles cards, claims and the member list on an insurer's behalf."],
      ["Gateway (BFF)", "The one front door the portals talk to. It checks the sign-in, shapes requests and responses and forwards to the core services."],
      ["Outbox", "A table where a service records an event next to its own change, so the event is published exactly when the change really happened, and never when it did not."],
      ["Tenant", "A broker, or an employer under it. Every read and write is confined to the caller's own tenant."]
    ];
    host.append(h("div", { class: "acc" }, G.map(function (g) { return h("details", null, h("summary", null, g[0]), h("div", { class: "a" }, g[1])); })));
  })();
})();
