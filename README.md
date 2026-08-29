# Smart Queue

Digital queue management for clinics, salons, restaurants, banks, and any
business that manages a physical waiting line.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Prisma 7 ·
PostgreSQL · Clerk · Zod

## What's implemented in this scaffold

- **Data model** (`prisma/schema.prisma`): User, Workspace, Business, Queue,
  QueueEntry — with the exact cascade/restrict rules, indexes, and the
  `(queueId, tokenNumber)` unique constraint from the spec. A `trackingToken`
  field was added to `QueueEntry` so the public tracking page never exposes
  data via a guessable primary key.
- **Multi-tenant authorization** (`src/lib/tenant.ts`): every workspace-scoped
  query resolves `workspaceId` from the authenticated user's session, never
  from client input. `getAuthorizedWorkspace/Business/Queue` are the only
  sanctioned entry points for tenant data.
- **Clerk auth**: `src/proxy.ts` middleware, `src/app/api/webhooks/clerk`
  (idempotent `upsert`-based user sync with svix signature verification),
  and a just-in-time sync fallback in `src/lib/auth.ts` for webhook lag.
- **Atomic token issuance** (`src/app/api/join/[queueId]/route.ts`): token
  number, position, and estimated wait are computed inside a single
  `prisma.$transaction`, backstopped by the DB-level unique constraint so
  concurrent joins can never collide.
- **Queue state machine** (`src/lib/queue-state.ts`): centralizes valid
  Queue and QueueEntry transitions so invalid ones (e.g. `DRAFT → CLOSED`)
  are rejected with 409s, not silently applied.
- **Staff actions API**: call / start serving / complete / skip / cancel /
  no-show / recall, with `totalServed` incremented transactionally on
  completion.
- **Public customer flow**: `/join/[queueId]` (join form) and
  `/track/[token]` (live status, looked up by the unguessable
  `trackingToken`, never the entry's DB id).
- **Dashboard**: real Prisma-backed stats and recent activity, with an
  explicit empty state for brand-new accounts (no hardcoded numbers).
- **Rate limiting**: in-memory fixed-window limiter on the public join
  endpoint (`src/lib/rate-limit.ts`) — swap for Upstash Redis when you scale
  beyond one instance.

## What you need to supply

This scaffold can't provision third-party accounts on your behalf. Before
running it:

1. **PostgreSQL** — a local instance for dev, a Supabase project for
   production. Put the connection string in `DATABASE_URL`.
2. **Clerk** — create an application at clerk.com, copy the publishable/secret
   keys, and create a webhook endpoint pointing at
   `https://<your-domain>/api/webhooks/clerk` subscribed to `user.created`
   and `user.updated`, then copy its signing secret into
   `CLERK_WEBHOOK_SECRET`.
3. Copy `.env.example` to `.env.local` and fill in the values above.

## Getting started

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed   # optional demo data
npm run dev
```

Visit `http://localhost:3000`.

## Not yet built (next milestones)

- Business/Queue create-and-edit UI forms (APIs exist; wire up the forms in
  `src/components/business` and `src/components/queue`)
- Staff live queue board UI (the action API at
  `src/app/api/queues/[queueId]/entries/[entryId]/action` is ready to call)
- Workspace switcher UI + `WorkspaceMember` table for staff-role invites
  (currently owner-only authorization in `tenant.ts`)
- Business/Queue archive flows, settings pages
- Deployment: connect this repo to Vercel, set the env vars above in the
  Vercel dashboard, and run `prisma migrate deploy` in your build step.

## Security notes

- Never query tenant-owned models by id alone — always go through
  `src/lib/tenant.ts` so the workspaceId comes from the session.
- The Clerk webhook verifies svix signatures and upserts on `clerkId`, so
  redelivery never creates duplicate users.
- Customer tracking uses a separate unguessable token, not the row's
  primary key.
