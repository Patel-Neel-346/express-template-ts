import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

import type { Env } from "../config/env.schema";
import { UsersService } from "../users/users.service";

import type { LoginDto } from "./dto/login.schema";
import type { RegisterDto } from "./dto/register.schema";

export interface AuthResponse {
    status: string;
    data: {
        user: {
            id: string;
            email: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        };
    };
    token: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService<Env, true>,
        @InjectPinoLogger(AuthService.name)
        private readonly logger: PinoLogger,
    ) {}

    async register(dto: RegisterDto): Promise<AuthResponse> {
        const hashedPassword = await bcrypt.hash(dto.password, 12);

        const user = await this.usersService.create({
            email: dto.email,
            password: hashedPassword,
            name: dto.name,
        });

        const token = await this.signToken(user.id, user.email);

        this.logger.info({ userId: user.id }, "User registered");

        return {
            status: "success",
            data: { user },
            token,
        };
    }

    async login(dto: LoginDto): Promise<AuthResponse> {
        const user = await this.usersService.requireByEmail(dto.email);

        const isPasswordCorrect = await bcrypt.compare(
            dto.password,
            user.password,
        );

        if (!isPasswordCorrect) {
            throw new UnauthorizedException("Password is incorrect");
        }

        const token = await this.signToken(user.id, user.email);
        const safeUser = await this.usersService.findById(user.id);

        if (!safeUser) {
            throw new UnauthorizedException("User does not exist");
        }

        this.logger.info({ userId: user.id }, "User logged in");

        return {
            status: "success",
            data: { user: safeUser },
            token,
        };
    }

    private signToken(userId: string, email: string): Promise<string> {
        return this.jwtService.signAsync(
            { sub: userId, email },
            {
                secret: this.config.getOrThrow("JWT_SECRET"),
                expiresIn: this.config.getOrThrow("JWT_EXPIRES_IN"),
            },
        );
    }
}
