---
name: nestjs-fastify-migration
description: Use this skill whenever converting/migrating an existing Express + Node.js + TypeScript backend into NestJS running on the Fastify adapter, or when scaffolding a new project in that target stack. Trigger this for requests like "convert this Express route/controller to NestJS", "migrate this to Fastify", "switch this from Mongoose/MongoDB to Postgres with Drizzle", "replace Winston with Pino", "replace this validation with Zod", "add Resend email sending", or "set up a new NestJS + Fastify project". Also trigger any time the user references their Express template codebase and wants it moved to NestJS. Covers: NestJS module/controller/service/provider structure, Fastify adapter setup, Drizzle ORM schema + queries (replacing Mongoose models), Zod-based validation (replacing class-validator or manual checks), Resend transactional email, and Pino structured logging (replacing Winston). Do NOT use for general Express-only backend architecture questions unrelated to this migration — use node-backend-production for that instead.
---

# Express → NestJS + Fastify Migration Architect

This skill encodes the exact target stack for this user's next project and how to migrate an existing Express/TypeScript template into it, piece by piece.

## Target stack (always assume this unless told otherwise)

| Concern | From (template) | To (target) |
|---|---|---|
| Framework | Express | **NestJS** on the **Fastify** adapter (`@nestjs/platform-fastify`) |
| HTTP primitives | Express middleware/routers | Nest modules, controllers, providers, guards, interceptors, pipes |
| Database | MongoDB (Mongoose) | **PostgreSQL** |
| ORM/query layer | Mongoose schemas/models | **Drizzle ORM** (schema-first, SQL-typed) |
| Validation | Manual checks / Joi / express-validator | **Zod**, wired via Nest's `ZodValidationPipe` (nestjs-zod or custom pipe) — not class-validator/DTO decorators |
| Email | Nodemailer/SMTP or ad hoc | **Resend** (`resend` npm package) |
| Logging | Winston | **Pino** (`nestjs-pino` — Nest's official-recommended integration, Fastify-native) |
| Language | TypeScript | TypeScript (unchanged, but tighten types where Mongoose's looseness leaked through) |

**Use NestJS's own prebuilt libraries wherever one exists** instead of hand-rolling or pulling generic npm packages: `@nestjs/config`, `@nestjs/platform-fastify`, `@nestjs/swagger`, `@nestjs/throttler`, `@nestjs/schedule`, `@nestjs/event-emitter`, etc. Don't reach for a raw Express-ecosystem package when a `@nestjs/*` equivalent exists and fits — that's the whole point of this migration.

## Before converting any code: ask or infer

Don't rewrite a whole file blind. Before migrating a piece of the template:

1. **What's the current shape?** Look at the actual uploaded/pasted Express code — routes, Mongoose schemas, middleware — before proposing the Nest structure. Don't guess a schema; read theirs.
2. **Module boundary** — does this route/feature map to an existing Nest module in the target project, or does it need a new one (`nest g module X` equivalent by hand)? Infer from domain (e.g. `users`, `orders`) rather than dumping everything in `AppModule`.
3. **Is this a full-project migration or one feature at a time?** If the user pastes one Express router, migrate just that slice into a Nest module + Drizzle schema + Zod DTOs, not the whole app. If they want the whole template converted, ask for (or scan) the full file tree first.
4. **Existing Postgres schema or fresh design?** If migrating off Mongo, the Mongoose schema is your source of truth for fields, but flag any Mongo-isms that don't map cleanly to relational (embedded documents/arrays → decide: join table vs `jsonb` column — state the tradeoff, don't silently pick one for non-trivial cases).

If the user's request already gives you the code and the intent, don't re-ask — state the module/schema mapping you're using and proceed straight to code.

**Research trigger:** the architectural mapping below (Express→Nest, Mongoose→Drizzle, Winston→Pino) is stable and doesn't need lookup. But before pinning exact package names/versions (`@nestjs/platform-fastify` version compatibility with the user's Nest version, `drizzle-kit` CLI flags, `nestjs-pino` config shape, Resend SDK method signatures), web search first if precision matters — these APIs move faster than this skill's static knowledge.

## Decision tree — which reference to read

| User need | Read |
|---|---|
| Project scaffolding, module/controller/provider structure, Fastify adapter bootstrap, converting Express middleware → guards/interceptors/pipes | `references/nestjs-fastify-setup.md` |
| Converting Mongoose schemas/queries to Drizzle schema + queries, migrations, relations, transactions | `references/mongo-to-drizzle-postgres.md` |
| Replacing manual/Joi/class-validator validation with Zod DTOs and a Nest validation pipe | `references/zod-validation.md` |
| Sending email (transactional, templated) via Resend from a Nest service | `references/resend-email.md` |
| Swapping Winston for Pino, request logging, log levels, correlation IDs on Fastify | `references/pino-logging.md` |
| End-to-end worked example converting one full Express route → full Nest feature (all pieces together) | `references/full-migration-example.md` |

Read only what's relevant to the current chunk of work — don't load every reference to convert one small route.

## Core principles

- **Migrate feature-by-feature, not file-by-file.** A Mongoose model, its routes, and its validation usually belong to one Nest module. Convert them together so the module is complete and testable, not half-migrated.
- **Don't keep Mongo habits in Postgres.** No implicit schemaless fields, no `_id` as a string everywhere (use Postgres serial/uuid primary keys idiomatically), no unbounded embedded arrays that should be join tables.
- **Zod schemas are the single source of truth for validation** — infer TypeScript types from them (`z.infer<typeof schema>`) rather than maintaining separate interfaces/DTOs by hand. Don't mix in class-validator decorators.
- **Fastify, not Express, under the hood.** Don't reintroduce Express-only middleware (e.g. raw `multer`, Express-specific body parsers) — use the Fastify-native or `@nestjs/platform-fastify`-compatible equivalent, and say so if the user pastes Express middleware that needs a different Fastify plugin.
- **Structured logs only.** Every migrated log statement becomes a structured Pino call (`logger.info({ userId, orderId }, 'message')`), not string-concatenated Winston-style messages. Preserve log intent (level, what's being logged) but upgrade the shape.
- **Show the diff mentally, not just the destination.** When converting a specific file, briefly note what changed and why (e.g. "Mongoose `pre('save')` hook → Drizzle doesn't have hooks, so this becomes explicit logic in the service method before `insert`") so the user can trust the migration instead of just pattern-matching new code.

## Output format

For a full-project or full-feature conversion:
1. Brief note on module boundary/plan (what Nest module(s) this becomes)
2. The converted code, organized by file (schema → DTO/validation → service → controller → module), using real runnable code, not pseudocode
3. Call out any lossy or judgment-call conversions inline as comments (e.g. embedded doc → jsonb vs join table decision)

For a single-file/single-concern conversion (just "convert this Mongoose model" or "swap this logger call"), skip straight to the converted code with inline comments on the non-obvious mapping decisions.
