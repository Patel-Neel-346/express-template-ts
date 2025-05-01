import { NextFunction, Request, Response } from "express";
import Student from "../models/Students_Models";
import { AppError } from "../utils/Error_Handler";
import logger from "../config/logger";
import { generateToken } from "../middleware/auth_middleware";
interface StudentRequestBody {
    email: string;
    password: string;
    name?: string;
    age?: number;
    grade?: string;
}

export const register = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const { email, password, name, age, grade } =
        req.body as StudentRequestBody;

    // Check if student already exists
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
        return next(new AppError("Email already in use", 400));
    }

    const student = (await Student.create({
        email,
        password,
        name,
        age,
        grade,
    })) as {
        _id: string;
        email: string;
        name: string;
        age: number;
        grade: string;
        password: string;
    };

    const token = generateToken({
        id: student._id,
        email: student.email,
    });

    return res.status(201).json({
        status: "success",
        data: {
            student: {
                _id: student._id,
                email: student.email,
                name: student.name,
                age: student.age,
                grade: student.grade,
                password: student.password,
            },
        },
        token,
    });
};

export const login = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const { email, password } = req.body as StudentRequestBody;

    if (!email && !password) {
        return next(new AppError("pls Provide Email & Password", 400));
    }

    const user = await Student.findOne({ email }).select("+password");

    if (!user) {
        return next(new AppError("user does not Exits", 404));
    }

    const token = generateToken({
        id: user._id,
        email: user.email,
    });

    const IsPasswordCorrect = await user.comparePassword(password);

    if (!IsPasswordCorrect) {
        return next(new AppError("password is Incorrect", 404));
    }

    return res.status(200).json({
        Status: "Success",
        Message: "User SuccessFully Login Into System",
        user,
        token,
    });
};

export const getAllUser = async (req: Request, res: Response) => {
    const userAll = await Student.find({});

    // Print the retrieved users to the console for debugging
    // console.log("Retrieved Users:", userAll);

    // Log the retrieved users using a proper logging mechanism if needed
    logger.info("User's", userAll);
    return res.status(200).json({
        status: "Success",
        userAll,
    });
};
