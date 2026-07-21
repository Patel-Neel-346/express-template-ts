import { z } from "zod";

export const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    PORT: z.coerce.number().default(5502),
    DATABASE_URL: z.string().min(1),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    DB_IDLE_TIMEOUT: z.coerce.number().int().positive().default(30),
    DB_CONNECT_TIMEOUT: z.coerce.number().int().positive().default(10),
    DB_MAX_LIFETIME: z.coerce.number().int().positive().default(1800),
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRES_IN: z.string().default("1d"),
    CORS_ORIGINS: z
        .string()
        .default("http://localhost:3000,http://localhost:5173"),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;
