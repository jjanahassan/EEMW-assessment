import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { UnauthorizedError } from "../../errors/AppError";

export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "object" && typeof payload.sub === "string") return payload.sub;
  } catch {
    // fall through
  }
  throw new UnauthorizedError("Invalid or expired token");
}