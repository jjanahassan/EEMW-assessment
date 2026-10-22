import { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";
import { UserRole } from "../modules/auth/auth.types";

// usage: router.delete("/:id", authenticate, requireRole("admin", "manager"), handler)
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (!roles.includes(req.user.role)) throw new ForbiddenError("Your role cannot perform this action");
    next();
  };