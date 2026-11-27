# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

CHANTIER IQ design preference: preserve the current clean orange construction brand, and extend it with subtle, purposeful motion and working interactions. Respect reduced-motion preferences; avoid constant or distracting animation.

Cramly design preference: use the green Zuzu identity consistently across the landing page, authentication, and study workspace. Do not carry the CHANTIER IQ construction palette or construction copy into Cramly screens.

Landing-page product previews and guided experiences must use clearly labeled illustrative content and local UI state only; never call CHANTI/LLM providers or create real workspace records from marketing previews. Prefer immersive, useful, touch-friendly interactions for product tours, role-specific explanations, and team onboarding flows.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
