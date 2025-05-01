import { Request, Response, NextFunction } from "express";
import Student from "../models/Students_Models";
import { verifyToken } from "../middleware/auth_middleware";
import { AppError } from "../utils/Error_Handler";

// Type definitions

interface AuthenticatedRequest extends Request {
    student?: InstanceType<typeof Student>;
}

export const protect = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    try {
        // 1. Get token from header
        let token: string | undefined;
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        // 2. Verify token exists
        if (!token) {
            throw new AppError("Please log in to access this resource", 401);
        }

        // 3. Verify token validity
        const decoded = verifyToken(token);

        // Type guard for decoded token
        if (typeof decoded === "string" || !("id" in decoded)) {
            throw new AppError("Invalid token payload", 401);
        }

        // 4. Check if student still exists
        const currentStudent = await Student.findById(decoded.id);
        if (!currentStudent) {
            throw new AppError(
                "The student belonging to this token no longer exists",
                401,
            );
        }

        // 5. Grant access to protected route
        req.student = currentStudent;
        next();
    } catch (err) {
        next(err);
    }
};
