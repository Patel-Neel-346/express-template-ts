import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { DrizzleModule } from "../drizzle/drizzle.module";

import { HealthController } from "./health.controller";

@Module({
    imports: [TerminusModule, DrizzleModule],
    controllers: [HealthController],
})
export class HealthModule {}
