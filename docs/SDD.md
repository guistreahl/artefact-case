# SDD: task manager

Project architecture: what the case asks for, what was delivered and how the
pieces connect, from the screen down to Cloud Run.

Live at `https://gerenciador.guistreahl.com.br`.

---

## 1. What the case asks for

| # | Case requirement |
|---|---|
| C1 | Next.js 15 app with tRPC, the frontend consuming the backend endpoints |
| C2 | Task with an auto-generated `id`, required `titulo`, optional `descricao` and `dataCriacao` |
| C3 | Create, list, update and delete through tRPC |
| C4 | List kept in memory, no database |
| C5 | No task created without a title |
| C6 | Meaningful errors, such as updating a task that does not exist |
| C7 | List page with SSR to preload the tasks, in a simple layout |
| C8 | Delete straight from the list, with a success or error message |
| C9 | Create and edit form with functional components and hooks |
| C10 | Form validation, blocking submission without a title |
| C11 | Error messages from backend and frontend, with loading, success and failure states |
| C12 | Bonus: infinite scroll on the list |
| C13 | Bonus: comments on the main decisions and a README |
| C14 | Public repository, with no sensitive information |

---

## 2. What was delivered

### 2.1 Case requirements

| # | How it was met | Where |
|---|---|---|
| C1 | Next.js 15.5 (App Router) and tRPC 11 with TanStack Query | `src/trpc/`, `src/app/api/trpc/` |
| C2 | `id` from `crypto.randomUUID()` and `dataCriacao` set by the server | `src/server/tasks/store.ts` |
| C3 | Procedures `list`, `get`, `create`, `update` and `delete` (plus `complete` and `move`, section 2.2) | `src/server/tasks/router.ts` |
| C4 | In-memory `Map` in the server process | `src/server/tasks/store.ts` |
| C5 | The same Zod schema validates in the form and on the server | `src/server/tasks/schema.ts` |
| C6 | `NOT_FOUND` for a missing `id`, `BAD_REQUEST` with the error for each field | `src/server/tasks/router.ts`, `src/server/trpc.ts` |
| C7 | A Server Component fetches the first page and hands the hydrated cache to the client | `src/app/page.tsx` |
| C8 | Confirmation in a dialog, then optimistic delete: the task leaves at once and comes back with a notice if the server refuses | `src/components/ConfirmDelete.tsx`, `src/components/TaskList.tsx` |
| C9 | A single `TaskForm` to create and edit, with `useState` | `src/components/TaskForm.tsx` |
| C10 | Submission blocked with an empty title, error shown under the field | `src/components/TaskForm.tsx` |
| C11 | Buttons disabled while saving, floating success and error notices, empty and failure states | `src/components/Toasts.tsx`, `src/components/` |
| C12 | `useInfiniteQuery` with cursor pagination and `IntersectionObserver` | `src/components/TaskList.tsx` |
| C13 | Comments at the decision points, the README and this document | the whole repository |
| C14 | Fictional sample tasks, no key or secret in the repository | section 6.4 |

### 2.2 Beyond the case

| What | Why |
|---|---|
| `concluida` and `dataConclusao` fields, and the `complete` procedure | The most common action on a task list, and the time records when it happened. The case asks for "at least" the four fields, so the model can grow |
| Confirmation before deleting | Deleting cannot be undone. A misclick must not erase a task |
| Manual order by dragging (`posicao` and `move`) | On a task list, order is priority. Works with mouse, touch and keyboard (section 3.6) |
| Floating notices | Fixed to the top of the window. A notice at the top of the list would go unseen by someone scrolled down |
| Back to the same spot after editing | Editing a task far down the list does not lose your place |
| One list per visitor | The address is public. With a single list, each person would see what the previous ones wrote (section 3.3) |
| Welcome panel and two sample tasks | A first-time visitor learns how to use the app without reading documentation, and the list never opens empty (section 3.8) |
| Own design system | Palette and typography inspired by Artefact's identity, as tokens (section 3.9) |
| Unit and browser tests | Vitest on the router, Playwright on the full flow of creating, editing, deleting and scrolling |
| Deployment to Cloud Run | The app is live, with an automatic deploy on every push to `main` |
| Infrastructure as Terraform | Every Google Cloud resource described in the repository |
| Protection against robots | Cloudflare in front, and the app rejects whatever skipped it (section 6.3) |

