# Industry modules

Each industry is a separate configuration on the same foundation. Modules were chosen from what practice/
operations software in each sector is commonly expected to do (see "Research notes"), then reduced to the
workflows that make a demo convincing. They are deliberately **not** the same dashboard renamed.

## 1. Optometry — Northgate Optometry (priority)

**Users:** Dr Lerato Khumalo (owner & optometrist, all access) · Sipho Dlamini (optometrist) · Megan van Wyk
(optical dispenser) · Ayesha Patel (receptionist) · Johan Botha (practice manager).

| Group | Module | What it does | Rules worth showing |
| --- | --- | --- | --- |
| Front desk | Diary & patient flow | Day planner per practitioner (3 columns), click-to-book, patient-flow board, list | Check-in only on the day; no-show only for past/today; cancel needs a note; double-booking refused; pre-test/consulting room only for clinical visit types |
| Front desk | Patients | Register + profile with full visit timeline, current Rx, recall, quick booking | Phone/email format; member number required for scheme patients; medical history hidden without *View clinical* |
| Front desk | Recalls | Overdue/due list, reminder preview (never sent), log contact, book from recall | Consent respected (no reminder button without consent) |
| Clinical | Eye examinations | Structured exam: history, VA, subjective refraction R/L, PD, IOP, anterior/posterior, ICD-10 sample, plan, referral, recall | Sphere/cyl/add in 0.25 D steps, axis 1–180 required with cylinder, VA format; diagnosis required; finalising issues a prescription **and** sets the recall date; amendments need a note; anisometropia & IOP > 21 highlighted as demo review flags |
| Clinical | Prescriptions | Issued Rx with expiry, print view (watermarked), start an optical order | Expiry flag; void needs a note |
| Optical | Optical orders | Lab board: quoted → at lab → received → ready → collected, QC fail → remake → resend | Cannot send to lab with an expired Rx, missing PD, missing/out-of-stock frame, or private order without deposit; sending reserves the frame from stock; QC failure needs a note; "past promised date" and "uncollected 14+ days" flags; ready-message preview |
| Optical | Frames & stock | Frames, sunglasses, contact lenses, solutions, accessories | Retail ≥ cost; reorder / out-of-stock flags |
| Practice | Billing & claims | Scheme claims and patient accounts with demo tariff lines | Submit needs scheme patient, member number, ICD-10 and a line; full remittance must equal total; part payment needs a note; rejected → correct & reopen or bill patient |
| Practice | Practice reports | Exams, exam→eyewear conversion, billed vs collected, by optometrist, by funder, recall effectiveness, lens mix | Computed from records |

Dashboard: today's appointments and who is in the practice now, exams this month, jobs ready for collection,
claims awaiting payment, attention list (late lab jobs, uncollected jobs, rejected claims, unfinalised exams,
low stock), lab pipeline, six-month exams vs orders chart, activity feed.

## 2. General medical practice — Acacia Family Practice

**Roles:** GP partner (all access), GP / locum, practice nurse, reception, billing administrator.

| Module | What it does | Rules worth showing |
| --- | --- | --- |
| Waiting room & visits | Queue board by stage (booked → arrived → triaged → with doctor → billing → done), triage vitals form, day and upcoming lists | Check-in only on the day; triage needs plausible vitals (BP optional under 12); calling in needs a clinician; billing needs a signed consultation; nurse-only visits skip the doctor; BP ≥ 140/90, temp ≥ 38.0 °C, SpO2 < 94 % shown as "for doctor review (demo rule)" to clinical roles only |
| Patients | Register and profile with timeline and clinical alerts | Allergies, conditions and medication need *View clinical* |
| Consultations | SOAP notes, ICD-10 sample, sick-note preview, add script, request test | Signing needs S, A, P and ICD-10; signing drafts the claim (`DEMO-GP…` tariff); addendum needs a note |
| Scripts | Draft → issued → dispensed / cancelled | Blocked when recorded allergies match the drug or its group (e.g. penicillin vs amoxicillin); repeats 0–5; *Prescribe* permission |
| Results inbox | Requested → received → reviewed → patient informed | Review needs *Results review*; flags for awaiting > 7 days and abnormal-not-reviewed |
| Chronic care register | Hypertension, diabetes, asthma … with review dates and control status | Overdue / due-soon / poorly controlled flags |
| Billing & claims | Scheme claims and private accounts | ICD-10, member number and `DEMO-` codes required to submit |
| Practice reports | Consults per doctor and month, DNA rate, overdue reviews, funder mix, result turnaround | |

## 3. Automotive services — Torque Lane Auto Services

**Roles:** workshop owner (all access), service advisor, workshop foreman, technician, parts & admin clerk.

| Module | What it does | Rules worth showing |
| --- | --- | --- |
| Workshop board | Job cards: booked → checked in → diagnosing → awaiting approval → in progress → quality check → ready → collected | Odometer at check-in must not go backwards; diagnosis needs bay and technician; **no work without an approved estimate**; QC needs foreman permission and a full checklist; QC pass issues the invoice; private customers pay before collection, fleet accounts on 30-day terms; collection updates odometer and (for services) next service due |
| Estimates | Parts and labour lines (hours × R850 demo rate): draft → sent → approved / declined | Approval note must name the channel (phone, WhatsApp, in person, email); approval takes parts from stock |
| Bay & technician planner | Today by bay or technician, utilisation against an 8-hour day | Scheduling clashes refused |
| Vehicles / Customers | Fictional plates (`DEMO …`) and VINs, service history, service due by date or km, account balance | |
| Parts inventory | 30 parts, cost/sell, low and out-of-stock flags | |
| Invoices | Issued → part paid → paid / void | Payment cannot exceed the balance; overdue after 30 days |
| Service reminders | Due/overdue vehicles, message preview (never sent), log contact, book | |
| Workshop reports | Labour vs parts revenue, turnaround, technician hours sold, comebacks, parts margin | |

