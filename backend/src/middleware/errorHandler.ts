import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AppError } from '../errors/AppError';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // AppError (includes NotFoundError, ConflictError, ValidationError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    err.issues.forEach((issue) => {
      const path = issue.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    });
    res.status(400).json({
      success: false,
      error: { message: 'Validation failed.', details },
    });
    return;
  }

  // Prisma known request errors
  if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          success: false,
          error: { message: 'A record with this value already exists.' },
        });
        return;
      case 'P2025':
        res.status(404).json({
          success: false,
          error: { message: 'Record not found.' },
        });
        return;
      default:
        console.error('Prisma error:', err.code, err.message);
        res.status(500).json({
          success: false,
          error: { message: 'Internal server error.' },
        });
        return;
    }
  }

  // Unknown errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error.',
    },
  });
};
