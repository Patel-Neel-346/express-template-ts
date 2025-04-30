import app from "./app";
import connectDB from "./config/db";
import logger from "./config/logger";

const startServer = async () => {
    const PORT = 5502;
    try {
        await connectDB();
        app.listen(PORT, () => logger.info(`Listening on port ${PORT}`));
    } catch (err: unknown) {
        if (err instanceof Error) {
            logger.error(err.message);
            logger.on("finish", () => {
                process.exit(1);
            });
        }
    }
};

void startServer();