## 4. Mining — Ridgeback Minerals (Kgotso Shaft)

**Roles:** mine manager (all access), shift supervisor, safety officer, maintenance planner, environmental officer, contractor coordinator.

| Module | What it does | Rules worth showing |
| --- | --- | --- |
| Shift production log | Tonnes per shift and section against plan; MTD meters, 7-day board, verification queue | Verify needs *Production verify*, a delay reason when delays > 30 min, and a different person from the submitter |
| Incidents & near misses | Reported → investigating → corrective actions → closed; days since last LTI | Root cause, actions, owner and due date before corrective actions; cannot close with actions still due unless complete; LTI needs lost days |
| Permits to work | Requested → approved → active → closed, suspend/resume | Contractor must be cleared for site; activation needs isolation confirmed and, for confined space, O₂ between 19.5 % and 23.5 %; active-past-expiry flag; live checklist on the permit |
| Equipment register / Maintenance work orders | Fleet with engine hours and service intervals; work orders on a board | Service overdue / due ≤ 50 h flags; completing a work order needs an hour-meter reading and updates the machine's next service |
| Contractors & induction | Induction, medical fitness and competency expiries | Expired induction or medical = not cleared for site |
| Environmental monitoring | Dust, noise and pH readings | Labelled demo thresholds (not regulatory limits); an exceedance cannot be reviewed without a note |
| Operations reports | 12-week production trend, delay reasons, incidents by category, planned vs breakdown maintenance, compliance expiries | |

## 5. Law firm — Mahlaba & Rossouw Attorneys

**Roles:** managing partner (all access), associate, candidate attorney, legal secretary / paralegal, bookkeeper.

| Module | What it does | Rules worth showing |
| --- | --- | --- |
| Matters | Intake → conflict check → engagement → active → closing → closed | Engagement needs a cleared conflict check; active needs signed engagement letter and FICA; closing needs R0 trust balance, nothing awaiting approval and no unbilled time; privileged notes need *Privileged view*; case numbers visibly fake (`DEMO-…`) |
| Conflict checks | Search across clients, opposing and other parties; record the outcome | Only *Clear conflicts* can clear; a potential conflict needs a note; a confirmed conflict cannot be cleared |
| Clients | FICA status and review date | Outstanding / expired / expiring flags |
| Time & fees | Entries in 0.1 h steps (max 12 h), rate, narrative, WIP | Write-off needs a note; "billed" only via a fee note |
| Trust ledger (simulated) | Deposits, payments, transfers per matter, partner approval | A matter's trust balance can never go negative (checked on capture and approval); transfers only against an outstanding fee note; prominent "not a trust accounting system" notice |
| Court diary & deadlines | Court dates, filing deadlines, prescription dates, meetings | Prescription dates highlighted and cannot be postponed; postponing others needs a note and a later date |
| Fee notes | Built from unbilled time with VAT | Payment checks; overdue flag |
| Documents register | Drafting → partner review → signed → filed | Only pleadings and affidavits can be filed, with a filing date |
| Practice reports | WIP by fee earner, utilisation vs 6 h/day, realisation, matters by type, deadlines | |


## Research notes

Module choices were checked against public vendor and directory descriptions of sector software (vendor
marketing, not independent verification):

- Optometry: recall tracking, lab order tracking, dispensing from frame selection to medical-aid claim, and
  South African claim/benefit-check integrations are recurring features —
  [GoodX optometry](https://goodx.co.za/?p=5180), [VisionX features](https://visionx-amw.pages.dev/features.html),
  [GetApp — Optosoft](https://www.getapp.za.com/software/2067572/optosoft).
- General practice: ICD-10 coding linked to claims, results stored against the patient, SMS reminders, POPIA
  controls — [GoodX GP software](https://goodx.co.za/practice-types/general-practitioner-medical-software/),
  [GoodX EHR guide](https://goodx.co.za/?p=5395).
- Mining: permit-to-work linked to maintenance, contractor competency and site access, CMMS work orders from
  engine hours, shift production reporting — [Ideagen mining](https://ideagen.com/industries/mining),
  [IntelliPERMIT](https://www.intellipermit.com/blog/permit-management-solutions-mining/),
  [Oxmaint](https://oxmaint.com/article/cmms-mining-heavy-equipment).
- Automotive: job cards, estimates with customer approval, live bay/technician view, parts stock alerts,
  service reminders — [ARI features](https://ari.app/features), [AutoLeap](https://autoleap.com/automotive-garage-software/),
  [Workshop Software](https://www.workshopsoftware.com/features).
- Law firms: trust and business accounting, time recording, matter management, FICA, conflict management —
  [GoLegal](https://www.golegal.co.za/?p=63045), [LawPracticeZA](https://lawpracticeza.com/docs/overview.html),
  [Legal Interact](https://www.legaltechnologyhub.com/vendors/practice-manager-pro-by-legal-interact/).
