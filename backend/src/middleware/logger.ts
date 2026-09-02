// src/middleware/logger.ts
import { logger } from "../lib/logger";
import { Request, Response, NextFunction } from "express";

export function withLogger(req: Request, res: Response, next: NextFunction) {
  req.log = logger.child({ requestId: req.requestId });
  next();
}
