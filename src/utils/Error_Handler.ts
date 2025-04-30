export class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

//   export const catchAsync = (async(fn: (req: unknown, res: unknown, next: unknown) => Promise<unknown>) => {
//     return (req: unknown, res: unknown, next: unknown) => {
//      await fn(req, res, next).catch(next);
//     };
//   };

import { Request, Response, NextFunction } from "express";

export const catchAsync = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    };
};
