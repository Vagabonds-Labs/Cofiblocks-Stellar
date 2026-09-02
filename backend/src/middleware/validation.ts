import { ParamsDictionary } from 'express-serve-static-core';
import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError, ZodTypeAny } from 'zod';
import { ParsedQs } from 'qs';

/**
 * Validation middleware factory
 * Validates request body, query, and params against a Zod schema
 */
export const validate = (schema: ZodObject<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query ?? {},
        params: req.params ?? {},
      });

      req.body = parsed.body;
      req.query = parsed.query as ParsedQs;
      req.params = parsed.params as ParamsDictionary;

      next();
    } catch (error) {
      next(error);
    }
  };
};


