import { ConflictException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { DrizzleService } from "../drizzle/drizzle.service";
import type { User } from "../drizzle/schema/users.schema";

import { UsersService } from "./users.service";

describe("UsersService", () => {
    let usersService: UsersService;
    let findFirstMock: jest.Mock;
    let insertMock: jest.Mock;

    const mockUser: User = {
        id: "user-1",
        email: "test@example.com",
        password: "hashed-password",
        name: "Test User",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    beforeEach(async () => {
        findFirstMock = jest.fn();
        insertMock = jest.fn();

        const drizzleService = {
            db: {
                query: {
                    users: {
                        findFirst: findFirstMock,
                    },
                },
                insert: insertMock,
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: DrizzleService,
                    useValue: drizzleService,
                },
            ],
        }).compile();

        usersService = module.get(UsersService);
    });

    it("creates a user when email is available", async () => {
        findFirstMock.mockResolvedValue(undefined);
        insertMock.mockReturnValue({
            values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([mockUser]),
            }),
        });

        const result = await usersService.create({
            email: mockUser.email,
            password: mockUser.password,
            name: mockUser.name,
        });

        expect(result).toEqual({
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            createdAt: mockUser.createdAt,
            updatedAt: mockUser.updatedAt,
        });
        expect(result).not.toHaveProperty("password");
    });

    it("throws when email already exists", async () => {
        findFirstMock.mockResolvedValue(mockUser);

        await expect(
            usersService.create({
                email: mockUser.email,
                password: "secret",
                name: "Another User",
            }),
        ).rejects.toThrow(ConflictException);
    });
});