### 2.3 Naming

Code, comments and interface are in English. The task fields keep the
Portuguese names the case specifies (`titulo`, `descricao`, `dataCriacao`),
and the fields added beyond the case follow the same convention
(`concluida`, `dataConclusao`, `posicao`) so the model reads uniformly.

The Google Cloud resources (service `tarefas`, repository `servicos`, secret
`segredo-origem`) were created before the translation and keep their IDs:
renaming them would recreate the service and its domain certificate.

---

## 3. Application

### 3.1 Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | Next.js 15.5, App Router |
| API | tRPC 11 with `@trpc/tanstack-react-query` |
| Client cache | TanStack Query 5 |
| Validation | Zod 4 |
| Styling | Tailwind CSS 4 |
| Drag and drop | dnd-kit |
| Tests | Vitest and Playwright |

**Next.js 15, not 16:** the case pins version 15. The 15.5 line still
receives fixes.

### 3.2 Structure

```
src/
  server/
    tasks/schema.ts        Zod schemas and the Task type
    tasks/store.ts         in-memory Map, cursor pagination, manual order
    tasks/samples.ts       the two sample tasks of every new session
    tasks/router.ts        tRPC procedures
    tasks/router.test.ts   unit tests
    trpc.ts                tRPC setup, required session, change limit, error format
    context.ts             context for HTTP requests (reads the cookie)
    session.ts             cookie name, isolated for the middleware
    protection.ts          origin check and rate limiter
    root.ts                appRouter and the AppRouter type
  trpc/
    client.tsx             tRPC and QueryClient provider in the browser
    server.ts              calls and prefetch from Server Components
    query-client.ts        QueryClient setup, shared by both sides
  lib/
    constants.ts           page size, the same on the SSR and the client
    format.ts              dates in a fixed time zone, identical on server and browser
  app/
    api/trpc/[trpc]/route.ts   tRPC HTTP adapter
    api/health/route.ts        health check for the deploy
    page.tsx                   list
    tasks/new/page.tsx         create
    tasks/[id]/edit/page.tsx   edit
  components/
    TaskList.tsx
    TaskForm.tsx
    Toasts.tsx             floating notices, available to any component
    Welcome.tsx            first-visit panel
    ConfirmDelete.tsx      "Do you want to delete this task?" dialog
  middleware.ts            origin check and session cookie on the first visit
tests/
  e2e/                     Playwright tests
  playwright.config.ts
  vitest.config.ts         unit tests live in src/**/*.test.ts
infra/
  terraform/               Google Cloud resources
  docker/                  Dockerfile and Dockerfile.dockerignore
scripts/start.mjs          starts the standalone build locally
```

There is no `loading.tsx`. With it, Next starts streaming the page before it
finishes, and editing a missing task would answer 200 instead of 404. The
wait between saving the form and seeing the list is already shown by the
"Saving..." button.

### 3.3 In-memory state and sessions

The store is a `Map<session, Map<id, Task>>`, kept on `globalThis` to
survive `next dev` hot reloads.

On the first visit, `middleware.ts` sets the `session` cookie to a random
UUID (`HttpOnly`, `SameSite=Lax`, `Secure` in production). The tRPC context
reads that cookie, and every procedure works only on that session's list.

A cookie was chosen over `localStorage` because the server needs the tasks
at SSR time. `localStorage` only exists in the browser. The cookie reaches
the server on every request, including the first.

**Limits:** up to 500 sessions in memory (past that, the least recently used
one goes), up to 200 tasks per session, titles up to 120 characters and
descriptions up to 1000.

### 3.4 Model and procedures

```ts
type Task = {
  id: string;             // crypto.randomUUID()
  titulo: string;         // 1 to 120 characters, trimmed
  descricao?: string;     // up to 1000 characters
  concluida: boolean;     // every task starts pending
  dataConclusao?: string; // ISO 8601, set on completion and cleared on reopening
  dataCriacao: string;    // ISO 8601, set by the server
  posicao: number;        // manual order: lowest first
};
```

