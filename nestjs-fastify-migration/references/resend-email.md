# Resend Email in NestJS

## Setup

Install: `resend`. Add `RESEND_API_KEY` to env (validate via the env Zod schema — see `zod-validation.md`).

## Module + Service

```ts
// email/email.module.ts
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
```

```ts
// email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private resend: Resend;
  private readonly logger = new Logger(EmailService.name);

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow('RESEND_API_KEY'));
  }

  async send(params: { to: string; subject: string; html: string; from?: string }) {
    const { data, error } = await this.resend.emails.send({
      from: params.from ?? this.config.getOrThrow('EMAIL_FROM'),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      // don't swallow — this is exactly the kind of error that should be
      // typed/thrown, not silently logged and ignored (see error-handling
      // principle in node-backend-production skill)
      this.logger.error({ err: error, to: params.to }, 'Failed to send email');
      throw new Error(`Email send failed: ${error.message}`);
    }
    return data;
  }
}
```

## Converting from the template's mailer (Nodemailer/SMTP)

```ts
// BEFORE — nodemailer
await transporter.sendMail({
  from: 'noreply@app.com',
  to: user.email,
  subject: 'Order confirmed',
  html: renderTemplate('order-confirmed', { order }),
});
```

```ts
// AFTER
await this.emailService.send({
  to: user.email,
  subject: 'Order confirmed',
  html: renderOrderConfirmedTemplate(order), // keep existing template renderer if it's framework-agnostic
});
```

Nodemailer's HTML templating (whatever the template project used — handlebars, ejs, plain string building) doesn't need to change; only the transport/send call does. If it used React Email components, Resend has first-class support for that:

```ts
import { OrderConfirmedEmail } from './templates/order-confirmed';

await this.resend.emails.send({
  from,
  to,
  subject: 'Order confirmed',
  react: OrderConfirmedEmail({ order }), // resend renders React templates server-side
});
```

Mention this option if the user is open to React Email — it's a nicer authoring experience than string HTML, but don't force a template rewrite the user didn't ask for.

## Idempotency / retries

Resend calls are an external network call like any other — don't fire-and-forget inside a request path if the email is important (e.g. password reset, order confirmation). Either:
- await it inline and surface a failure to the caller, or
- queue it (fits the event-driven guidance in `node-backend-production`'s `event-driven-architecture.md` if this project already has a queue) so a transient Resend outage doesn't fail the whole request.

State which one applies given the email's importance — don't default to fire-and-forget for anything transactional.
