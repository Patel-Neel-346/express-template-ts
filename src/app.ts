import express, { Request, Response } from "express";
import { globalErrorHandler } from "./common/middlewares/globalErrorHandler";
import router from "./Routes/Student_Route";
// import { request } from "http";

const app = express();

app.use(express.json());
app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
});
app.get("/hello", (req: Request, res: Response) => {
    res.send("Hello Neel Patel");
});
app.use(globalErrorHandler);
app.use("/api/v1/student", router);

export default app;
