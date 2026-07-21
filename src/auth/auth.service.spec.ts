import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcryptjs";
import { getLoggerToken } from "nestjs-pino";

import { UsersService } from "../users/users.service";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
    let authService: AuthService;
    let usersService: jest.Mocked<UsersService>;
    let jwtService: jest.Mocked<JwtService>;

    const mockUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        password: "hashed-password",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    beforeEach(async () => {
        usersService = {
            create: jest.fn(),
            requireByEmail: jest.fn(),
            findById: jest.fn(),
            findByEmail: jest.fn(),
            getPasswordHash: jest.fn(),
        } as unknown as jest.Mocked<UsersService>;

        jwtService = {
            signAsync: jest.fn().mockResolvedValue("signed-token"),
        } as unknown as jest.Mocked<JwtService>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: usersService,
                },
                {
                    provide: JwtService,
                    useValue: jwtService,
                },
                {
                    provide: ConfigService,
                    useValue: {
                        getOrThrow: jest.fn((key: string) => {
                            if (key === "JWT_SECRET") return "test-secret";
                            if (key === "JWT_EXPIRES_IN") return "1d";
                            return undefined;
                        }),
                    },
                },
                {
                    provide: getLoggerToken(AuthService.name),
                    useValue: {
                        info: jest.fn(),
                        error: jest.fn(),
                    },
                },
            ],
        }).compile();

        authService = module.get(AuthService);
    });

    describe("register", () => {
        it("creates a user and returns a token", async () => {
            const safeUser = {
                id: mockUser.id,
                email: mockUser.email,
                name: mockUser.name,
                createdAt: mockUser.createdAt,
                updatedAt: mockUser.updatedAt,
            };

            usersService.create.mockResolvedValue(safeUser);

            const result = await authService.register({
                email: "test@example.com",
                password: "password123",
                name: "Test User",
            });

            expect(usersService.create).toHaveBeenCalledWith({
                email: "test@example.com",
                password: expect.any(String) as string,
                name: "Test User",
            });

            const createCall = usersService.create.mock.calls[0]?.[0];
            if (!createCall) {
                throw new Error("Expected create to be called");
            }

            const passwordMatches = await bcrypt.compare(
                "password123",
                createCall.password,
            );
            expect(passwordMatches).toBe(true);

            expect(jwtService.signAsync).toHaveBeenCalledWith(
                { sub: safeUser.id, email: safeUser.email },
                expect.objectContaining({ secret: "test-secret" }),
            );

            expect(result).toEqual({
                status: "success",
                data: { user: safeUser },
                token: "signed-token",
            });
        });

        it("propagates conflict when email already exists", async () => {
            usersService.create.mockRejectedValue(
                new ConflictException("Email already in use"),
            );

            await expect(
                authService.register({
                    email: "test@example.com",
                    password: "password123",
                    name: "Test User",
                }),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe("login", () => {
        it("returns a token for valid credentials", async () => {
            const hashedPassword = await bcrypt.hash("password123", 12);

            usersService.requireByEmail.mockResolvedValue({
                ...mockUser,
                password: hashedPassword,
            });

            usersService.findById.mockResolvedValue({
                id: mockUser.id,
                email: mockUser.email,
                name: mockUser.name,
                createdAt: mockUser.createdAt,
                updatedAt: mockUser.updatedAt,
            });

            const result = await authService.login({
                email: "test@example.com",
                password: "password123",
            });

            expect(result.status).toBe("success");
            expect(result.token).toBe("signed-token");
            expect(result.data.user.email).toBe("test@example.com");
        });

        it("throws when password is incorrect", async () => {
            const hashedPassword = await bcrypt.hash("password123", 12);

            usersService.requireByEmail.mockResolvedValue({
                ...mockUser,
                password: hashedPassword,
            });

            await expect(
                authService.login({
                    email: "test@example.com",
                    password: "wrong-password",
                }),
            ).rejects.toThrow(UnauthorizedException);
        });
    });
});
