import { ConfigModule } from "@nestjs/config";
import {
    FastifyAdapter,
    type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { LoggerModule } from "nestjs-pino";

import { AuthModule } from "../src/auth/auth.module";
import { AuthService } from "../src/auth/auth.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { envSchema } from "../src/config/env.schema";
import { DrizzleModule } from "../src/drizzle/drizzle.module";
import { DrizzleService } from "../src/drizzle/drizzle.service";

function getResponseBody(response: { json: () => unknown }): unknown {
    return response.json();
}

describe("Auth (e2e)", () => {
    let app: NestFastifyApplication;

    const mockSafeUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    validate: (config) =>
                        envSchema.parse({
                            ...config,
                            DATABASE_URL:
                                "postgresql://postgres:postgres@localhost:5432/test",
                            JWT_SECRET: "test-secret",
                        }),
                }),
                LoggerModule.forRoot({
                    pinoHttp: {
                        level: "silent",
                    },
                }),
                DrizzleModule,
                AuthModule,
            ],
        })
            .overrideProvider(DrizzleService)
            .useValue({
                db: {},
                onModuleDestroy: jest.fn(),
            })
            .overrideProvider(AuthService)
            .useValue({
                register: jest.fn().mockResolvedValue({
                    status: "success",
                    data: { user: mockSafeUser },
                    token: "signed-token",
                }),
                login: jest.fn().mockResolvedValue({
                    status: "success",
                    data: { user: mockSafeUser },
                    token: "signed-token",
                }),
            })
            .compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(
            new FastifyAdapter(),
        );
        app.setGlobalPrefix("api/v1");
        app.useGlobalFilters(new AllExceptionsFilter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterEach(async () => {
        await app.close();
    });

    it("POST /api/v1/auth/register returns 400 for invalid payload", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/register",
            payload: {
                email: "not-an-email",
                password: "short",
                name: "",
            },
        });

        expect(response.statusCode).toBe(400);
        const body = getResponseBody(response);
        expect(body).toMatchObject({
            statusCode: 400,
            message: expect.objectContaining({
                message: "Validation failed",
            }) as { message: string },
        });
    });

    it("POST /api/v1/auth/register returns success for valid payload", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/register",
            payload: {
                email: "test@example.com",
                password: "password123",
                name: "Test User",
            },
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            status: "success",
            data: {
                user: {
                    ...mockSafeUser,
                    createdAt: mockSafeUser.createdAt.toISOString(),
                    updatedAt: mockSafeUser.updatedAt.toISOString(),
                },
            },
            token: "signed-token",
        });
    });

    it("POST /api/v1/auth/login returns 400 for invalid payload", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
                email: "bad-email",
                password: "",
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it("POST /api/v1/auth/login returns success for valid payload", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
                email: "test@example.com",
                password: "password123",
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            status: "success",
            token: "signed-token",
        });
    });
});
