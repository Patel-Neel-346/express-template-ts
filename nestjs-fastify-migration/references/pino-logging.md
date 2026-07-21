# Winston → Pino Migration (via nestjs-pino, Fastify-native)

Use `nestjs-pino` — it's the standard Nest integration, wires into Fastify's native logger (Fastify already uses Pino under the hood, so this avoids double-logging overhead), and gives request-scoped loggers with automatic request/response log lines.

## Setup

Install: `nestjs-pino pino-http pino-pretty` (pino-pretty is dev-only, for readable local logs — never enable pretty transport in production, it's slower and JSON-only is what your log aggregator wants).

```ts
// app.module.ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'], // don't log secrets
        genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
      },
    }),
    // ...other modules
  ],
})
export class AppModule {}
```

Wire into `main.ts` as shown in `nestjs-fastify-setup.md` (`app.useLogger(app.get(Logger))`, with `bufferLogs: true`).

## Converting call sites: Winston → Pino

```ts
// BEFORE — winston
logger.info(`Order ${order.id} created for user ${userId}`);
logger.error(`Failed to charge order ${order.id}: ${err.message}`, { error: err });
logger.warn('Low inventory', { productId, remaining });
```

```ts
// AFTER — pino, structured-first: message last, data as first arg object
// (this is the opposite argument order from console.log/most Winston usage —
// call this out explicitly when converting so it's not missed)
this.logger.log({ orderId: order.id, userId }, 'Order created');
this.logger.error({ orderId: order.id, err }, 'Failed to charge order');
this.logger.warn({ productId, remaining }, 'Low inventory');
```

In a Nest provider, inject Pino's logger rather than importing a singleton:

```ts
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class OrdersService {
  constructor(@InjectPinoLogger(OrdersService.name) private readonly logger: PinoLogger) {}

  async create(dto: CreateOrderDto) {
    this.logger.info({ userId: dto.userId }, 'Creating order');
    // ...
  }
}
```

## Mapping Winston concepts

| Winston | Pino/nestjs-pino |
|---|---|
| `winston.createLogger({ transports: [...] })` with multiple transports (console + file + external service) | Single JSON stream to stdout; ship to your log aggregator (Datadog, CloudWatch, etc.) at the infra level instead of multiple in-app transports — Pino's whole design philosophy is "just write JSON to stdout, let infra handle routing" |
| `logger.child({ requestId })` | Automatic — `nestjs-pino` already attaches a request-scoped child logger per HTTP request with the request ID; you don't need to manually thread it through for HTTP-triggered code |
| Custom log formats (`winston.format.combine(...)`) | Not needed — Pino's JSON output is the format; use `pino-pretty` only in dev for human-readable console output |
| `logger.profile()` / timing helpers | `logger.info({ durationMs }, 'operation completed')` — measure manually with `Date.now()`/`performance.now()`, Pino doesn't have a built-in timer helper |

## Correlation IDs across async/queue boundaries

If a log needs to follow a request into a background job (Kafka/RabbitMQ consumer, queued email send — see `node-backend-production`'s event-driven reference), don't rely on the auto-attached request-scoped logger — it dies with the request. Explicitly pass the correlation/request ID as a field on the job payload and log it manually on the consumer side:

```ts
this.logger.info({ correlationId: job.correlationId, jobId: job.id }, 'Processing queued job');
```
