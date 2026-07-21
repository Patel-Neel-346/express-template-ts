# Zod Validation in NestJS (replacing manual checks / Joi / class-validator)

Don't use `class-validator` + `class-transformer` DTOs even though that's Nest's "default" docs example — this project standardizes on Zod for schema + inferred types.

## Setup

Install: `zod` (and optionally `nestjs-zod` if the user wants the pre-built pipe/decorator sugar — otherwise a small custom pipe, shown below, is enough and keeps the dependency footprint down. Mention both options; default to the custom pipe unless the user says they want the library.)

## Custom ZodValidationPipe

```ts
// common/pipes/zod-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.flatten(),
      });
    }
    return result.data;
  }
}
```

## Schema = DTO = type (single source of truth)

```ts
// orders/dto/create-order.schema.ts
import { z } from 'zod';

export const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().positive(),
        price: z.number().positive(),
      }),
    )
    .min(1),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
```

## Usage on a route

```ts
@Post()
@UsePipes(new ZodValidationPipe(createOrderSchema))
async create(@Body() body: CreateOrderDto) {
  return this.ordersService.create(body);
}
```

For query params / path params, apply the same pipe to `@Query()`/`@Param()` with a schema matching that shape.

## Converting from the Express template's validation

```ts
// BEFORE — manual checks in an Express handler
if (!req.body.userId || typeof req.body.userId !== 'string') {
  return res.status(400).json({ error: 'userId required' });
}
if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
  return res.status(400).json({ error: 'items required' });
}
```

```ts
// AFTER — one Zod schema replaces every manual `if` block, errors are
// structured automatically via the pipe's BadRequestException above
export const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(itemSchema).min(1, 'items required'),
});
```

If the template used Joi, the mapping is close to 1:1 (`Joi.string().required()` → `z.string()`, Joi schemas are already declarative) — mostly a syntax port, call that out so the user knows it's low-risk.

## Env var validation (bonus, fits the same pattern)

Pair with `@nestjs/config`'s `validate` option instead of trusting `process.env` unchecked:

```ts
// config/env.schema.ts
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  RESEND_API_KEY: z.string(),
  PORT: z.coerce.number().default(3000),
});

// app.module.ts
ConfigModule.forRoot({
  validate: (config) => envSchema.parse(config),
}),
```

## Global pipe vs per-route

A single global `ZodValidationPipe` can't work generically the way Nest's global `ValidationPipe` does for class-validator, because each route needs its *own* schema instance. Keep it per-route (`@UsePipes(new ZodValidationPipe(schema))`) unless using `nestjs-zod`'s `ZodValidationPipe` + `@nestjs/zod`'s DTO class wrapper, which does support a global pipe by attaching the schema as metadata — mention this as the upgrade path if the user gets tired of repeating `@UsePipes` on every route.
