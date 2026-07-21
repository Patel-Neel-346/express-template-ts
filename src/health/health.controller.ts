import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { sql } from "drizzle-orm";

import { Public } from "../common/decorators/public.decorator";
import { DrizzleService } from "../drizzle/drizzle.service";

@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly drizzle: DrizzleService,
    ) {}

    @Get("live")
    liveness() {
        return { status: "ok" };
    }

    @Get("ready")
    @HealthCheck()
    readiness() {
        return this.health.check([
            async () => {
                await this.drizzle.db.execute(sql`select 1`);
                return { database: { status: "up" } };
            },
        ]);
    }
}
