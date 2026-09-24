<h1 align="center">Task manager</h1>

<p align="center">
  Create, list, edit, complete and delete tasks.<br>
  Next.js 15 with tRPC, server-side rendered list and infinite scroll.
</p>

<p align="center">
  <a href="https://gerenciador.guistreahl.com.br">
    <img src="https://img.shields.io/badge/Open_the_app-E0005C?style=for-the-badge" alt="Open the app" height="36">
  </a>
</p>

<p align="center">
  <a href="https://github.com/guistreahl/artefact-case/actions/workflows/ci.yml"><img src="https://github.com/guistreahl/artefact-case/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/guistreahl/artefact-case/actions/workflows/deploy.yml"><img src="https://github.com/guistreahl/artefact-case/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
</p>

<p align="center">
  <img src="docs/img/demo.gif" width="800" alt="Demo: the welcome panel is closed, a task is completed, a task is dragged to the top, a new task is created and a task is deleted after confirmation.">
</p>

On the first visit, a panel explains how to use the app, and the list starts
with two sample tasks to try every feature. The list loads 10 tasks at a time:
**create more than 10 to see the infinite scroll**. The panel comes back
through the **How to use** link at the top.

## What the case asked

Every requirement of the case, and where it lives:

| Requirement | Where |
|---|---|
| Next.js 15 + tRPC, frontend consuming the backend | `src/trpc/`, `src/app/api/trpc/` |
| Task with `id`, `titulo` (required), `descricao` (optional), `dataCriacao` | `src/server/tasks/schema.ts` |
| Create, list, update and delete via tRPC, in memory | `src/server/tasks/router.ts`, `store.ts` |
| No task without a title, meaningful errors (`NOT_FOUND`, `BAD_REQUEST`) | `schema.ts`, `router.ts` |
| List with SSR, delete from the list with success and error feedback | `src/app/page.tsx`, `src/components/TaskList.tsx` |
| Create and edit form with hooks and validation | `src/components/TaskForm.tsx` |
| Loading, success and failure states | `TaskForm.tsx`, `TaskList.tsx`, `Toasts.tsx` |
| Bonus: infinite scroll | `TaskList.tsx` (cursor pagination) |
| Bonus: comments and README | the whole repository, plus [`docs/SDD.md`](docs/SDD.md) |

## Beyond the case

Each addition has a reason, detailed in the [SDD](docs/SDD.md):

1. **Complete with a timestamp.** Ticking a task records when it was done.
2. **Confirmation before deleting**, in a keyboard-accessible dialog.
3. **Manual order.** Tasks can be dragged up and down, with mouse, touch or
   keyboard, and the order is kept on the server.
4. **One list per visitor.** An anonymous cookie keeps lists apart, so anyone
   opening the public address only sees what they created.
5. **Optimistic updates.** Deleting, completing and moving change the screen
   at once and roll back, with a notice, if the server refuses.
6. **Deployed on Cloud Run** through CI/CD, with infrastructure as Terraform
   and protection against robots.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Opens at <http://localhost:3000>. No environment variable is needed.

To run the production build, the same server that goes into the Docker image:

```bash
npm run build
npm start
```

Or with Docker, without installing Node:

```bash
docker build -f infra/docker/Dockerfile -t tasks .
docker run -p 8080:8080 tasks
```

## Tests

```bash
npm test                          # unit (Vitest), straight on the tRPC router
npx playwright install chromium   # first time only
npm run build && npm run test:e2e # browser (Playwright), against the production build
```

## How it works

```
browser ──► Next.js (App Router)
               ├─ Server Components ── direct call ─────┐
               └─ /api/trpc ◄── tRPC client ◄── React    │
                                  │                      │
                                  ▼                      ▼
                             tRPC router ──► in-memory Map, one list per visitor
```

1. **List with SSR.** The `/` page fetches the first page of tasks on the
   server and sends the HTML ready. The same data goes into the TanStack Query
   cache on the client, which continues the scroll from it.
2. **Infinite scroll** by cursor: 10 tasks at a time, loaded as the end of the
   list gets close to the screen.
3. **One schema, two places.** The Zod schema in `src/server/tasks/schema.ts`
   validates the form in the browser and the input on the server.
4. **In memory, by design.** The list resets when the server restarts. On
   Cloud Run that happens after a few minutes without traffic. The case does
   not require persistence.

Field names follow the case (`titulo`, `descricao`, `dataCriacao`); the rest
of the code is in English.

## Structure

```
src/
  app/               Next.js routes
  components/        list, form, dialog and notices
  server/            backend: schema, in-memory store, tRPC router, protection
  trpc/              tRPC wiring for React and for Server Components
  lib/               shared constants and formatting
tests/
  e2e/               browser tests (Playwright)
  *.config.ts        Vitest and Playwright configuration
infra/
  terraform/         Google Cloud resources
  docker/            production image
docs/                SDD and the README demo
scripts/             starts the standalone build locally
.github/             CI, deploy and Dependabot
```

Unit tests live next to the code they test, in `src/**/*.test.ts`.

## Deploy

Every push to `main` that passes CI is published to Cloud Run:

1. The image is built and pushed to Artifact Registry.
2. A new revision starts **with no traffic**, on its own URL.
3. The Playwright tests run against that URL.
4. Only then does the revision get 100% of the traffic.

Authentication to Google uses Workload Identity Federation, with no service
account key. The infrastructure is described in
[`infra/terraform/`](infra/terraform/).

The domain goes through Cloudflare, which challenges robots and rate-limits
by IP. The app rejects anything that did not go through Cloudflare, so the
direct Cloud Run address is protected too.
