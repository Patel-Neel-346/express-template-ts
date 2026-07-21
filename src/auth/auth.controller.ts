import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UsePipes,
} from "@nestjs/common";

import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

import { AuthService } from "./auth.service";
import { loginSchema, type LoginDto } from "./dto/login.schema";
import { registerSchema, type RegisterDto } from "./dto/register.schema";

@Public()
@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post("register")
    @HttpCode(HttpStatus.CREATED)
    @UsePipes(new ZodValidationPipe(registerSchema))
    register(@Body() body: RegisterDto) {
        return this.authService.register(body);
    }

    @Post("login")
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ZodValidationPipe(loginSchema))
    login(@Body() body: LoginDto) {
        return this.authService.login(body);
    }
}
