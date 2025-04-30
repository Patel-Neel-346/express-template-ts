import { NextFunction, Request, Response } from "express";
import Student from "../models/Students_Models";
import { AppError } from "../utils/Error_Handler";
import logger from "../config/logger";
interface StudentRequestBody {
    email: string;
    password: string;
    name: string;
    age: number;
    grade: string;
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

    const student = await Student.create({
        email,
        password,
        name,
        age,
        grade,
    });

    // const token = generateToken({
    //   id: student._id.toString(),
    //   email: student.email
    // });

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
    });
};

// export const getAllUser = async (req: Request, res: Response) => {
//     const userAll = await Student.find({});
//     // console.log(userAll)

//     // Log the retrieved users using a proper logging mechanism if needed
//     logger.info("User's", userAll);
//     return res.status(200).json({
//         status: "Success",
//         userAll,
//     });
// };
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