| Procedure | Type | Input | Errors |
|---|---|---|---|
| `tasks.list` | query | `{ cursor?, limit }` | `BAD_REQUEST` |
| `tasks.get` | query | `{ id }` | `NOT_FOUND` |
| `tasks.create` | mutation | `{ titulo, descricao? }` | `BAD_REQUEST`, `TOO_MANY_REQUESTS` |
| `tasks.update` | mutation | `{ id, titulo, descricao? }` | `BAD_REQUEST`, `NOT_FOUND` |
| `tasks.complete` | mutation | `{ id, concluida }` | `NOT_FOUND` |
| `tasks.move` | mutation | `{ id, after }` | `NOT_FOUND` |
| `tasks.delete` | mutation | `{ id }` | `NOT_FOUND` |

Every mutation also answers `TOO_MANY_REQUESTS` past the change limit
(section 6.3).

`complete` records `dataConclusao` with the server clock. Completing an
already completed task keeps the original time, and reopening clears it. On
screen, completion is optimistic with the browser's time, replaced by the
server's when the response arrives.

`list` returns `{ items, nextCursor }` in `posicao` order. The cursor is the
position and `id` of the last task delivered. With an offset, deleting a task
mid-scroll would shift the list and the next page would skip an item. With a
cursor, that does not happen.

### 3.5 Rendering

| Route | Strategy | Reason |
|---|---|---|
| `/` | SSR (`dynamic = 'force-dynamic'`) | Depends on each visitor's cookie. Without the flag, Next could render the page at build time |
| `/tasks/new` | Static | Depends on no data |
| `/tasks/[id]/edit` | SSR | Loads the task on the server, and a missing `id` becomes a 404 before reaching the client |

Dates are formatted in a fixed time zone (`America/Sao_Paulo`) and month
names come from the code, not from the runtime's locale data. The server
runs in UTC and the browser in local time; without this, both would produce
different text and React would report a hydration error.

**List flow:**

```
GET / request
   │  session cookie
   ▼
Server Component ── prefetchInfiniteQuery(tasks.list) ──► store (direct call, no HTTP)
   │  HTML with the first page + serialized cache
   ▼
browser ── HydrationBoundary ──► useInfiniteQuery starts from the cache, no refetch
   │  scroll reaches the end
   ▼
IntersectionObserver ──► GET /api/trpc/tasks.list?cursor=...
```

### 3.6 Manual order

Each task has a numeric `posicao`, and the list is sorted by it. A new task
gets a position before the first one and goes to the top.

`move({ id, after })` places the task right below `after`, or at the top with
`null`. The new position is the midpoint between the two neighbours, so only
the moved task changes. When the neighbours get too close for a number to fit
between them (less than 10⁻⁹), the whole list is renumbered.

On screen, dragging uses dnd-kit:

1. **A six-dot handle** on the left of each task. Only it starts a drag, so
   the checkbox, the links and scrolling on a phone keep working normally.
2. **Mouse and touch** start after 5px of movement, so a click on the handle
   does not become a drag.
3. **Keyboard:** focus the handle, space picks up, arrows move, space drops,
   Esc cancels. Screen reader announcements are customized.
4. **Optimistic:** the task stays where it was dropped, and the list reloads
   after the server responds. If it refuses, the previous order comes back,
   with a notice.

### 3.7 Delete confirmation

The Delete button opens a dialog: "Do you want to delete this task?", with the
task title and the Cancel and Delete buttons. It is the native `<dialog>`,
opened with `showModal()`: the browser traps focus inside it, closes it on
Esc, makes the rest of the page inert and returns focus to the button that
opened it. Focus starts on Cancel, the option that destroys nothing. Only the
confirmation calls the `delete` procedure.

### 3.8 First visit

On the first visit, the list opens with a welcome panel that explains in six
steps how to complete, create, edit, delete, reorder and scroll. When closed,
a `welcome` cookie records that it was seen. The server decides whether to
show the panel, by reading that cookie during SSR, so the page arrives with
or without it and nothing flickers.

The "How to use" link in the header reopens the panel. On the list page it
does so in place: it fires an event the mounted panel answers, with no
navigation that could race with a quick close-then-click. From any other
page it opens the list with `?help=1`, and closing the panel cleans the URL
with `history.replaceState`.

