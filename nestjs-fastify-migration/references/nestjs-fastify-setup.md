# NestJS on Fastify — Setup & Express Mapping

## Bootstrap (Fastify adapter, not Express)

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true }, // hold logs until Pino logger is attached
  );

  app.useLogger(app.get(Logger)); // nestjs-pino, see pino-logging.md

  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
```

Install: `@nestjs/core @nestjs/common @nestjs/platform-fastify fastify`

## Express concept → Nest/Fastify equivalent

| Express | NestJS/Fastify |
|---|---|
| `app.use(middleware)` | Global middleware (`app.use()` still works on Fastify adapter for simple cases) or, preferably, a `NestMiddleware` class applied via `configure()` in a module |
| `router.get('/x', handler)` | `@Get('x')` method in a `@Controller()` |
| `req.body` validation by hand / Joi | `ZodValidationPipe` on the route — see `zod-validation.md` |
| Auth middleware (`checkAuth`) | `Guard` (`@UseGuards(AuthGuard)`) implementing `CanActivate` |
| Response-shaping middleware / `res.locals` mutation | `Interceptor` implementing `NestInterceptor` |
| `try/catch` + `res.status(x).json(err)` per route | `ExceptionFilter` (`@Catch()`) — centralize once, don't repeat per route |
| `multer` for uploads | `@fastify/multipart` registered via `app.register()`, wrapped in a Nest interceptor if reused often |
| `helmet`, `cors`, `compression` (Express pkgs) | Fastify-native: `@fastify/helmet`, Nest's built-in `app.enableCors()`, `@fastify/compress` — do NOT install the Express versions, they assume the Express req/res shape |
| `express.Router()` per feature file | Nest `Module` per feature, with its own `Controller` + `Provider`s |
| Env config via `dotenv` + `process.env` scattered around | `@nestjs/config` (`ConfigModule.forRoot()`, injected `ConfigService`) — centralizes and types config access |

## Module/Controller/Service skeleton (what an Express router becomes)

Given an Express file like:

```ts
// express template: routes/orders.ts
router.get('/orders/:id', authMiddleware, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(order);
});
```

It becomes three files in an `orders` module:

```ts
// orders/orders.controller.ts
import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const order = await this.ordersService.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
```

```ts
// orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../drizzle/drizzle.service'; // see mongo-to-drizzle-postgres.md
import { orders } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class OrdersService {
  constructor(private readonly db: DrizzleService) {}

  async findById(id: string) {
    return this.db.query.orders.findFirst({ where: eq(orders.id, id) });
  }
}
```

```ts
// orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
```

Register `OrdersModule` in `AppModule.imports`.

## Global exception filter (replaces scattered try/catch)

```ts
// common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    reply.status(status).send({ statusCode: status, message });
  }
}
```

Register globally in `main.ts`: `app.useGlobalFilters(new AllExceptionsFilter());`

## Prefer `@nestjs/*` packages over generic npm equivalents

| Need | Use | Not |
|---|---|---|
| Config/env | `@nestjs/config` | raw `dotenv` scattered in files |
| Scheduled jobs/cron | `@nestjs/schedule` | `node-cron` wired manually |
| Rate limiting | `@nestjs/throttler` | `express-rate-limit` |
| OpenAPI/Swagger docs | `@nestjs/swagger` | hand-written swagger JSON |
| Event emitter / internal pub-sub | `@nestjs/event-emitter` | raw Node `EventEmitter` singleton |
| Caching | `@nestjs/cache-manager` | ad hoc in-memory Map cache |
| Testing | `@nestjs/testing` (`Test.createTestingModule`) | manually instantiating classes in tests |
