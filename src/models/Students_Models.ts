import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";
// import { NextFunction } from "express";
export interface IStudent extends Document {
    email: string;
    password: string;
    name: string;
    age: number;
    grade: string;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const StudentSchema: Schema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        name: {
            type: String,
            required: true,
        },

        age: {
            type: Number,
            required: true,
        },
        grade: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

StudentSchema.pre<IStudent>("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 12);
    next();
});

StudentSchema.methods.comparePassword = async function (
    candidatePassword: string,
): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password as string);
};

const Student = mongoose.model<IStudent>("Student", StudentSchema);

export default Student;