Every new session starts with two sample tasks ("Mark this task as
completed", "Drag this task above the other one"): enough to try completing,
dragging, editing and deleting right away, and the minimum for dragging to
make sense. The list loads 10 tasks at a time, so the infinite scroll shows
up once more than 10 tasks exist; the welcome panel says so.

### 3.9 Design system

Tailwind 4 tokens, declared in `@theme` in `src/app/globals.css`. No
component uses a colour outside them.

| Token | Value | Use |
|---|---|---|
| `navy` | `#002244` | Header, main text, welcome panel |
| `navy-deep` | `#00162e` | Background in dark mode (off) |
| `navy-surface` | `#0a2e55` | Cards in dark mode (off) |
| `magenta` | `#ff0066` | Full stop of titles, border of pending tasks |
| `magenta-strong` | `#e0005c` | Buttons and links |
| `magenta-light` | `#ff5c9d` | Links in dark mode (off) |
| `teal` | `#65cccc` | Completed tasks, panel numbers, Edit button |
| `teal-dark` | `#2ab6bf` | Focus outline, success notice border |
| `mist` | `#f0f0f0` | Background in light mode |
| `error` | `#c4231a` | Error messages, delete confirmation button |

**Typography:** Roboto (300, 400, 500 and 700), with the font files in the
repository (`src/app/fonts/`), served by the app itself through
`next/font/local`. The build does not depend on Google Fonts. Titles in
weight 300.

**Contrast:** the brand magenta with white text is 3.9:1, below the 4.5:1
required for small text. Buttons and links use `magenta-strong` (4.9:1), and
pure magenta is kept for decorative details.

**Components** (`@layer components`): `page-title` (with the magenta full
stop), `btn-primary`, `btn-danger`, `btn-secondary`, `action-link`, `card`,
`field`, `text-muted` and `lambda`, the triangle with a magenta glow drawn in
CSS.

**Brand:** the interface uses the palette and typography, but not the
company's logo or name as the product's brand.

**Light theme only**, as in the brand's slides, even on devices set to dark
mode. The `dark:` styles stay in the code but never apply: the dark variant
is tied to a `dark` class the app does not set.

---

## 4. Infrastructure

### 4.1 Overview

```
push to main (guistreahl/artefact-case)
   │
   ▼
GitHub Actions ──OIDC──► Workload Identity Federation
   │                         accepts only this repository, on main
   │                         ▼
   │                     "deploy" service account
   ▼
docker build ──► Artifact Registry   servicos/tarefas:<sha>
                         │
                         ▼
                 Cloud Run "tarefas" (us-central1)
                 runtime identity "tarefas-run"
                         ▲
Cloudflare (proxy): robot challenge, per-IP limit, secret header
   ▲
DNS: CNAME gerenciador ► ghs.googlehosted.com + Cloud Run domain mapping
```

### 4.2 Resources

All described in Terraform, in `infra/terraform/`.

| Resource | Configuration |
|---|---|
| APIs | Cloud Run, Artifact Registry, IAM, IAM Credentials, STS, Secret Manager |
| Artifact Registry | Docker repository `servicos`, keeps the 10 most recent images |
| `deploy` service account | Pushes images to the repository and revisions to the service. Nothing else |
| `tarefas-run` service account | The container's identity. Only reads the origin secret |
| Secret Manager | `segredo-origem`, generated by Terraform (section 6.3) |
| Workload Identity | Pool and provider for GitHub's OIDC issuer |
| Cloud Run `tarefas` | At most 1 instance, at least 0, 512 MiB, 1 vCPU, public access, TCP startup probe |
| Domain mapping | `gerenciador.guistreahl.com.br` |

The project and its billing stay outside Terraform, because they depend on
the billing account. The Terraform state lives in a versioned GCS bucket. The
Google provider is pinned to `~> 8.4`, with `.terraform.lock.hcl` committed
for Linux, Windows and macOS.

**The image belongs to the pipeline, not to Terraform.** The service is
created with a placeholder image, and Terraform ignores image and traffic
changes. Without that, every `terraform apply` would undo the last deploy.

### 4.3 A single instance

Each Cloud Run instance has its own memory. With two, a task created on one
instance would not show up for a request served by the other. So the
service runs at most one instance, which handles up to 80 concurrent
requests.

With a minimum of zero, Cloud Run shuts the instance down after a few
minutes without traffic, and the memory goes with it. The next visit finds
the list reset to the sample tasks. The case does not require persistence,
and this is expected behaviour.

### 4.4 Image

`infra/docker/Dockerfile`, in three stages (deps, build, runtime) on
`node:22-alpine`, using Next's `output: 'standalone'`. The final image runs
as an unprivileged user and listens on the port given in `PORT`.

`npm start` runs that same standalone server, so the CI browser tests run
against what goes into the image.

---

## 5. Pipeline

### `ci.yml`: every pull request and every push

Three jobs in parallel:

| Job | What it does |
|---|---|
| `verify` | `npm ci`, lint, types, Vitest, `next build` and Playwright against the build |
| `image` | Builds the Docker image, starts a container and waits for `/api/health` |
| `infra` | `terraform fmt`, `init` without backend and `validate` |

### `deploy.yml`: push to `main`, after CI passes

Runs queued, without cancelling, so the deploy of an older commit never
finishes after that of a newer one.

1. Authenticates to Google through Workload Identity
2. Builds the image and publishes it tagged with the commit
3. Creates the new revision **with no traffic**, on its own URL
4. Reads the origin secret from Secret Manager and runs Playwright against
   that URL, sending the header
5. Moves 100% of the traffic to the new revision
6. Checks `/api/health` on the service URL and, without blocking, the domain

If step 4 fails, the service stays on the previous revision.

---

## 6. Security

### 6.1 No service account key

GitHub proves via OIDC that the run came from this repository, and Google
returns a short-lived credential. There is no key to store or to leak.

### 6.2 Workload Identity condition

```
assertion.repository == 'guistreahl/artefact-case' &&
assertion.ref == 'refs/heads/main'
```

The repository condition stops any other repository from using this
identity. The branch condition stops a pull request from getting a
credential. Pull request CI does not need Google at all.

The three references the deploy uses (project, provider and service
account) are GitHub Variables. On their own they grant access to nothing.

### 6.3 Protection against robots and common attacks

The app is meant to be used by people only. There are three layers, from the
edge inwards:

**1. Cloudflare, with the proxy on for the `gerenciador` record**

| Setting | Effect |
|---|---|
| Custom rule: `http.host eq "gerenciador.guistreahl.com.br"` → *Managed Challenge* | Every visitor goes through Cloudflare's challenge, almost always without interaction. Robots stop here |
| Bot Fight Mode | Blocks known robots before the rule above |
| Rate limiting: `/api/trpc`, 100 requests in 10 s per IP → block | Contains bursts against the API |
| Transform Rule: adds `x-origin-secret: <secret>` | Proves to the app that the request went through Cloudflare |
| SSL *Full (strict)*, *Always Use HTTPS*, minimum TLS 1.2 | End-to-end encryption, with Google's certificate validated |

The proxy is only turned on after Google issues the domain certificate: with
it on from the start, Google's validation does not reach Cloud Run.

**2. Origin lock**

Cloud Run is still reachable through its `run.app` address and Google's IPs,
and a robot could get in there without going through Cloudflare. So
`middleware.ts` rejects with 403 every request without the `x-origin-secret`
header holding the right value, compared in constant time.

The secret is generated by Terraform (`random_password`), stored in Secret
Manager and handed to the container as an environment variable. It is not in
the repository. Without the variable (development, tests, anyone running the
project locally), the lock is off. Only `/api/health` is left out, and it
returns no data.

**3. In the app**

1. Up to 120 changes per minute per IP (`TOO_MANY_REQUESTS` past that). The
   counter lives in memory, which works because the service has a single
   instance.
2. Field size limits and a task limit per session (section 3.3).
3. `robots.txt` with `Disallow: /`, the `X-Robots-Tag: noindex` header and
   HSTS.

### 6.4 Public repository

No secrets, no personal data, no Terraform state files. Every sample task is
fictional.
