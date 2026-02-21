# Repository Guidelines

## Structure
- `client/src`: React app (`App.tsx`, `main.tsx`), with `components/`, `pages/`, `hooks/`, `contexts/`, and `lib/`.
- `server/`: Express API.
- `shared/`: shared types/schemas (`@shared/*`).
- `migrations/`: Drizzle SQL migrations.

## Commands (run from repo root)
- `npm run dev`: start server + Vite client.
- `npm run build`: build client and bundle server to `dist/`.
- `npm run start`: run production build.
- `npm run check`: strict TypeScript check.

## Drizzle/Zod Workflow
- Update schema in `shared/schema.ts`.
- Set `DATABASE_URL`.
- Run `npx drizzle-kit generate`.
- Run `npx drizzle-kit migrate`.
- Commit updated files in `migrations/`.

## Conventions
- TypeScript strict mode, 2-space indentation.
- `PascalCase` for components, `useX` for hooks, lowercase page filenames.
- Agent-made changes should be minimal, scalable, and aligned with best practices.
- Preserve existing project formatting, naming patterns, and folder structure.
- When rewriting/replacing logic, remove dead code and any related unused imports/types/helpers.
- Keep commits focused and imperative; PRs include summary, validation steps, and UI screenshots when relevant.
