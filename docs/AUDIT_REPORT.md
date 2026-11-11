# Functional audit — November 2026

**Question:** if a prospect opens a demo cold and plays with it, does it actually work, and can they tell how
the real system would function?

**Method:** every industry was driven through its real screens in a browser (Chromium) by an auditor acting as
a first-time user: the main record taken from its first state to its last by clicking buttons and filling
forms; every module opened and its main action used; every fictional user tried; phone width checked. The
shared foundation was audited separately. The checklist is in `docs/AUDIT_BRIEF.md`. Each journey is now a
permanent browser test in `e2e/journeys/`.

## Verdict

| Industry | Before the audit | After fixes |
| --- | --- | --- |
| Optometry | Journey ran; four steps dead-ended or pointed into the long Edit form | Works end to end |
| General practice | No walkthrough; three steps stranded the user | Works end to end |
| Automotive workshop | Several steps blocked on fields buried in Edit; advisor could not take payment | Works end to end |
| Tyre & fitment | Four steps blocked on Edit-only fields; all bays full on a fresh start with no guidance | Works end to end |
| Mining | Rules worked; most blocked steps only fixable via Edit; an incident could be closed too early | Works end to end |
| Construction | Valuation maths correct; one guided record missing on Mondays; fixes buried in Edit | Works end to end |
| Real estate | Every blocked step pointed into Edit (25 fields on a listing) | Works end to end |
| Law firm | Rules worked; several dead ends and unexplained second clicks | Works end to end |
| Security | New. Journeys ran; a time-of-day trap in the occurrence book, two rules that did not match the screen, cramped phone layouts | Works end to end |
| Cleaning | New. Relief cover never showed who was ineligible (its main selling point); clock-ins only looked right during shift hours; three steps hid their fix in Edit | Works end to end |

**The single biggest finding, in every industry:** the rules were right, but when a step was refused the screen
said "Edit → some field" and the field was one of 10–25 in a generic form. A prospect would have stalled. Each
of those steps now has its own control on the screen where the refusal happens (for example "Record the
mandate", "Confirm isolation", "Scheme remittance", "Check out to…"), and the message points at it.

## What was fixed

**Shared foundation (benefits every industry)**
- Guided walkthrough on every dashboard: "New here? Try these things" opens the right screen as the right staff member.
- A refused step now says which permission is needed and who holds it, instead of a generic message.
- No note is requested for a step that a note cannot unblock.
- Pressing Enter saves a form; a failed save jumps to the first problem field.
- Search is reachable on a phone; Escape closes the phone menu; long business names no longer collide with the demo label.
- Pop-up messages no longer cover or block buttons; at most two show at once.
- Record pickers with long lists can be filtered by typing, and can be limited to relevant records.
- Finished records (paid, closed, verified) are locked against editing and deleting.
- A visitor returning on a later day gets fresh sample data (or, if they made changes, a banner offering a refresh), so "today" is always today.
- Month charts no longer skip or repeat a month on certain dates.
- Seeded times that are still ahead of the clock are not shown as times.

**Per industry (highlights)**
- *Optometry:* scheme remittance box on the claim; "before this job can go to the lab" checklist with controls; finalising an exam drafts the claim; expired-prescription quote now leads to re-booking; recall list made consistent with recent exams.
- *General practice:* six-step walkthrough; allergy-blocked script offers a safe alternative in place; capture/review result panels; consultation links to its visit and billing; nurse-only visits get an account.
- *Automotive:* check-in, bay/technician and estimate actions on the job card; sending an estimate moves the job to "awaiting approval"; advisor can take payment; fixed record ids so the walkthrough opens the same job every day.
- *Tyres:* arrival, bay, approval and PO controls on the job; tool board lets you check a wrench out in one step and explains refusals; occupied bays are explained with a way forward; warranty panels.
- *Mining:* shift figures, isolation, gas test, investigation and work-order forms on their own pages; incidents can no longer be closed with actions incomplete; duplicate shift logs refused.
- *Construction:* diary delay panel; variation pricing with contract impact shown; certificate block on valuations; snag categories in one click; delivery and PO forms.
- *Real estate:* mandate, go-live checks, viewing feedback, offer conditions, transfer checklist, lease and maintenance controls; "Capture offer" from the buyer, viewing or listing; commission panel for the bookkeeper.
- *Law firm:* intake staff can open matters; postponing asks for date and reason together; engagement checklist; clearing a conflict moves the matter on; trust transfers settle the fee note automatically and overdrafts are refused at capture.
- *All:* business name is never hard-coded (so branding applies everywhere); roles that can see but not act are told who does.

**Found in the final run:** in a client link, jumping to two other industries' addresses in very quick succession could
occasionally skip the redirect back to the client's own dashboard. Fixed (`LockedRedirect`), and re-run repeatedly.

## Known limits (not fixed)

- Steps that are typed by hand in the demo (remittances, lab results, registrations, client sign-offs) would be
  integrations in a real system. The screens say so.
- Some sample figures differ slightly depending on the day the demo is first opened.
- The generic "Edit" form still lists every field of a record; it is now the fallback rather than the only route.
- Demo data is per browser. A prospect on a second device starts fresh.
- Only Chromium was used. Safari, Firefox and screen readers were not tested.
- Backlog raised by auditors, not yet done: a way to make a field read-only once a record reaches a given state (the
  generic Edit form can still change, for example, who a firearm is issued to); invoice line editors that understand
  deductions; value labels on bar charts.
- Some role designs are simplifications (for example only the mine manager verifies production). Each such
  screen names who can act; permissions can be changed under Users & permissions.

## Tips for demoing

- Start from the dashboard walkthrough; each step signs in as the right person.
- Switch user from the top bar while on a screen the next person can also open, or you will see "No access"
  (correct, but it interrupts the story).
- Use Settings & reset before an important demo so every guided record is in its starting state.
- Brand the demo first (Settings → Brand this demo for a client) — see `docs/BRANDING.md`.
