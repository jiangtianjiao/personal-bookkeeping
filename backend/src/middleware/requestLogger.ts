import { Request, Response, NextFunction } from 'express';

const SKIP_PATHS = ['/health'];

const formatTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const SENSITIVE_FIELDS = ['password', 'currentPassword', 'newPassword', 'passwordHash', 'token'];

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (SKIP_PATHS.includes(req.path)) {
    next();
    return;
  }

  const start = Date.now();
  const ip = req.ip || req.socket.remoteAddress || '-';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const timestamp = formatTimestamp();

    const logLine = `[${timestamp}] ${req.method} ${req.originalUrl} ${status} ${duration}ms ${ip}`;

    if (status >= 400) {
      const details: Record<string, unknown> = { body: sanitizeBody(req.body) };
      if (req.query && Object.keys(req.query).length > 0) {
        details.query = req.query;
      }
      console.error(logLine, JSON.stringify(details));
    } else {
      console.log(logLine);
    }
  });

  next();
};
