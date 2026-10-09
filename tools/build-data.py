#!/usr/bin/env python3
"""Regenerates assets/data.js from the platform's own code, so the reference pages cannot drift from it.

    python3 tools/build-data.py /path/to/Ensuretech          # a checkout of the platform repository

Reads: endorsement-service apps/jobs/states.py (the state graph), the BFF's API contract (php), and the curated tables below.
The Python and PHP used here are the platform's own; nothing is typed in twice for states and endpoints."""
import json, os, subprocess, sys
root = sys.argv[1] if len(sys.argv) > 1 else "../Ensuretech"
sha = subprocess.run(["git", "-C", root, "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
svc = os.path.join(root, "services")

states = json.loads(subprocess.run([sys.executable, "-c", """
import sys, json; sys.path.insert(0, '.')
from apps.jobs.states import State, TRANSITIONS, LIFECYCLE_STATES
print(json.dumps([{"name": s.name, "code": s.code, "phase": s.phase.value, "category": s.category.value, "terminal": s.terminal, "lifecycle": s in LIFECYCLE_STATES,
  "next": sorted(t.name for t in TRANSITIONS[s])} for s in sorted(State, key=lambda s: s.code)]))"""],
    cwd=os.path.join(svc, "endorsement-service"), capture_output=True, text=True, check=True).stdout)

php = r'''require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$c = app(App\Bff\Contract::class); $inputs = config("contract.inputs"); $out = [];
foreach ($c->endpoints() as $k => $e) { $in = [];
  if (isset($e["input"])) foreach (($inputs[$e["input"]] ?? []) as $f => $spec) $in[] = ["name" => $f, "required" => !empty($spec["required"]), "type" => $spec["type"] ?? "string"];
  elseif (isset($e["body"])) foreach ($e["body"] as $f) $in[] = ["name" => $f, "required" => false, "type" => "string"];
  $out[] = ["name" => $k, "methods" => $e["methods"], "path" => $e["path"], "gateways" => $e["gateways"] ?: ["public"], "service" => $e["service"], "scope" => $e["scope"],
            "heavy" => !empty($e["heavy"]), "input" => $in, "download" => isset($e["download"]), "stream" => isset($e["stream"]), "multipart" => isset($e["multipart"])]; }
echo json.dumps([$out, array_map(fn ($k, $v) => ["name" => $k, "path" => $v["path"], "gateways" => $v["gateways"]], array_keys($c->compositions), array_values($c->compositions))]);'''.replace("json.dumps", "json_encode")
schema = json.loads(subprocess.run([sys.executable, "-c", """
import sys, json; sys.path.insert(0, '.')
from apps.intake.schema import SYNONYMS, DUAL_FIELDS, GENERIC_PREFIX, REQUIRED_BY_OP, AUTO_CONFIRM, MIN_CONFIDENCE
print(json.dumps({"synonyms": SYNONYMS, "dual": DUAL_FIELDS, "genericPrefix": sorted(GENERIC_PREFIX), "required": REQUIRED_BY_OP, "autoConfirm": AUTO_CONFIRM, "minConfidence": MIN_CONFIDENCE}))"""],
    cwd=os.path.join(svc, "endorsement-service"), capture_output=True, text=True, check=True).stdout)
api, comp = json.loads(subprocess.run(["php", "-r", php], cwd=os.path.join(svc, "bff"), capture_output=True, text=True, check=True).stdout)

ROLES = ["BROKER_ADMIN", "BROKER_SPECIALIZER", "BROKER_NON_ADMIN", "EMPLOYER_ADMIN", "EMPLOYER_NON_ADMIN"]
# capability -> roles allowed. Each row cites the check in the code that decides it.
ACCESS = [
  ["Look at employers, policies and rate cards", "BROKER_ADMIN BROKER_SPECIALIZER BROKER_NON_ADMIN", "Spring SecurityConfig: /api/v1/broker/** needs one of the three broker roles"],
  ["Look at their own employer's policies and deposit", "EMPLOYER_ADMIN EMPLOYER_NON_ADMIN", "SecurityConfig: /api/v1/employer/** needs an employer role; the employer id comes from the token"],
  ["Create or change employers, branches, policies, rate cards, family rules, windows", "BROKER_ADMIN", "@PreAuthorize(\"hasRole('BROKER_ADMIN')\") on every write in organization-service and policy-service"],
  ["Approve a policy so it goes live", "BROKER_ADMIN", "PolicyController.approve: BROKER_ADMIN"],
  ["Record money received, set a low-balance threshold, build shared deposit accounts", "BROKER_ADMIN", "CdController credits / threshold / pools: BROKER_ADMIN"],
  ["Approve or reject a top-up request", "BROKER_ADMIN", "CdController approve / reject: BROKER_ADMIN"],
  ["Request a top-up of the deposit", "BROKER_ADMIN EMPLOYER_ADMIN", "CdController: broker route BROKER_ADMIN, employer route EMPLOYER_ADMIN"],
  ["Upload an endorsement file, use the form editor, save a column mapping", "BROKER_ADMIN BROKER_SPECIALIZER EMPLOYER_ADMIN EMPLOYER_NON_ADMIN", "endorsement-service CAN_SUBMIT (a broker's non-admin staff cannot upload)"],
  ["Proceed with, retry, cancel or close an endorsement", "BROKER_ADMIN BROKER_SPECIALIZER EMPLOYER_ADMIN", "endorsement-service CAN_DECIDE (an employer's non-admin staff can upload but not decide)"],
  ["Read endorsement jobs, errors and the audit trail", "BROKER_ADMIN BROKER_SPECIALIZER BROKER_NON_ADMIN EMPLOYER_ADMIN EMPLOYER_NON_ADMIN", "GatewayPermission: any broker or employer role on its own gateway, scoped to its tenant"],
  ["Manage TPA connections and reconciliation", "BROKER_ADMIN BROKER_SPECIALIZER BROKER_NON_ADMIN", "integration-service: /api/v1/broker/** (writes: BROKER_ADMIN)"],
  ["Ask the assistant, see dashboards and reports", "BROKER_ADMIN BROKER_SPECIALIZER BROKER_NON_ADMIN EMPLOYER_ADMIN EMPLOYER_NON_ADMIN", "read-service: any broker or employer role, scoped to its tenant"],
  ["Add to the assistant's knowledge base", "BROKER_ADMIN BROKER_SPECIALIZER BROKER_NON_ADMIN", "read-service broker route"],
]
EVENTS = [
  # topic, event, producer, who listens, and what they do
  ["employer.events", "EmployerCreated / EmployerUpdated / EmployerDeactivated / EmployerConfigChanged / BrokerCreated", "organization-service", "policy-service", "keeps its own list of which employers belong to which broker, so it can refuse a policy for someone else's employer without calling anyone"],
  ["policy.events", "PolicyCreated / PolicyApproved / PolicyDeactivated / PolicyExpired / RateCardChanged", "policy-service", "billing-service", "PolicyApproved opens the policy's deposit account (or links it to a company pool)"],
  ["policy.events", "PolicyApproved", "policy-service", "integration-service", "routes the policy to its TPA (the tpa_id on the event, when there is one)"],
  ["endorsement.events", "EndorsementStateChanged", "endorsement engine", "billing-service", "releases the reserved money when a job is cancelled or fails validation"],
  ["endorsement.events", "EndorsementApplied", "endorsement engine", "billing-service", "commits the reservation: the deposit is debited with the endorsement id as the reference"],
  ["endorsement.events", "EndorsementApplied", "endorsement engine", "integration-service", "creates a TPA sync job for the members that changed"],
  ["cd-balance.updates", "CdBalanceUpdated / CdBalanceLow", "billing-service", "read-service", "updates the balances on dashboards and the low-balance flags (shared accounts update every policy they fund)"],
  ["tpa.events", "TpaSyncCompleted / TpaSyncFailed", "integration-service", "read-service", "shows sync health; a dead-lettered sync waits for an operator to retry it"],
  ["endorsement.events + policy.events + cd-balance.updates + tpa.events", "all of the above", "various", "read-service", "projects every event into the read models behind the dashboards, reports and the assistant's history"],
  ["endorsement.events + policy.events + cd-balance.updates + tpa.events", "state changes, applied, approved, low balance, sync failed", "various", "notification-service", "turns them into mail triggers: request raised, needs review, failed, blocked on deposit, member added or removed"],
]
body = {"generated": {"from": "Ensuretech platform repository", "commit": sha}, "states": states, "schema": schema, "api": api, "compositions": comp, "roles": ROLES, "access": ACCESS, "events": EVENTS}
open(os.path.join(os.path.dirname(__file__), "..", "assets", "data.js"), "w").write(
    "/* GENERATED by tools/build-data.py from the platform repository (commit %s). Do not edit by hand. */\n(function (r, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else r.ETDATA = f(); })(typeof self !== 'undefined' ? self : this, function () { return %s; });\n"
    % (sha, json.dumps(body, ensure_ascii=False, separators=(",", ":"))))
print("states", len(states), "endpoints", len(api), "commit", sha)
