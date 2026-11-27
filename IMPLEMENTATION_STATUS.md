# Cramly — implementation status

## Current prototype

- Stack: Vite 6, React 19, JavaScript, and lucide-react.
- Routing: a small client-side page state in `src/App.jsx`; the app shell is in `src/StudyWorkspace.jsx`.
- Design: Arabic RTL default, French LTR switch, green Cramly palette, Fredoka headings, Cairo Arabic body, and Zuzu mascot assets under `public/brand/`.
- Demo workspace: all study progress is illustrative and stored locally in the browser. The sample lesson answer and completion update demo XP. The tutor screen uses a fixed illustrative response.
- Marketing preview: local component state only; it does not invoke AI services or create workspace records.

## Connected services

- Supabase project `ysgxrammuskobrizcmgp` is active in `eu-west-2`. Its `public` schema has no tables yet. The local public URL and publishable key are set in `.env.local`; production and development values are set in the Vercel project. No server key is exposed to the client.
- Vercel project `cramly` was created under the existing team and is linked to the current local checkout. The configured output directory is `dist/client`.
- GitHub repository `amayasberkani-bot/cramly` is empty. The Vercel Git connection attempt failed with an internal 500 error. Automatic deployments and Preview environment variables are pending a successful repository connection.

## Pending before production use

- Cramly database schema, RLS policies, demo seed data, and typed data layer.
- Auth onboarding, real study progress storage, timetable/reminder engine, and lesson schema/player.
- Grounded tutor and uploaded-course generation endpoints with server-side credentials and quotas.
- Community moderation, PWA offline support, privacy/terms review, and full 390px Arabic/French QA.
- Push a reviewed Cramly commit to the empty GitHub repository, connect it to Vercel, then deploy.

## Verification

- `npm run build` succeeds and produces the Sites-required artifacts.
- `npm run test:sites` passes all four existing Sites worker tests.
