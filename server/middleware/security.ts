import type { NextFunction, Request, Response } from 'express';

const windowMs = 60_000;
const maxRequests = 60;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

export function rateLimit(request: Request, response: Response, next: NextFunction) {
  const now = Date.now();
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const current = requestCounts.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  requestCounts.set(key, entry);

  if (entry.count > maxRequests) {
    response.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
    return response.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  for (const [storedKey, storedEntry] of requestCounts) {
    if (storedEntry.resetAt <= now) requestCounts.delete(storedKey);
  }
  return next();
}
