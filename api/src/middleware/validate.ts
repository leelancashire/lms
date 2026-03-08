import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodTypeAny } from "zod";

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function toDetails(error: ZodError) {
  return error.flatten();
}

export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: toDetails(parsed.error) });
      }
      req.body = parsed.data;
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query params", details: toDetails(parsed.error) });
      }
      req.query = parsed.data as Request["query"];
    }

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid route params", details: toDetails(parsed.error) });
      }
      req.params = parsed.data as Request["params"];
    }

    return next();
  };
}
