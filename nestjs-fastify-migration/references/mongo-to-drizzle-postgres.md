# MongoDB/Mongoose → PostgreSQL/Drizzle Migration

## Setup

Install: `drizzle-orm postgres` (or `pg`) and dev dep `drizzle-kit`.

```ts
// drizzle/drizzle.module.ts
import { Global, Module } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';

@Global()
@Module({
  providers: [DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
```

```ts
// drizzle/drizzle.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DrizzleService extends class {} implements OnModuleDestroy {
  public db: PostgresJsDatabase<typeof schema>;
  private client: postgres.Sql;

  constructor(config: ConfigService) {
    super();
    this.client = postgres(config.getOrThrow('DATABASE_URL'));
    this.db = drizzle(this.client, { schema });
  }

  // convenience: inject DrizzleService then use this.db.query... / this.db.insert...
  get query() {
    return this.db.query;
  }

  async onModuleDestroy() {
    await this.client.end();
  }
}
```

(If you prefer, expose `db` directly instead of a wrapper — either is fine, keep it consistent across the codebase.)

## Schema mapping: Mongoose → Drizzle

```ts
// BEFORE — mongoose
const orderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'paid', 'shipped'], default: 'pending' },
  total: { type: Number, required: true },
  items: [{ productId: Schema.Types.ObjectId, qty: Number, price: Number }],
  createdAt: { type: Date, default: Date.now },
});
```

```ts
// AFTER — drizzle/schema.ts
import { pgTable, uuid, pgEnum, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.schema';

export const orderStatusEnum = pgEnum('order_status', ['pending', 'paid', 'shipped']);

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: orderStatusEnum('status').notNull().default('pending'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Mongo embedded array `items` → real join table, not jsonb, because it's
// queried/aggregated independently (reporting, per-item refunds, etc).
// If items were purely display data never queried on their own, jsonb would
// be the lighter-weight choice — call this tradeoff out to the user explicitly.
export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull(),
  qty: integer('qty').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
});

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));
```

**Embedded doc/array decision rule:** if the nested data is queried, filtered, joined, or aggregated independently → join table. If it's opaque, display-only, schema-flexible payload (e.g. a webhook payload snapshot, arbitrary metadata) → `jsonb` column. State which one you're picking and why when it's not obvious.

## Query mapping

```ts
// Mongoose
await Order.findById(id);
await Order.find({ userId, status: 'pending' }).sort({ createdAt: -1 }).limit(10);
await Order.findByIdAndUpdate(id, { status: 'paid' });
await Order.create({ userId, total, status: 'pending' });
const order = await Order.findById(id).populate('userId');

// Drizzle equivalent
await db.query.orders.findFirst({ where: eq(orders.id, id) });

await db.query.orders.findMany({
  where: and(eq(orders.userId, userId), eq(orders.status, 'pending')),
  orderBy: desc(orders.createdAt),
  limit: 10,
});

await db.update(orders).set({ status: 'paid' }).where(eq(orders.id, id));

await db.insert(orders).values({ userId, total, status: 'pending' }).returning();

const order = await db.query.orders.findFirst({
  where: eq(orders.id, id),
  with: { user: true }, // relational query API replaces populate()
});
```

## Transactions (Mongo sessions → Postgres transactions — now a first-class feature, use it)

Mongo transactions were often skipped in the template because Mongoose sessions are clunky. Postgres transactions are cheap and idiomatic — use them anywhere multiple writes must be atomic (this is usually a net improvement over the Mongo version):

```ts
await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values({ userId, total, status: 'pending' }).returning();
  await tx.insert(orderItems).values(items.map((i) => ({ ...i, orderId: order.id })));
  return order;
});
```

## No schema hooks (`pre('save')`, `post('save')`) — make them explicit

Drizzle has no lifecycle hooks. Any Mongoose `pre('save')`/`post('save')` logic (hashing a password, computing a derived field, sending an event) moves into the service method, explicitly, before/after the `db.insert`/`db.update` call. Flag this migration point in a comment — it's easy to silently drop hook logic.

## Migrations

```bash
npx drizzle-kit generate   # generate SQL migration from schema diff
npx drizzle-kit migrate    # apply migrations
```

`drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/drizzle/schema/*.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

## ObjectId → UUID

Every Mongo `ObjectId` reference (`Schema.Types.ObjectId`, string IDs passed around as `_id`) becomes a Postgres `uuid` column (`defaultRandom()`). Update DTOs/Zod schemas accordingly (`z.string().uuid()` instead of a Mongo ObjectId regex check).
