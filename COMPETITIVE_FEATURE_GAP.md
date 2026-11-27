# CHANTIER IQ — competitor feature gap review

Research date: 2026-11-26

## Scope and method

This is a product capability comparison based on official competitor product pages and the current CHANTIER IQ repository/production audit. It is not a claim that any vendor is universally better. Competitor packaging and availability can vary by subscription, region, and release.

## Competitor capabilities observed

| Product | Capabilities highlighted by its official materials |
| --- | --- |
| Procore Project Management | Offline field access to drawings and daily reports, GPS-stamped logs/timecards, RFI and submittal tracking/alerts, drawing links and revisions, schedule, change orders, cost/labor visibility, accounting connections. |
| Autodesk Forma / Build | Configurable RFIs and submittals, daily reports and recurring report delivery, document/version control, progress and schedule workflows, change orders/payment applications, quality and safety forms, photo/document evidence, audit trail, offline mobile form work. |
| Buildertrend | Schedule, daily logs, tasks, change orders, selections, submittals, time clock, customer/subcontractor portals, budget/estimates/bills, warranty and purchase workflows. |
| Fieldwire | Offline plans and field tasks, current plan revisions, drawing-pinned tasks, photo-backed quality/punch lists and checklists. |

## CHANTIER IQ capabilities verified in the current source/production audit

- Projects, tasks, daily site reports and recorded actual costs.
- Team workspaces and role-based sharing code paths.
- Private project documents with version history and signed downloads.
- RFI workflow and CHANTI assistant context for project records.
- Landing page, Arabic/French/English UI, and CHANTI brand assets.

The production UI and deployed JS bundle were checked. Supabase records the document/RFI migrations and the document bucket is private. Authenticated file upload/download, invitation acceptance between two real accounts, and authenticated assistant responses were not end-to-end verified in this audit.

## Prioritized gaps

### P1 — Submittals and approvals

Create a submittal register for materials/equipment requiring review, with submitter, reviewer, due date, response states (submitted, under review, approved, revise/resubmit, rejected), comments/evidence, and an append-only activity history. Connect it to project documents and CHANTI context. This directly fills the currently empty approvals area and is common in Autodesk, Procore, and Buildertrend workflows.

### P1 — Change orders / variations

Track requested scope changes, reason, amount, schedule impact, supporting files, approval state, and resulting budget delta. Require an explicit approval record before treating a change as approved. Do not silently alter the original project budget.

### P1 — Field-first mobile reliability

Build on the current responsive UI with offline draft capture for daily logs/tasks and queued sync, plus photos attached to reports/issues. Clearly show unsynced state and conflicts. Keep offline support a pilot until tested on actual devices and connection loss.

### P2 — Quality, safety, and punch lists

Reusable checklists/forms with responsible person, location, due date, photos, severity, and resolution history; allow escalation to an RFI.

### P2 — Notifications and recurring reports

An actionable inbox for due/overdue items, blockers, approvals, and budget changes; user preferences, read state, and email digests. Add saved/recurring report templates and export to PDF/CSV after the underlying report data is stable.

### P2 — External stakeholder access

Extend existing workspace roles into a carefully scoped client/subcontractor view with per-project and per-document visibility. Make budget visibility explicit and opt-in by permission.

### P3 — Scheduling depth and integrations

Task dependencies/look-ahead schedules, workforce time capture, purchase orders/commitments, and accounting integrations. These need customer discovery and clear data ownership before implementation.

## Current local implementation status (2026-11-27)

The local checkout now contains the following implementation work; these items are not production-ready until the pending Supabase migrations are applied and authenticated flows are verified:

- Submittal register with owner review, change-order approvals, project issue tracking, audit events, and persistent workspace notifications.
- Field quality/safety/punch records with assigned team member, due date, severity, evidence photos in the private project bucket, offline IndexedDB drafts, and conversion of an issue into a linked RFI.
- Built-in reusable inspection checklists for safety walks, concrete pours, and handover punch checks. Responses are recorded with the issue history.
- Look-ahead task board with overdue/this-week/next-two-weeks/unplanned lanes and task predecessor display.
- Workforce time entries, purchase orders/subcontract commitments with owner approval, and accounting-compatible CSV export. This is a data export, not a live accounting-system integration.
- Team navigation wired to the existing member/invitation controls, per-user notification category preferences, a read-only client portal with revocable links, and report templates with CSV/PDF export.
- CHANTI context extended to include approvals, change orders, field issues, commitments, labor entries, report schedules, and task dependencies.

Remaining integration-dependent work: scheduled email digests and automatic report delivery require a configured email provider and scheduler; live accounting connections and vendor-specific purchase-order workflows need customer requirements and credentials. The offline queue is scoped to task/site-report text and issue photos; it does not cache drawings or guarantee offline use of every dashboard page. Every SQL migration must be applied and checked on the intended Supabase project before claiming these features are active for real accounts.

## Work started from this report

The dashboard now has a proposed data-derived “Needs attention” panel for overdue/high-priority tasks, reported blockers, and actual-cost-over-budget signals. It derives only from loaded workspace records; it does not insert sample records. Treat this as a first operational insight, not a replacement for a durable notification system.

## Landing page recommendations

- Lead with concrete workflows for contractors: planned vs actual cost, daily site records, RFIs, controlled project files, and actionable risk signals.
- Explain the use case by role (contractor, project manager, site engineer) with specific outcomes rather than generic promises.
- Label the interactive workspace as demo data and separate shipped functionality from pilot/roadmap items.
- Use product screenshots and explain what each signal means. Do not add fabricated customer logos, testimonials, or performance claims.

## Sources

- [Procore Project Management](https://www.procore.com/project-management)
- [Autodesk Build — product overview](https://help.autodesk.com/cloudhelp/ENG/Build-About/files/What_is_Build.html)
- [Autodesk Forms](https://construction.autodesk.com/tools/construction-forms/)
- [Autodesk Daily Reports](https://construction.autodesk.com/tools/construction-daily-reports/)
- [Buildertrend Construction Workflow](https://buildertrend.com/construction-workflow-software/)
- [Buildertrend Client Portal](https://buildertrend.com/communication/construction-client-portal/)
- [Fieldwire Construction Planning Software](https://www.fieldwire.com/blog/construction-planning-software/)
