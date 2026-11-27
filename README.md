# Cramly

Cramly is a study platform prototype for Algerian first-year university students. The current preview focuses on the Arabic RTL landing page and a local demo workspace for SNV and Science & Technology revision.

## Local setup

1. Install dependencies with `npm install`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` if you want to exercise the Supabase Auth connection. The publishable key is intended for browser use; never place a Supabase secret or service role key in a `VITE_` variable.
3. Run `npm run dev`.

The study workspace uses illustrative content and browser-local state. Completing the sample lesson awards demo XP and saves progress in `localStorage`. The preview does not call an AI provider or create database records. The Supabase project is active, but its Cramly schema has not been applied yet.

## Build and Sites packaging

- `npm run build` creates the Vite app and prepares `dist/client`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
- `npm run test:sites` checks the Sites worker packaging and route fallback behavior.

## Current service setup

- Supabase: project `ysgxrammuskobrizcmgp` in `eu-west-2`; no public tables exist yet.
- Vercel: new `cramly` project created and linked to this local checkout. Production and development Supabase variables are configured.
- GitHub: target repository `amayasberkani-bot/cramly` is empty. Vercel's Git connection request returned an internal error, so automatic deploys and Preview environment variables are not connected yet.

## Product work in progress

The landing page keeps its existing section layout while replacing the construction product copy and brand with Cramly and Zuzu. The after-login preview is a local-only student workspace with a dashboard, module list, weekly planner, sample chalkboard lesson, flashcards, illustrative tutor response, community, league, and profile. A complete lesson schema, planner reminder engine, onboarding persistence, upload processing, and production database policies remain to be implemented.

