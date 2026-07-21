import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import { RequestMethod } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
    FastifyAdapter,
    type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, PinoLogger } from "nestjs-pino";

import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import type { Env } from "./config/env.schema";

process.on("unhandledRejection", (reason: unknown) => {
    console.error("Unhandled Promise Rejection:", reason);
    process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({ trustProxy: true }),
        { bufferLogs: true },
    );

    const logger = app.get(Logger);
    const pinoLogger = await app.resolve(PinoLogger);
    const config = app.get<ConfigService<Env, true>>(ConfigService);
    const port = config.getOrThrow<Env["PORT"]>("PORT");
    const corsOrigins = config
        .getOrThrow<Env["CORS_ORIGINS"]>("CORS_ORIGINS")
        .split(",")
        .map((origin: string) => origin.trim())
        .filter((origin: string) => origin.length > 0);

    app.useLogger(logger);
    app.enableShutdownHooks();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix("api/v1", {
        exclude: [
            {
                path: "health/live",
                method: RequestMethod.GET,
            },
            {
                path: "health/ready",
                method: RequestMethod.GET,
            },
        ],
    });

    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });

    await app.register(helmet);
    await app.register(compress);

    const fastify = app.getHttpAdapter().getInstance();
    fastify.server.requestTimeout =
        config.getOrThrow<Env["REQUEST_TIMEOUT_MS"]>("REQUEST_TIMEOUT_MS");

    await app.listen(port, "0.0.0.0");
    pinoLogger.info({ port }, "Application listening on port");

    const shutdown = async (signal: string): Promise<void> => {
        pinoLogger.info({ signal }, "Received shutdown signal");
        try {
            await app.close();
            pinoLogger.info("Graceful shutdown complete");
            process.exit(0);
        } catch (error: unknown) {
            pinoLogger.error(
                { err: error, signal },
                "Error during graceful shutdown",
            );
            process.exit(1);
        }
    };

    process.on("SIGTERM", () => {
        void shutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
        void shutdown("SIGINT");
    });
}

void bootstrap();
