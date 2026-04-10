import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

const JWT_SECRET: string = getJwtSecret();

// Augment Express Request so userId is available after auth middleware.
// Controllers behind authMiddleware can safely use req.userId without null checks.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// AuthRequest narrows userId to non-optional for use in protected handlers.
export type AuthRequest = Request & { userId: string };

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: { message: 'Access denied. No token provided.' } });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, error: { message: 'Access denied. Invalid token format.' } });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ success: false, error: { message: 'Token expired, please login again.' } });
      return;
    }
    if (error instanceof JsonWebTokenError) {
      res.status(401).json({ success: false, error: { message: 'Invalid token.' } });
      return;
    }
    res.status(500).json({ success: false, error: { message: 'Internal server error during authentication.' } });
  }
};

export { JWT_SECRET };
