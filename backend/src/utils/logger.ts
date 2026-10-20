import pino from "pino";
import { env } from "../config/env";

export const logger = pino(
  env.NODE_ENV === "development"
    ? { level: "debug", transport: { target: "pino-pretty" } }
    : { level: "info" },
);