import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { AuthModule } from "./auth/auth.module";
import type { Env } from "./config/env.schema";
import { envSchema } from "./config/env.schema";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { HealthModule } from "./health/health.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: (config) => envSchema.parse(config),
        }),
        LoggerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService<Env, true>) => {
                const isProduction =
                    config.getOrThrow("NODE_ENV") === "production";

                return {
                    pinoHttp: {
                        level: isProduction ? "info" : "debug",
                        ...(isProduction
                            ? {}
                            : {
                                  transport: {
                                      target: "pino-pretty",
                                      options: { singleLine: true },
                                  },
                              }),
                        autoLogging: {
                            ignore: (request) =>
                                (request.url ?? "").startsWith("/health/") ||
                                (request.url ?? "").startsWith(
                                    "/api/v1/health/",
                                ),
                        },
                        redact: [
                            "req.headers.authorization",
                            "req.headers.cookie",
                        ],
                    },
                };
            },
        }),
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService<Env, true>) => [
                {
                    ttl: config.getOrThrow("THROTTLE_TTL_MS"),
                    limit: config.getOrThrow("THROTTLE_LIMIT"),
                },
            ],
        }),
        DrizzleModule,
        AuthModule,
        HealthModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {}
