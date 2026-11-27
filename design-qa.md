# Design QA — CHANTIER IQ

**Final result: blocked**

## Comparison target and evidence

- Source visual truth 1: `C:\Users\MON HP\Downloads\CHANTIER IQ\e5bb2a7fe910feae6ead7069a285e40b.JPG` (full landing-page reference, 1600 × 6860 source pixels).
- Source visual truth 2: `C:\Users\MON HP\Downloads\CHANTIER IQ\4c36fbde7d73912e70b69e6dddd0f47e.JPG` (desktop hero/dashboard reference, 1500 × 1135 source pixels).
- Rendered implementation: local IAB preview at `http://localhost:4173/`.
- Implementation screenshot: captured in the browser during this run (600 × 511 CSS pixels); the selected browser API returned it in memory and did not provide a saved screenshot file.
- State: Arabic, light theme, public landing page; the app workspace and create-project/task forms were separately opened and inspected.
- Density normalization: none. The source captures show a desktop page; the available preview viewport was 600 × 511, so the implementation is in its responsive narrow-screen layout. These are not matching viewports or crops.
- Full-view comparison: source and implementation were each opened. A side-by-side comparison at the same viewport could not be produced.
- Focused-region comparison: not performed because the desktop source and narrow implementation viewport could not be normalized to the same content scale.

## Blocker

The in-app browser blocked opening the supplied local image as a browser URL. Its security policy allows only HTTP and HTTPS navigation and explicitly disallows workarounds. The implementation screenshot was returned only in memory, with no supported export path to a local file. I therefore could not place the source and implementation captures together in a single comparison input or verify desktop fidelity at the reference viewport. No passing visual comparison is claimed.

## Fidelity surfaces

- **Typography:** implementation uses DM Sans with IBM Plex Sans Arabic fallback; the narrow preview shows the intended Arabic hierarchy, but desktop sizing and wrapping remain unverified.
- **Spacing and layout:** warm canvas, rounded white dashboard cards, centered hero, and a slim sidebar are present. Desktop spacing and the complete page rhythm remain unverified against the source.
- **Colors and tokens:** warm light neutral surfaces and restrained coral actions match the supplied direction at a broad level; no pixel-level comparison was possible.
- **Image quality:** a real construction-site photograph appears in the project preview; the reference's isometric illustration has not been recreated, so image direction has an actionable difference to resolve in a future visual pass.
- **Copy and content:** CHANTIER IQ wording is original. Sample metrics and project records are labelled as demo data; the UI shows no fabricated customer logos, testimonials, published prices, or ROI claims.

## Findings

- [P2] Desktop comparison and asset fidelity are unresolved.
  - Location: landing page hero and dashboard preview.
  - Evidence: the source shows a desktop-width product dashboard and isometric construction illustration; only a 600 px responsive rendering was available, and the implementation uses a photograph.
  - Impact: desktop layout fidelity and image match cannot be approved from the available evidence.
  - Fix: capture the IAB at the source desktop viewport and compare both artifacts together; then decide whether to create a compatible original isometric asset.

## Interaction review

- Opened the demo workspace from the landing page.
- Created a project and a task in an isolated preview origin; both appeared in the workspace and produced success feedback.
- Checked the accessible page structure for the landing page, workspace, and forms.
- The browser console was not available through the selected browser surface.

## Comparison history

- First and only capture: narrow preview at 600 × 511 CSS pixels. No visual fixes were made from this capture because it could not be compared to the desktop source at matching dimensions. The P2 finding remains open.

## Implementation checklist

- [ ] Capture the local landing page at the desktop reference viewport through a permitted browser screenshot export.
- [ ] Compare the desktop hero/dashboard and the full landing-page rhythm with the two supplied references.
- [ ] Revisit the project illustration after that comparison.
- [ ] Repeat the comparison after any P0–P2 visual fixes and update this report.
