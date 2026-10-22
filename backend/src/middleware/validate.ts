import { RequestHandler } from "express";
import { ZodType } from "zod";

// Parses req.body; on failure the ZodError reaches errorHandler and becomes a 400.
export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };