# AGENTS.md

## Stack

Express 5 · TypeScript · Prisma 7 · PostgreSQL · Redis · Cloudinary · Zod · JWT

## Setup (required after every fresh clone)

```bash
cp .env.example .env          # fill in real DB creds, JWT secrets, Redis, Cloudinary, SMTP
npm install
npx prisma generate           # generates src/generated/prisma/ — nothing compiles without it
npx prisma migrate dev        # creates tables from committed migrations
npm run dev                   # starts on :5000 with tsx watch
```

`src/generated/prisma/` is git-ignored. If you see `Cannot find module .../generated/prisma/client`, you forgot `npx prisma generate`.

## Required external services

App won't start without Postgres AND Redis. Nodemailer also verifies its connection at boot. All three must be reachable before `npm run dev` will bind.

## Commands

| What | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint check | `npm run lint:check` |
| Lint fix | `npm run lint:fix` |
| Format check | `npm run format:check` |
| Format fix | `npm run format:fix` |
| Typecheck (build) | `npm run build` |
| Prisma generate | `npx prisma generate` |
| Prisma migrate | `npx prisma migrate dev` |
| Prisma studio | `npx prisma studio` (opens :5555) |

No test suite exists. `npm test` is a placeholder.

## Code style

- **Formatter/Linter:** Biome (not ESLint/Prettier). Tabs for indentation, double quotes for strings.
- `noExplicitAny` is a **warning**, not an error — `any` is tolerated but discouraged.
- Unused function params are allowed (`noUnusedFunctionParameters: off`).

## Module pattern

Every feature lives in `src/app/module/<name>/` with up to 5 files:

| File | Owns |
|---|---|
| `<name>.route.ts` | Wires `auth(...roles)` + optional `validateRequest(schema)` to controller methods; exports `<Name>Routes` |
| `<name>.controller.ts` | Reads `req.body` / `req.user` / `req.file`, calls service, calls `sendResponse` |
| `<name>.service.ts` | All business logic and every Prisma call — never touches `req` or `res` |
| `<name>.interface.ts` | TypeScript types for payloads |
| `<name>.validation.ts` | Zod schemas; passed to `validateRequest()` middleware in the route file |

Mount new routes in `src/app.ts`:
```ts
app.use('/api/v1/<name>', <Name>Routes)
```

### Hard rules

- **Controllers never call Prisma directly.** Services never touch `req`/`res`. If a service needs caller info, accept `{ userId, email, name, role }`, not the Express request.
- **Never spread `req.body` into Prisma `create`/`update`.** Destructure exact fields. This is the only input validation for endpoints without a Zod schema.
- **`validateRequest(zodSchema)`** exists (`src/app/middleware/validateRequest.ts`) — use it in routes that need input validation. It replaces `req.body` with the parsed/trimmed output.

## Shared utilities

- `catchAsync(fn)` — wraps async handlers so thrown errors reach `globalErrorHandler`. Every controller method must use it.
- `sendResponse(res, { statusCode, success, message, data, meta? })` — standard JSON envelope.
- `auth(...roles)` — JWT + role guard. Reads token from cookie then `Authorization` header. Populates `req.user`.
- `prisma` — singleton PrismaClient from `src/app/lib/prisma.ts`. Always import this; never `new PrismaClient()`.

## Prisma schema

Split across `prisma/schema/*.prisma`, stitched by `prisma.config.ts` at the repo root. After editing any `.prisma` file, run `npx prisma generate` and `npx prisma migrate dev`.

## Gotchas

- **All errors return HTTP 500** regardless of actual cause. The real status code is in the response body's `statusCode` field; read `message` to see what happened.
- **Cookies are broken.** `accessToken`/`refreshToken` cookies use `sameSite: "none"` with `secure: false`, which browsers silently reject. Use the JSON body for tokens instead.
- **No env validation on startup.** Missing env vars silently become `undefined`. The app boots; it blows up at the first runtime use (usually login).
- **`BCRYPT_SALT_ROUNDS` is read but unused.** Password hashing in `auth.service.ts` hardcodes `8` (or uses the value in `seed.ts` for the super admin).
- **Soft-delete columns exist** (`isDeleted`, `deletedAt`) on User and Patient, but nothing in the codebase sets them yet.
- **`npm run build` output isn't runnable.** Extensionless relative imports (`from './app'`) fail under Node's native ESM loader. Use `npm run dev` (tsx) for execution.
- **Super admin is auto-seeded** at boot from `SUPER_ADMIN_*` env vars via `src/app/utils/seed.ts`.
