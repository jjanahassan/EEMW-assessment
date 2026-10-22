import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors/AppError";
import { verifyToken } from "../modules/auth/token";
import { userRepository } from "../container";

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new UnauthorizedError();

  const userId = verifyToken(header.slice(7));
  const user = await userRepository.findById(userId);
  if (!user) throw new UnauthorizedError("User no longer exists");

  req.user = user;
  next();
}