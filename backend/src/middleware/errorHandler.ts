import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError
} from "@prisma/client/runtime/library";
import { HttpException } from "../exceptions/HttpException";
import { logger } from "@/lib/logger";

interface ErrorResponse {
  error: string;        // Human readable category
  code: string;         // Machine readable
  message: string;      // Human explanation
  details?: any;        // Zod issues, Prisma meta, etc.
  stack?: string;       // Dev only
  requestId?: string;   // For logs + tracing
}

const handleHttpException = (error: HttpException, requestId: string) => {
  const response: ErrorResponse = {
    error: HttpException.defaultCode(error.statusCode).replace("_", " "),
    code: error.code,
    message: error.message,
    details: error.details,
    requestId
  };

  if (process.env.NODE_ENV === "development") {
    response.stack = error.stack;
  }

  logger.warn(`HttpException(${error.statusCode}): ${JSON.stringify(response)}`);

  return response;
};

const handlePayloadError = (error: ZodError, requestId: string) => {
  const response: ErrorResponse = {
    error: "Validation error",
    code: "VALIDATION_ERROR",
    message: "Invalid request data",
    details: error.flatten(),
    requestId
  };

  logger.warn(`Payload error: ${error.message}`);

  return response;
};

const handleDBQueryError = (error: PrismaClientValidationError, requestId: string) => {
  const response: ErrorResponse = {
    error: "Validation error",
    code: "DB_VALIDATION_ERROR",
    message: "Invalid database query",
    details: error.message.split("\n"),
    requestId
  };

  logger.warn(`Prisma validation error: ${JSON.stringify(response)}`);
  return response;
};

const handleUnknownError = (error: Error, requestId: string) => {
  const response: ErrorResponse = {
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred."
        : error.message,
    requestId
  };

  if (process.env.NODE_ENV === "development") {
    response.stack = error.stack;
    response.details = {
      name: error.name,
      message: error.message
    };
  }

  logger.error(`Unhandled error: ${JSON.stringify(response)}`);
  return response;
};

function makePrismaErrorResponse(
  error: PrismaClientKnownRequestError,
  requestId: string
) {
  switch (error.code) {
    case "P2002":
      return {
        status: 409,
        body: {
          error: "Conflict",
          code: "UNIQUE_CONSTRAINT",
          message: `A record with this ${error.meta?.target} already exists`,
          requestId
        }
      };
    case "P2025":
      return {
        status: 404,
        body: {
          error: "Not found",
          code: "RECORD_NOT_FOUND",
          message: "The requested record was not found",
          requestId
        }
      };
    case "P2003":
      return {
        status: 400,
        body: {
          error: "Bad request",
          code: "FK_CONSTRAINT",
          message: "Invalid reference to related record",
          requestId
        }
      };
    default:
      return {
        status: 500,
        body: {
          error: "Database error",
          code: error.code,
          message: "A database error occurred",
          details: error.meta,
          requestId
        }
      };
  }
}


export const errorHandlerMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req as any).requestId;

  // If headers are already sent
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof HttpException) {
    const response = handleHttpException(error, requestId);
    return res.status(error.statusCode).json(response);
  }

  if (error instanceof ZodError) {
    const response = handlePayloadError(error, requestId);
    return res.status(400).json(response);
  }

  if (error instanceof PrismaClientKnownRequestError) {
    const response = makePrismaErrorResponse(error, requestId);
    logger.warn(`Prisma error: ${JSON.stringify(response)}`);
    return res.status(response.status).json(response.body);
  }

  if (error instanceof PrismaClientValidationError) {
    const response = handleDBQueryError(error, requestId);
    return res.status(400).json(response);
  }

  if ((error as any).name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Authentication error",
      code: "INVALID_TOKEN",
      message: "Invalid token",
      requestId
    });
  }

  if ((error as any).name === "TokenExpiredError") {
    return res.status(401).json({
      error: "Authentication error",
      code: "TOKEN_EXPIRED",
      message: "Token has expired",
      requestId
    });
  }

  // ------------------------------
  // 6. UNKNOWN ERROR
  // ------------------------------
  const err = error as Error;
  const response = handleUnknownError(err, requestId);
  return res.status(500).json(response);
};
