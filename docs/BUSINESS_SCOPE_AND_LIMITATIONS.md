# Business scope and limitations

These are **discovery demonstrations**. They make a conversation with a prospective client concrete
("this is roughly how your practice / workshop / mine / firm could run on one system") so that the real
scope can be agreed. They carry no production commitment.

## Demonstrated (works in the browser, fictional data)

| Area | Shared foundation |
| --- | --- |
| Navigation | Industry gallery; themed sidebar grouped by work area; breadcrumbs; workspace search; mobile drawer |
| Users | Five or six fictional users per industry; switch from the top bar; module and action permissions; Users & permissions matrix (add/remove demo users, grant/revoke) |
| Records | Registers with search, status filter, table or board view; create/edit forms with validation; delete with confirmation; per-record history (who, role, when, note) |
| Workflows | Configured states and transitions; blocked steps explain why; notes required for rejections/cancellations; side effects (e.g. exam → prescription + recall date) |
| Dashboards | Industry-specific KPIs, attention lists, pipelines and charts computed from the live records |
| Persistence | Browser localStorage; reset per industry |

**Optometry (priority)** — diary per practitioner with patient flow (check-in → pre-test → consulting room →
dispensing → complete), double-booking prevention, structured eye examination (acuity, refraction, IOP,
findings, ICD-10 sample diagnosis, plan) with prescription data-entry checks, finalisation that issues a
prescription and sets the recall, prescriptions with expiry and print view, optical orders on a lab board
(quote → lab → received → QC pass/fail + remake → ready → collected) with stock reservation, frames &
stock with reorder alerts, recall list with message preview and logging, medical-aid claims and patient
accounts (submit checks, remittance, part payment, rejection, patient billing), practice reports.

Other industries: see `docs/INDUSTRY_MODULES.md`.

## Simulated (looks real, is not)

- **Sign-in and permissions.** Anyone with the link can switch users. Hidden modules and fields are hidden by
  browser JavaScript only. A public static site cannot protect confidential data.
- **Persistence.** Records exist only in one browser. Nothing syncs, nothing is backed up.
- **Clinical rules.** Prescription, IOP, vitals and allergy checks are data-entry demonstrations, not clinical
  decision support.
- **Codes and schemes.** Medical aid names, membership numbers and tariff codes are invented
  (`DEMO-…`). ICD-10 codes appear as samples only.
- **Money.** VAT 15% is a demo default. Claims, invoices, fee notes and trust entries are not tax- or
  regulation-compliant documents. No payments are processed.
- **Messages.** Reminder and "ready" messages are previewed and logged; nothing is sent.
- **Mining thresholds, permits, incident records** are illustrative and not tied to any regulation.
- **Trust accounting (law)** demonstrates the rule "a matter's trust balance cannot go negative" only; it is
  not a compliant trust accounting system.

## Not built (would be separately scoped production work)

Real authentication and server-side authorisation; a backend database with audit, backup and retention;
POPIA-aligned data handling and consent management; HPCSA/medical-record, legal-practice, mine-health-and-safety
or accounting compliance; integrations (medical-aid switching, labs, SMS/email, accounting, parts suppliers,
telemetry, court e-filing, banks); data migration from existing systems; hosting, support and SLAs.

## Questions to ask a prospective client

1. Which modules matter most on day one, and which are missing?
2. Who does each step today, and who must approve what?
3. What must never be visible to whom (clinical notes, HR, privileged notes, pricing)?
4. Which existing systems must we replace, integrate with, or migrate from?
5. Which dates or limits cause the most pain when missed (recalls, promised dates, expiries, deadlines)?
6. How many users and sites; office-only or mobile in the field?
7. Hosting, backup and support expectations.
