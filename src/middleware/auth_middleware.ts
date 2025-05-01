import jwt, { Secret, JwtPayload } from "jsonwebtoken";

interface TokenPayload extends JwtPayload {
    id: string;
    email: string;
}

const JWT_SECRET: Secret = process.env.JWT_SECRET || "fallback_secret";
// const JWT_EXPIRES_IN: SignOptions["expiresIn"] = process.env.JWT_EXPIRES_IN || "1d";

export const generateToken = (
    payload: Omit<TokenPayload, keyof JwtPayload>,
): string => {
    try {
        return jwt.sign(payload, JWT_SECRET);
    } catch (error) {
        throw new Error(
            `Error generating token: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
};

export const verifyToken = (token: string): TokenPayload => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Type guard to ensure the decoded value matches our TokenPayload
        if (
            typeof decoded === "string" ||
            !decoded ||
            !("id" in decoded) ||
            !("email" in decoded)
        ) {
            throw new Error("Invalid token structure");
        }

        return decoded as TokenPayload;
    } catch (error) {
        throw new Error(
            `Invalid token: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
};
