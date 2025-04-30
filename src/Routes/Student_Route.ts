import express from "express";
import { getAllUser, register } from "../controller/Student_Controller";
import { catchAsync } from "../utils/Error_Handler";

const router = express.Router();

router.post("/register", catchAsync(register));

router.get("/get", catchAsync(getAllUser));

export default router;
