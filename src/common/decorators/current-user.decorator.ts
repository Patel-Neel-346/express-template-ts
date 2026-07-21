import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { SafeUser } from "../../users/users.service";

export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): SafeUser | undefined => {
        const request = context
            .switchToHttp()
            .getRequest<{ user?: SafeUser }>();
        return request.user;
    },
);
