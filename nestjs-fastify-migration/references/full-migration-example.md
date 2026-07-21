# Full Worked Example: One Express Route → Full Nest Feature

This shows every piece from the other references combined on one realistic slice, so you can see how they fit together. Use this as the template shape when converting a real feature from the user's codebase.

## Before: Express + Mongoose + Winston + Nodemailer

```ts
// routes/orders.ts
import { Router } from 'express';
import { Order } from '../models/order.model';
import { logger } from '../logger'; // winston
import { transporter } from '../mailer';

const router = Router();

router.post('/orders', authMiddleware, async (req, res) => {
  const { userId, items } = req.body;
  if (!userId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'invalid payload' });
  }

  try {
    const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const order = await Order.create({ userId, items, total, status: 'pending' });

    logger.info(`Order ${order._id} created for user ${userId}`);

    await transporter.sendMail({
      to: req.user.email,
      subject: 'Order confirmed',
      html: `<p>Your order ${order._id} is confirmed.</p>`,
    });

    res.status(201).json(order);
  } catch (err) {
    logger.error(`Order creation failed: ${err.message}`);
    res.status(500).json({ error: 'internal error' });
  }
});

export default router;
```

## After: NestJS + Fastify + Drizzle/Postgres + Zod + Resend + Pino

```ts
// orders/dto/create-order.schema.ts
import { z } from 'zod';

export const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z
    .array(z.object({ productId: z.string().uuid(), qty: z.number().int().positive(), price: z.number().positive() }))
    .min(1),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
```

```ts
// drizzle/schema/orders.schema.ts — see mongo-to-drizzle-postgres.md for full schema + relations
export const orders = pgTable('orders', { /* ...as in that reference... */ });
export const orderItems = pgTable('order_items', { /* ... */ });
```

```ts
// orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DrizzleService } from '../drizzle/drizzle.service';
import { EmailService } from '../email/email.service';
import { orders, orderItems } from '../drizzle/schema';
import { CreateOrderDto } from './dto/create-order.schema';

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DrizzleService,
    private readonly email: EmailService,
    @InjectPinoLogger(OrdersService.name) private readonly logger: PinoLogger,
  ) {}

  async create(dto: CreateOrderDto, userEmail: string) {
    const total = dto.items.reduce((sum, i) => sum + i.qty * i.price, 0);

    // Mongo had no transaction here (single doc write); Postgres splits
    // order + items across two tables, so this now needs a transaction
    // to stay atomic — an improvement the migration surfaces, not a
    // like-for-like port.
    const order = await this.db.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({ userId: dto.userId, total: total.toFixed(2), status: 'pending' })
        .returning();

      await tx.insert(orderItems).values(
        dto.items.map((i) => ({ ...i, orderId: created.id })),
      );

      return created;
    });

    this.logger.info({ orderId: order.id, userId: dto.userId }, 'Order created');

    // Transactional email — awaited inline so a Resend failure surfaces to
    // the caller rather than silently vanishing (see resend-email.md).
    await this.email.send({
      to: userEmail,
      subject: 'Order confirmed',
      html: `<p>Your order ${order.id} is confirmed.</p>`,
    });

    return order;
  }
}
```

```ts
// orders/orders.controller.ts
import { Body, Controller, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createOrderSchema, CreateOrderDto } from './dto/create-order.schema';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createOrderSchema))
  async create(@Body() body: CreateOrderDto, @Req() req: any) {
    return this.ordersService.create(body, req.user.email);
  }
}
```

```ts
// orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DrizzleModule, EmailModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
```

## What changed and why (the pattern to explain on every conversion)

- 400 hand-check → single Zod schema + pipe (`zod-validation.md`)
- Mongoose single-doc create → Postgres transaction across `orders` + `order_items` (`mongo-to-drizzle-postgres.md`) — atomicity now explicit instead of implicit-by-single-document
- Winston string log → structured Pino call with `orderId`/`userId` fields (`pino-logging.md`)
- Nodemailer `transporter.sendMail` → `EmailService.send` via Resend, still awaited inline since it's transactional (`resend-email.md`)
- try/catch + manual status codes → thrown exceptions caught by the global `AllExceptionsFilter` (`nestjs-fastify-setup.md`) — no per-route error branching needed
- `authMiddleware` → `AuthGuard` via `@UseGuards` (`nestjs-fastify-setup.md`)

When converting the user's real code, call out this same kind of before/after mapping briefly so they can verify nothing was silently dropped (especially hook logic, validation rules, and error handling paths).
