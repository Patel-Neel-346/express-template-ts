import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import postgres from "postgres";

import type { Env } from "../config/env.schema";

import * as schema from "./schema";

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
    public readonly db: PostgresJsDatabase<typeof schema>;
    private readonly client: ReturnType<typeof postgres>;

    constructor(
        private readonly config: ConfigService<Env, true>,
        @InjectPinoLogger(DrizzleService.name)
        private readonly logger: PinoLogger,
    ) {
        this.client = postgres(this.config.getOrThrow("DATABASE_URL"), {
            max: this.config.getOrThrow("DB_POOL_MAX"),
            idle_timeout: this.config.getOrThrow("DB_IDLE_TIMEOUT"),
            connect_timeout: this.config.getOrThrow("DB_CONNECT_TIMEOUT"),
            max_lifetime: this.config.getOrThrow("DB_MAX_LIFETIME"),
            onnotice: () => undefined,
        });
        this.db = drizzle(this.client, { schema });
    }

    async onModuleInit() {
        await this.connectWithRetry();
    }

    private async connectWithRetry(retries = 5, delayMs = 2000): Promise<void> {
        for (let attempt = 1; attempt <= retries; attempt += 1) {
            try {
                await this.client`select 1`;
                this.logger.info("Database connection established");
                return;
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);

                this.logger.warn(
                    {
                        attempt,
                        retries,
                        message,
                    },
                    "Database connection attempt failed",
                );

                if (attempt === retries) {
                    this.logger.error(
                        "Exhausted database connection retries, exiting",
                    );
                    throw error;
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, delayMs * attempt),
                );
            }
        }
    }

    async onModuleDestroy() {
        this.logger.info("Closing database connection pool");
        await this.client.end({ timeout: 5 });
    }
}
