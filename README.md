<h1 align="center">Task manager</h1>

<p align="center">
  Create, list, edit, complete, reorder and delete tasks.<br>
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
  <img src="https://img.shields.io/badge/Next.js-15.5-000000?logo=nextdotjs&logoColor=white" alt="Next.js 15.5">
  <img src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/tRPC-11-2596BE?logo=trpc&logoColor=white" alt="tRPC 11">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/TanStack_Query-5-FF4154?logo=reactquery&logoColor=white" alt="TanStack Query 5">
  <img src="https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white" alt="Zod 4">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
  <br>
  <img src="https://img.shields.io/badge/Vitest-5-6E9F18?logo=vitest&logoColor=white" alt="Vitest">
  <img src="https://img.shields.io/badge/Playwright-1.63-2EAD33?logo=playwright&logoColor=white" alt="Playwright">
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Cloud_Run-4285F4?logo=googlecloud&logoColor=white" alt="Google Cloud Run">
  <img src="https://img.shields.io/badge/Terraform-844FBA?logo=terraform&logoColor=white" alt="Terraform">
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?logo=githubactions&logoColor=white" alt="GitHub Actions">
  <img src="https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare">
</p>

<p align="center">
  <img src="docs/img/demo.gif" width="800" alt="Demo: the welcome panel is closed, a task is completed, a task is dragged to the top, a new task is created and a task is deleted after confirmation.">
</p>

On the first visit, a panel explains how to use the app, and the list starts
with two sample tasks to try every feature. The list loads 10 tasks at a time:
**create more than 10 to see the infinite scroll**. The panel comes back
through the **How to use** link at the top.

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js 15.5** (App Router), React 19 | The case pins version 15. The App Router picks the rendering strategy per route |
| API | **tRPC 11** | Required by the case. Types flow from the server to the client with no code generation |
| Client data | **TanStack Query 5** | Cache, infinite queries, optimistic updates and hydration of the server-rendered page |
| Validation | **Zod 4** | One schema validates the form in the browser and the input on the server |
| Language | **TypeScript 5** (strict) | Shared types between backend and frontend |
| Styling | **Tailwind CSS 4** | Design tokens in one file; responsive from 320px to wide screens |
| Drag and drop | **dnd-kit** | Mouse, touch and keyboard, with screen reader announcements |
| Tests | **Vitest** (31 unit), **Playwright** (14 browser) | Unit tests on the tRPC router; browser tests on the production build |
| Runtime | **Docker** on **Google Cloud Run** | One container, scales to zero when idle |
| Infrastructure | **Terraform** | Every Google Cloud resource described in the repository |
| CI/CD | **GitHub Actions** with Workload Identity Federation | Deploy without any stored service account key |
| Edge | **Cloudflare** | Challenges robots in front of the app |

## What the case asked (Part 2)

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

## Part 1 topics, applied here

The theoretical questions of the case are answered separately. This section
shows how the same topics show up in the code, and why each choice was made.

### Rendering: CSR, SSR and SSG

The App Router decides per route, so the project mixes strategies:

| Route | Strategy | Why |
|---|---|---|
| `/` (list) | **SSR** (`dynamic = "force-dynamic"`) | The list depends on each visitor's cookie, so it cannot be built ahead of time. The first page arrives as HTML, readable even with JavaScript off |
| Next pages of the list | **CSR** after hydration | The server's first page goes into the TanStack Query cache; scrolling fetches the next ones in the browser, without reloading |
| `/tasks/new` | **Static (SSG)** | An empty form is the same for everyone, so it is generated at build time |
| `/tasks/[id]/edit` | **SSR** | The task is loaded on the server, and a missing id answers a real 404 |

One SSR pitfall showed up in practice: the server runs in UTC and the browser
in local time, so dates would render differently on each side and break
hydration. Dates are formatted in a fixed time zone (`America/Sao_Paulo`) to
produce the same text on both.

### Backend approach

The backend lives inside the Next.js app (a single service, in the
Backend-for-Frontend style), exposed through tRPC at `/api/trpc`. Server
Components call the same router directly, in memory, with no HTTP round trip.

**Why:** one team, one language and one deploy. For an app whose only client
is its own frontend, a separate API service would add a network hop and a
second deploy without a benefit.

### tRPC in practice

| Aspect | What the project does |
|---|---|
| **Typing** | The client imports only the `AppRouter` type. Renaming a field on the server breaks the frontend build, not production |
| **Runtime validation** | TypeScript types vanish at runtime, so every procedure validates its input with Zod. The same schema drives the form |
| **Security** | Every procedure is a public HTTP endpoint, reachable with curl, so typing is not authorization. Middlewares require a session and limit changes per IP; errors reach the client without stack traces |
| **Scalability** | The service runs a single Cloud Run instance because the tasks live **in memory**, not because of tRPC. With a database, it could scale horizontally without touching the tRPC layer |

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
6. **Responsive layout** from 320px phones to wide screens.
7. **Deployed on Cloud Run** through CI/CD, with infrastructure as Terraform
   and protection against robots.

Field names follow the case (`titulo`, `descricao`, `dataCriacao`); the rest
of the code is in English.

## Next steps

This is the scope delivered for the case. The natural next steps:

1. **Export to a calendar file.** A button to download the tasks as an
   `.ics` file (iCalendar), which Google Calendar, Outlook and Apple Calendar
   import. It needs a due date on the task, so each task can become an event.
2. **Google Calendar integration.** Sign in with Google (OAuth) and sync tasks
   that have a due date with the user's calendar through the Google Calendar
   API, keeping both sides up to date. Besides the due date, this needs user
   accounts and a database in place of the in-memory list.

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

The list lives in memory, by design: it resets when the server restarts. On
Cloud Run that happens after a few minutes without traffic. The case does not
require persistence.

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

Pagination uses a cursor (position and id of the last task delivered), not an
offset: deleting a task mid-scroll does not make the next page skip an item.

## Structure

```
src/
  app/               Next.js routes
  components/        list, form, dialog, notices and welcome panel
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
4. Only then does the revision get 100% of the traffic. If the tests fail,
   the previous revision keeps serving.

Authentication to Google uses Workload Identity Federation, with no service
account key. The infrastructure is described in
[`infra/terraform/`](infra/terraform/).

The domain goes through Cloudflare, which challenges robots before they reach
the app. The app rejects anything that did not go through Cloudflare, so the
direct Cloud Run address is protected too, and it limits changes per IP on
its own.
