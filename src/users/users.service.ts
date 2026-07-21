import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DrizzleService } from "../drizzle/drizzle.service";
import { users, type User } from "../drizzle/schema/users.schema";

export interface CreateUserInput {
    email: string;
    password: string;
    name: string;
}

export type SafeUser = Omit<User, "password">;

@Injectable()
export class UsersService {
    constructor(private readonly drizzle: DrizzleService) {}

    async findByEmail(email: string): Promise<User | undefined> {
        return this.drizzle.db.query.users.findFirst({
            where: eq(users.email, email),
        });
    }

    async findById(id: string): Promise<SafeUser | undefined> {
        const user = await this.drizzle.db.query.users.findFirst({
            where: eq(users.id, id),
        });

        if (!user) {
            return undefined;
        }

        return this.toSafeUser(user);
    }

    async create(input: CreateUserInput): Promise<SafeUser> {
        const existing = await this.findByEmail(input.email);
        if (existing) {
            throw new ConflictException("Email already in use");
        }

        try {
            const [created] = await this.drizzle.db
                .insert(users)
                .values(input)
                .returning();

            if (!created) {
                throw new InternalServerErrorException("Failed to create user");
            }

            return this.toSafeUser(created);
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                "code" in error &&
                error.code === "23505"
            ) {
                throw new ConflictException("Email already in use");
            }

            throw error;
        }
    }

    async getPasswordHash(email: string): Promise<string | undefined> {
        const user = await this.drizzle.db.query.users.findFirst({
            where: eq(users.email, email),
            columns: { password: true },
        });

        return user?.password;
    }

    async requireByEmail(email: string): Promise<User> {
        const user = await this.findByEmail(email);
        if (!user) {
            throw new NotFoundException("User does not exist");
        }
        return user;
    }

    private toSafeUser(user: User): SafeUser {
        const { password, ...safeUser } = user;
        void password;
        return safeUser;
    }
}
